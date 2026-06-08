import { Manifest, FileEntry } from './types';
import {
  ensureDir, repoDir, writeText, readText, writeManifest,
} from './fs';

export type GithubUser = { login: string; scopes: string[] };

export async function verifyGithubPat(pat: string): Promise<GithubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 401) throw new Error('Invalid PAT (401).');
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  const scopes = (res.headers.get('x-oauth-scopes') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const body = (await res.json()) as { login: string };
  return { login: body.login, scopes };
}

export type TreeEntry = {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
};

export async function getRepoTree(
  pat: string,
  repo: string,
  branch: string,
): Promise<TreeEntry[]> {
  const refRes = await fetch(
    `https://api.github.com/repos/${repo}/git/ref/heads/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!refRes.ok) {
    throw new Error(`Branch ${branch} not found (${refRes.status}).`);
  }
  const ref = (await refRes.json()) as { object: { sha: string } };

  const commitRes = await fetch(
    `https://api.github.com/repos/${repo}/git/commits/${ref.object.sha}`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!commitRes.ok) {
    throw new Error(`Commit lookup failed (${commitRes.status}).`);
  }
  const commit = (await commitRes.json()) as { tree: { sha: string } };

  const treeRes = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${commit.tree.sha}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!treeRes.ok) {
    throw new Error(`Tree fetch failed (${treeRes.status}).`);
  }
  const tree = (await treeRes.json()) as {
    tree: TreeEntry[];
    truncated: boolean;
  };
  if (tree.truncated) {
    console.warn('Tree truncated; some files not downloaded.');
  }
  return tree.tree.filter((e) => e.type === 'blob');
}

