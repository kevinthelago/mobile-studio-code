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

export async function putFileContent(
  pat: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  sha: string | null,
): Promise<{ sha: string }> {
  const body: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `PUT ${path} failed (${res.status}): ${err.slice(0, 200)}`,
    );
  }
  const result = (await res.json()) as { content: { sha: string } };
  return { sha: result.content.sha };
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

// -- Issues ------------------------------------------------------------------

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

// -- Push (Git Trees API) ----------------------------------------------------
//
// Uses the low-level Git Data API instead of PUT /contents so that:
//  1. New files in nested directories work without a prior remote SHA.
//  2. All modified files land in a single atomic commit.
//
// Flow: create blobs → create tree (on top of current HEAD tree) →
//       create commit → PATCH ref to point at new commit.

async function ghPost<T>(
  pat: string,
  url: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${url} failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function ghPatch<T>(
  pat: string,
  url: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PATCH ${url} failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** Encode text as base64 (handles Unicode). */
function toBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

export async function pushModifiedFiles(
  pat: string,
  manifest: Manifest,
  message: string,
): Promise<{ pushed: number; manifest: Manifest }> {
  const modifiedPaths = Object.entries(manifest.files)
    .filter(([, e]) => e.modified)
    .map(([p]) => p);

  if (modifiedPaths.length === 0) {
    return { pushed: 0, manifest };
  }

  const base = `https://api.github.com/repos/${manifest.repo}`;

  // 1. Get current HEAD commit SHA and its tree SHA.
  const refRes = await fetch(
    `${base}/git/ref/heads/${manifest.branch}`,
    { headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' } },
  );
  if (!refRes.ok) {
    const err = await refRes.text();
    throw new Error(`Ref fetch failed (${refRes.status}): ${err.slice(0, 200)}`);
  }
  const refData = (await refRes.json()) as { object: { sha: string } };
  const headCommitSha = refData.object.sha;

  const commitRes = await fetch(
    `${base}/git/commits/${headCommitSha}`,
    { headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' } },
  );
  if (!commitRes.ok) {
    const err = await commitRes.text();
    throw new Error(`Commit fetch failed (${commitRes.status}): ${err.slice(0, 200)}`);
  }
  const commitData = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = commitData.tree.sha;

  // 2. Create a blob for each modified file.
  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];

  for (const path of modifiedPaths) {
    const content = await readText(repoDir(manifest.repo) + path);
    const blob = await ghPost<{ sha: string }>(pat, `${base}/git/blobs`, {
      content: toBase64(content),
      encoding: 'base64',
    });
    treeItems.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 3. Create a new tree on top of the base tree.
  const newTree = await ghPost<{ sha: string }>(pat, `${base}/git/trees`, {
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // 4. Create a new commit.
  const newCommit = await ghPost<{ sha: string }>(pat, `${base}/git/commits`, {
    message,
    tree: newTree.sha,
    parents: [headCommitSha],
  });

  // 5. Update the branch ref.
  await ghPatch(pat, `${base}/git/refs/heads/${manifest.branch}`, {
    sha: newCommit.sha,
    force: false,
  });

  // 6. Update manifest: mark files as clean with their new blob SHAs.
  for (let i = 0; i < modifiedPaths.length; i++) {
    const path = modifiedPaths[i];
    manifest.files[path] = { sha: treeItems[i].sha, modified: false };
  }
  await writeManifest(manifest);

  return { pushed: modifiedPaths.length, manifest };
}