export async function fetchBlob(
  pat: string,
  repo: string,
  sha: string,
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/git/blobs/${sha}`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!res.ok) throw new Error(`Blob fetch ${sha} failed (${res.status}).`);
  const body = (await res.json()) as { content: string; encoding: string };
  if (body.encoding !== 'base64') {
    throw new Error(`Unexpected encoding ${body.encoding}`);
  }
  return atob(body.content.replace(/\n/g, ''));
}

// URL-encode each path segment but keep `/` separators. encodeURIComponent
// alone would also escape slashes, breaking the route. Without this, files
// in `app/(tabs)/...` (or any path containing `(`, `)`, spaces, etc.) push
// as 400/422 because GitHub can't route the URL.
// Strip leading and trailing slashes. The GitHub Contents API mounts the
// repo root at `/repos/{repo}/contents/`, so a leading `/` produces a double
// slash (404) and a trailing `/` produces an empty trailing segment (also
// 404). Defensive — the canonical fix is at the manifest write site (agent.ts
// write_file normalizes before storing), but matching both ends keeps a stale
// manifest from breaking push/read_remote.
function encodeRepoPath(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed.split('/').map(encodeURIComponent).join('/');
}

// Encode each segment of a branch ref but keep `/` as a path separator.
// `encodeURIComponent('feature/foo')` would produce `feature%2Ffoo`, which
// 404s on the git/refs endpoints. Branch names like `kevin/some-branch` or
// `release/2026-Q1` are common and have to round-trip cleanly.
function encodeBranchName(branch: string): string {
  return branch.split('/').map(encodeURIComponent).join('/');
}

// Fetch the current remote contents and sha of a single file at a branch.
// Used during conflict resolution: the agent reads the remote version, merges
// it with the local edits, and writes the result back via resolve_conflict —
// which needs the up-to-date sha so the next push uses it as the parent.
export async function getRemoteFile(
  pat: string,
  repo: string,
  branch: string,
  path: string,
): Promise<{ content: string; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `getRemoteFile ${path} failed (${res.status}). ` +
      (res.status === 404 ? 'File may have been deleted upstream.' : ''),
    );
  }
  const body = (await res.json()) as {
    content?: string; encoding?: string; sha: string; type: string;
  };
  if (body.type !== 'file') {
    throw new Error(`${path} is not a file (type=${body.type}).`);
  }
  if (body.encoding !== 'base64' || typeof body.content !== 'string') {
    throw new Error(`Unexpected encoding ${body.encoding} for ${path}.`);
  }
  return {
    content: atob(body.content.replace(/\n/g, '')),
    sha: body.sha,
  };
}

// Why a typed error: callers (UI alert, agent tool result) need to branch on
// *kind* of failure — sha mismatch is a "pull first" workflow, branch protected
// is a "use a PR" workflow, auth is a "fix your token" workflow. Throwing a
// flat string forces callers to regex-match the message, which is brittle.
export type PushFailureKind =
  | 'sha_mismatch'
  | 'branch_protected'
  | 'not_found'
  | 'auth'
  | 'other';

export type PushFailure = {
  path: string;
  kind: PushFailureKind;
  status: number;
  message: string;
};

// Pull a human-friendly message out of GitHub's JSON error body, falling
// back to the raw text. GitHub returns { message, errors? } shapes from
// most git/* endpoints.
function extractGithubMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      message?: unknown; errors?: { message?: unknown }[];
    };
    if (typeof parsed.message === 'string') {
      const extra = (parsed.errors ?? [])
        .map((e) => (typeof e?.message === 'string' ? e.message : null))
        .filter((s): s is string => s != null)
        .join('; ');
      return extra ? `${parsed.message}: ${extra}` : parsed.message;
    }
  } catch {
    /* keep raw body */
  }
  return body;
}

// Classify an error from a top-level Trees API endpoint (ref/commits/trees/
// blobs) into one of our PushFailureKind buckets. The path is the affected
// file when known, or '*' when the failure is whole-push (e.g. branch ref
// non-fast-forward, branch protection). The url is included in the failure
// message so the user can see exactly which endpoint rejected the request —
// invaluable when debugging "is GitHub at fault or are we?"
function classifyTreesError(
  status: number, body: string, path: string, url: string,
): PushFailure {
  const message = extractGithubMessage(body);
  // Strip the API host so messages stay readable — the user already knows
  // we're talking to api.github.com.
  const shortUrl = url.replace(/^https?:\/\/api\.github\.com/, '');
  if (status === 401) {
    return {
      path, kind: 'auth', status,
      message: `GitHub token is invalid or expired (401 on ${shortUrl}). Reset and reauthenticate.`,
    };
  }
  if (status === 403 && /protect/i.test(message)) {
    return { path, kind: 'branch_protected', status, message };
  }
  if (status === 403) {
    return {
      path, kind: 'auth', status,
      message: `Permission denied (403 on ${shortUrl}): ${message}`,
    };
  }
  if (status === 404) {
    return {
      path, kind: 'not_found', status,
      message:
        `404 on ${shortUrl} — ${message}. ` +
        `Check that the repo exists, the branch name matches, and the ` +
        `PAT has Contents: read+write for this repo (fine-grained PATs ` +
        `return 404 on missing scopes instead of 403).`,
    };
  }
  if (status === 422 && /not.*fast.forward|fast forward/i.test(message)) {
    return {
      path, kind: 'sha_mismatch', status,
      message:
        `Branch HEAD moved on the remote between our pre-flight check and ` +
        `commit. Pull and retry.`,
    };
  }
  return {
    path, kind: 'other', status,
    message: `${status} on ${shortUrl}: ${message.slice(0, 200)}`,
  };
}

const GH_HEADERS_GET = (pat: string) => ({
  Authorization: `Bearer ${pat}`,
  Accept: 'application/vnd.github+json',
});
const GH_HEADERS_POST = (pat: string) => ({
  ...GH_HEADERS_GET(pat),
  'Content-Type': 'application/json',
});

// Wrap fetch with classified errors. Throws PushFailure-shaped data via a
// thrown object so the caller doesn't have to decode response bodies twice.
class GithubApiError extends Error {
  readonly failure: PushFailure;
  constructor(failure: PushFailure) {
    super(failure.message);
    this.name = 'GithubApiError';
    this.failure = failure;
  }
}

// Redact base64 blob content from logged request bodies. A single text file
// turning into an 8KB base64 line drowns the dev console; we only need to
// see the body's *shape* for debugging, not the content.
function redactRequestBody(body: BodyInit | null | undefined): string {
  if (typeof body !== 'string') return '<non-string body>';
  if (body.length > 1500) {
    // Hide blob content payloads but keep field names visible.
    const redacted = body.replace(
      /"content"\s*:\s*"[^"]{40,}"/g,
      '"content":"<base64 elided>"',
    );
    return redacted.length > 1500
      ? redacted.slice(0, 1500) + '… [truncated]'
      : redacted;
  }
  return body;
}

async function ghFetch(
  url: string, init: RequestInit, path: string,
): Promise<unknown> {
  const method = (init.method ?? 'GET').toUpperCase();
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    // Always log the failing request so debugging push errors doesn't
    // require attaching a network proxy. Body is capped to keep logs
    // readable; the full text still flows through to the failure message.
    const reqBody = method === 'GET' ? '' :
      `\n  request: ${redactRequestBody(init.body)}`;
    console.warn(
      `[github] ${method} ${url} → ${res.status}${reqBody}\n  response: ${text.slice(0, 500)}`,
    );
    throw new GithubApiError(
      classifyTreesError(res.status, text, path, url),
    );
  }
  return await res.json();
}

export async function downloadRepo(
  pat: string,
  repo: string,
  branch: string,
  onProgress?: (current: number, total: number, path: string) => void,
): Promise<Manifest> {
  await ensureDir(repoDir(repo));

  const blobs = await getRepoTree(pat, repo, branch);
  const files: Record<string, FileEntry> = {};

  for (let i = 0; i < blobs.length; i++) {
    const entry = blobs[i];
    onProgress?.(i, blobs.length, entry.path);
    try {
      const content = await fetchBlob(pat, repo, entry.sha);
      await writeText(repoDir(repo) + entry.path, content);
      files[entry.path] = { sha: entry.sha, modified: false };
    } catch (e) {
      console.warn(`Skipped ${entry.path}:`, e);
    }
  }

  const manifest: Manifest = {
    repo,
    branch,
    syncedAt: Date.now(),
    files,
  };
  await writeManifest(manifest);
  return manifest;
}

export async function pullRepo(
  pat: string,
  manifest: Manifest,
  onProgress?: (current: number, total: number, path: string) => void,
): Promise<{
  updated: number;
  added: number;
  unchanged: number;
  conflicts: string[];
  manifest: Manifest;
}> {
  const blobs = await getRepoTree(pat, manifest.repo, manifest.branch);

  let updated = 0;
  let added = 0;
  let unchanged = 0;
  const conflicts: string[] = [];

  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];
    onProgress?.(i, blobs.length, blob.path);
    const local = manifest.files[blob.path];

    if (local && local.sha === blob.sha && !local.modified) {
      unchanged++;
      continue;
    }

    if (local && local.modified && local.sha !== blob.sha) {
      conflicts.push(blob.path);
      continue;
    }

    try {
      const content = await fetchBlob(pat, manifest.repo, blob.sha);
      await writeText(repoDir(manifest.repo) + blob.path, content);
      manifest.files[blob.path] = { sha: blob.sha, modified: false };
      if (local) updated++;
      else added++;
    } catch {
      // skip binary or decode failures
    }
  }

  manifest.syncedAt = Date.now();
  await writeManifest(manifest);
  return { updated, added, unchanged, conflicts, manifest };
}

// ── Issues ─────────────────────────────────────────────────────────────────

export type GithubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  url: string;       // html_url
  apiUrl: string;    // url
  updatedAt: string; // ISO
  comments: number;
  labels: string[];
};

export type GithubIssueComment = {
  id: number;
  user: string;
  body: string;
  createdAt: string;
};

type IssueApiShape = {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  url: string;
  updated_at: string;
  comments: number;
  labels: ({ name: string } | string)[];
  pull_request?: unknown;
};

function normalizeIssue(raw: IssueApiShape): GithubIssue {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? null,
    state: raw.state,
    url: raw.html_url,
    apiUrl: raw.url,
    updatedAt: raw.updated_at,
    comments: raw.comments,
    labels: (raw.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)),
  };
}

// List issues (excludes pull requests; GitHub returns PRs from the issues API
// and we filter them out client-side).
export async function listIssues(
  pat: string,
  repo: string,
  opts: { state?: 'open' | 'closed' | 'all'; perPage?: number } = {},
): Promise<GithubIssue[]> {
  const params = new URLSearchParams({
    state: opts.state ?? 'open',
    per_page: String(opts.perPage ?? 30),
    sort: 'updated',
    direction: 'desc',
  });
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?${params}`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Issues fetch failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const items = (await res.json()) as IssueApiShape[];
  return items.filter((i) => !i.pull_request).map(normalizeIssue);
}

export async function getIssue(
  pat: string, repo: string, number: number,
): Promise<GithubIssue> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${number}`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Issue ${number} fetch failed (${res.status}): ${body.slice(0, 160)}`);
  }
  return normalizeIssue((await res.json()) as IssueApiShape);
}

export async function getIssueComments(
  pat: string, repo: string, number: number,
): Promise<GithubIssueComment[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${number}/comments?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Comments fetch failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const raw = (await res.json()) as {
    id: number; user: { login: string }; body: string; created_at: string;
  }[];
  return raw.map((c) => ({
    id: c.id,
    user: c.user?.login ?? 'unknown',
    body: c.body ?? '',
    createdAt: c.created_at,
  }));
}

export async function createIssue(
  pat: string,
  repo: string,
  title: string,
  body: string,
): Promise<GithubIssue> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body }),
    },
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Issue create failed (${res.status}): ${errBody.slice(0, 200)}`);
  }
  return normalizeIssue((await res.json()) as IssueApiShape);
}

// ── Milestones + rich issues (planner publish) ──────────────────────────────

export type GithubMilestone = { number: number; title: string; state: 'open' | 'closed' };

export async function listMilestones(pat: string, repo: string): Promise<GithubMilestone[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/milestones?state=all&per_page=100`,
    { headers: GH_HEADERS_GET(pat) },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Milestones fetch failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const raw = (await res.json()) as { number: number; title: string; state: 'open' | 'closed' }[];
  return raw.map((m) => ({ number: m.number, title: m.title, state: m.state }));
}

export async function createMilestone(
  pat: string, repo: string, title: string, description?: string,
): Promise<GithubMilestone> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/milestones`,
    {
      method: 'POST',
      headers: GH_HEADERS_POST(pat),
      body: JSON.stringify({ title, description: description ?? undefined }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Milestone create failed (${res.status}): ${extractGithubMessage(body).slice(0, 200)}`);
  }
  const m = (await res.json()) as { number: number; title: string; state: 'open' | 'closed' };
  return { number: m.number, title: m.title, state: m.state };
}

/** Create an issue with optional labels + milestone (by number). */
export async function createIssueWithMeta(
  pat: string,
  repo: string,
  issue: { title: string; body: string; labels?: string[]; milestone?: number },
): Promise<GithubIssue> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues`,
    {
      method: 'POST',
      headers: GH_HEADERS_POST(pat),
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: issue.labels?.length ? issue.labels : undefined,
        milestone: issue.milestone,
      }),
    },
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Issue create failed (${res.status}): ${extractGithubMessage(errBody).slice(0, 200)}`);
  }
  return normalizeIssue((await res.json()) as IssueApiShape);
}

export async function commentOnIssue(
  pat: string, repo: string, number: number, body: string,
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${number}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    },
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Comment failed (${res.status}): ${errBody.slice(0, 200)}`);
  }
}

// Push every locally-modified file to GitHub in a single atomic commit using
// the Git Data API (git/refs, git/commits, git/trees, git/blobs).
//
// Pipeline:
//   1. GET ref           → current branch HEAD commit sha
//   2. GET commit        → base tree sha
//   3. GET tree?recursive → remote sha for every file (pre-flight conflict check)
//   4. POST blobs        → upload each modified file's content, get blob shas
//   5. POST trees        → build a new tree off base_tree + our blob entries
//   6. POST commits      → wrap the new tree in a commit with HEAD as parent
//   7. PATCH ref         → fast-forward the branch to the new commit
//
// Why this beats per-file Contents API PUTs:
//   - One commit instead of N (clean history, atomic from a viewer's POV)
//   - New files don't need any sha bookkeeping (no probe, no 422/404 surprises)
//   - Conflicts are detected once up front (step 3) instead of per-file at PUT
//   - Sets us up for deletes later (omit the path from tree, or set sha:null)
//
// Conflict semantics preserved: local.sha is still each file's tracked parent
// blob sha. If remote tree's sha for a path differs from local.sha, that's a
// conflict — same kind: 'sha_mismatch' the existing pull + resolve_conflict
// flow handles. New files (local.sha === null) conflict iff the path already
// exists in the remote tree.
export async function pushModifiedFiles(
  pat: string,
  manifest: Manifest,
  message: string,
): Promise<{ pushed: number; failures: PushFailure[]; manifest: Manifest }> {
  const modifiedPaths = Object.entries(manifest.files)
    .filter(([, e]) => e.modified)
    .map(([p]) => p);

  const failures: PushFailure[] = [];
  if (modifiedPaths.length === 0) {
    return { pushed: 0, failures, manifest };
  }

  const repo = manifest.repo;
  const branch = manifest.branch;

  // ── Steps 1–3: fetch ref → commit → tree (read side, no writes yet) ──
  let headCommitSha: string;
  let baseTreeSha: string;
  let remoteShaByPath: Map<string, string>;
  try {
    const ref = await ghFetch(
      `https://api.github.com/repos/${repo}/git/ref/heads/${encodeBranchName(branch)}`,
      { headers: GH_HEADERS_GET(pat) },
      '*',
    ) as { object: { sha: string } };
    headCommitSha = ref.object.sha;

    const commit = await ghFetch(
      `https://api.github.com/repos/${repo}/git/commits/${headCommitSha}`,
      { headers: GH_HEADERS_GET(pat) },
      '*',
    ) as { tree: { sha: string } };
    baseTreeSha = commit.tree.sha;

    const tree = await ghFetch(
      `https://api.github.com/repos/${repo}/git/trees/${baseTreeSha}?recursive=1`,
      { headers: GH_HEADERS_GET(pat) },
      '*',
    ) as { tree: TreeEntry[]; truncated: boolean };

    remoteShaByPath = new Map<string, string>();
    for (const e of tree.tree) {
      if (e.type === 'blob') remoteShaByPath.set(e.path, e.sha);
    }

    // Truncated trees are rare (>100k entries) but possible. We can't reliably
    // detect conflicts on paths we didn't see, so refuse rather than risk a
    // silent overwrite. The user can fall back to manual resolution.
    if (tree.truncated) {
      for (const path of modifiedPaths) {
        failures.push({
          path, kind: 'other', status: 0,
          message:
            'Repository tree is too large to fetch in one request ' +
            '(GitHub returned truncated=true). Push aborted to avoid ' +
            'silent overwrites. Push fewer/smaller files at a time.',
        });
      }
      return { pushed: 0, failures, manifest };
    }
  } catch (e) {
    // Whole-push read failure: report against every modified path so the UI
    // still surfaces them and the agent can reason about it.
    const failure = e instanceof GithubApiError
      ? e.failure
      : { path: '*', kind: 'other' as const, status: 0,
          message: e instanceof Error ? e.message : 'unknown error' };
    for (const path of modifiedPaths) {
      failures.push({ ...failure, path });
    }
    return { pushed: 0, failures, manifest };
  }

  // ── Pre-flight: which paths are clean to push, which conflict? ──
  type Plan = { path: string; content: string };
  const plan: Plan[] = [];
  for (const path of modifiedPaths) {
    const local = manifest.files[path];
    const remoteSha = remoteShaByPath.get(path);

    if (remoteSha === undefined) {
      // Path doesn't exist in the remote tree. Two ways to land here:
      //   1. Genuinely new file (local.sha === null) — push as create.
      //   2. local.sha is set but remote no longer has the path — could be a
      //      stale manifest (force-push, branch reset, file deleted upstream
      //      and never pulled). Solo workflows want this to "just push" the
      //      local content as a new file rather than block on a deletion the
      //      user didn't ask about. Treat it as create either way; on success
      //      we'll stamp the manifest with the new blob sha. If the user does
      //      want the deletion respected, they can pull (which won't bring it
      //      back, but resyncs the manifest) and skip the push.
      // No failure recorded — fall through to push as new.
    } else {
      // Path exists on remote.
      if (local.sha === null) {
        failures.push({
          path, kind: 'sha_mismatch', status: 409,
          message:
            `${path} exists on the remote but the local copy has no recorded ` +
            `sha. Pull to fetch the remote version (it'll be marked as a ` +
            `conflict), merge or take one side via resolve_conflict, then push.`,
        });
        continue;
      }
      if (local.sha !== remoteSha) {
        failures.push({
          path, kind: 'sha_mismatch', status: 409,
          message:
            `Remote has a newer version of ${path} than the local parent sha. ` +
            `Pull to merge before pushing.`,
        });
        continue;
      }
    }

    let content: string;
    try {
      content = await readText(repoDir(repo) + path);
    } catch (e) {
      failures.push({
        path, kind: 'other', status: 0,
        message: e instanceof Error ? e.message : 'read failed',
      });
      continue;
    }
    plan.push({ path, content });
  }

  if (plan.length === 0) {
    return { pushed: 0, failures, manifest };
  }

  // ── Step 4: create blobs (one POST per file). ──
  // Could be parallelized with Promise.all, but serial keeps the failure
  // attribution clean and avoids hammering the API on retries.
  type BlobEntry = { path: string; sha: string };
  const blobs: BlobEntry[] = [];
  for (const item of plan) {
    try {
      const blob = await ghFetch(
        `https://api.github.com/repos/${repo}/git/blobs`,
        {
          method: 'POST',
          headers: GH_HEADERS_POST(pat),
          body: JSON.stringify({
            content: btoa(unescape(encodeURIComponent(item.content))),
            encoding: 'base64',
          }),
        },
        item.path,
      ) as { sha: string };
      blobs.push({ path: item.path, sha: blob.sha });
    } catch (e) {
      const failure = e instanceof GithubApiError
        ? e.failure
        : { path: item.path, kind: 'other' as const, status: 0,
            message: e instanceof Error ? e.message : 'blob upload failed' };
      failures.push(failure);
    }
  }

  if (blobs.length === 0) {
    return { pushed: 0, failures, manifest };
  }

  // ── Steps 5–7: tree → commit → ref. Whole-push from here on; if any of
  // these fail, attribute the failure to every blob we'd intended to ship.
  try {
    const newTree = await ghFetch(
      `https://api.github.com/repos/${repo}/git/trees`,
      {
        method: 'POST',
        headers: GH_HEADERS_POST(pat),
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: blobs.map((b) => ({
            path: b.path,
            mode: '100644',
            type: 'blob',
            sha: b.sha,
          })),
        }),
      },
      '*',
    ) as { sha: string };

    const newCommit = await ghFetch(
      `https://api.github.com/repos/${repo}/git/commits`,
      {
        method: 'POST',
        headers: GH_HEADERS_POST(pat),
        body: JSON.stringify({
          message,
          tree: newTree.sha,
          parents: [headCommitSha],
        }),
      },
      '*',
    ) as { sha: string };

    await ghFetch(
      `https://api.github.com/repos/${repo}/git/refs/heads/${encodeBranchName(branch)}`,
      {
        method: 'PATCH',
        headers: GH_HEADERS_POST(pat),
        body: JSON.stringify({ sha: newCommit.sha, force: false }),
      },
      '*',
    );

    // Ref updated: stamp the manifest with the new blob shas (these are now
    // the "parent" shas for the next pull/diff).
    for (const b of blobs) {
      manifest.files[b.path] = { sha: b.sha, modified: false };
    }
    await writeManifest(manifest);
    return { pushed: blobs.length, failures, manifest };
  } catch (e) {
    let base: PushFailure = e instanceof GithubApiError
      ? e.failure
      : { path: '*', kind: 'other' as const, status: 0,
          message: e instanceof Error ? e.message : 'commit/ref update failed' };

    // Special-case: 404 on /git/trees POST when the changeset includes any
    // workflow file is almost always the missing-workflow-scope footgun.
    // GitHub returns a bare "Not Found" without explaining, so we have to
    // recognize the pattern ourselves. Re-classify as auth so the user gets
    // the "fix your token" message path instead of a generic "deleted
    // upstream?" guess.
    const workflowPaths = blobs
      .map((b) => b.path)
      .filter((p) => /^\.github\/workflows\//.test(p));
    if (base.status === 404 && workflowPaths.length > 0) {
      base = {
        path: '*', kind: 'auth', status: 404,
        message:
          `Push touches workflow files (${workflowPaths.join(', ')}) but ` +
          `your GitHub token lacks the workflow scope. Classic PATs need ` +
          `'repo' AND 'workflow' scopes; fine-grained PATs need ` +
          `'Contents: read+write' AND 'Workflows: read+write'. Issue a new ` +
          `token with the right scopes and re-authenticate from the repo ` +
          `screen, then retry the push.`,
      };
    }

    for (const b of blobs) {
      failures.push({ ...base, path: b.path });
    }
    return { pushed: 0, failures, manifest };
  }
}
