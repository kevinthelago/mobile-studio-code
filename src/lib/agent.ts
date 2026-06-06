import {
  ChatMessage, LinkedIssue, Manifest, ToolDefinition, ToolResultBlock,
  RetryStatus, CancelSignal,
} from './types';
import { LLMProvider } from './providers';
import {
  repoDir, listDir, readText, writeText, isDirectory, isMscMetaFile,
  writeManifest, loadProjectInstructions, ProjectInstructions,
} from './fs';
import {
  evictStaleToolResults, maybeCompactHistory, repairOrphanToolUses,
  truncateToolResultContent,
} from './contextOptimizer';
import {
  commentOnIssue, getIssue, getIssueComments, getRemoteFile,
  pullRepo, pushModifiedFiles,
} from './github';

const BASE_SYSTEM_PROMPT = `You are an AI coding assistant integrated into Mobile Studio Code, a mobile IDE running on iOS. You have tools to read and modify files in the user's local working copy of their git repository. After tool calls, briefly summarize what you did.

Conversational style: be concise — the user is on a phone with a small screen. Each turn should be short. Do NOT narrate every step in detail; just enough for the user to follow. Long preambles waste output budget and risk hitting the per-turn token cap, which truncates your response. If you have a long answer, prefer a short summary first and offer to expand.

Reading files efficiently:
- read_file returns line-numbered output and supports \`offset\` (1-indexed start line) and \`limit\` (number of lines, default 200, max 2000).
- For large files, prefer grep_file to locate the lines you care about, then read_file with offset/limit to load just that range. Do NOT re-read whole large files repeatedly.
- read_file results show "[+N more lines not shown. Continue with read_file(...)]" when there's more — only fetch more if you actually need it.

You also have access to optimization context:
- Older turns may be auto-summarized; if you need detail from earlier, ask the user to clarify.
- read_file results may be evicted with a stale marker if a file changed later — re-read with read_file when needed.
- When a task is linked to a GitHub issue, read it once at the start with read_issue rather than asking the user to paste the body.

Pushing changes:
- Only call push_changes when the user explicitly asks to push or commit. Do not auto-push after editing files.
- If push_changes returns failures with kind "sha_mismatch", remote has newer changes than the local copy. Call pull_changes to fetch them; this will surface conflicts (files modified locally and remotely). Resolve each conflict (read_remote_file + read_file → merge → resolve_conflict) before retrying push_changes.
- For "branch_protected" failures, explain that they need to push to a different branch and open a PR; do not retry.
- For "auth" failures, ask them to reset and reauthenticate from the repo screen.

Pulling and resolving conflicts:
- Call pull_changes when the user asks to pull, or to recover from a sha_mismatch on push. It only marks conflicts; it never overwrites a locally-modified file.
- For each conflict path: read_file (local edits) and read_remote_file (current remote) to see both sides, propose a merge to the user, wait for confirmation, then call resolve_conflict(path, merged_content). resolve_conflict syncs the manifest sha to the remote so the follow-up push_changes succeeds.
- For files larger than ~200 lines: do NOT assume read_remote_file gave you the whole file. The header tells you total line count; if it shows "[+N more lines not shown...]" you only have a chunk. Either page through with offset (read_remote_file(path, offset=201)…) until you reach the end and reconstruct the remote in your head, or use grep_file on the local copy to find the lines you care about and read_remote_file those specific ranges. Passing a partial remote into resolve_conflict will silently delete the bottom of the file.
- "Take remote" = pass the full remote content to resolve_conflict. "Take local" = pass the local content. A real merge = combine them line by line.`;

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_AGENT_ITERATIONS = 20;

// Defaults for the line-ranged read_file / read_remote_file. Picked so a
// 200-line read of typical code (~80-char lines) lands well under the
// tool-result cap, even with line-number prefixes.
const READ_FILE_DEFAULT_LIMIT = 200;
const READ_FILE_MAX_LIMIT = 2000;
const READ_FILE_MAX_LINE_LEN = 800;
const GREP_DEFAULT_MAX_RESULTS = 50;
const GREP_MAX_LINE_LEN = 600;

// Shared line-ranged formatter used by read_file and read_remote_file.
// Returns a string ready to be a tool_result.content. Format:
//
//   <Label>: <path>  (123 lines, showing 50-100)
//
//      50→content of line 50
//      51→content of line 51
//      …
//     100→content of line 100
//
//   [+23 more lines not shown. Continue with <toolName>(path="<path>", offset=101)]
//
// Long lines (> READ_FILE_MAX_LINE_LEN) are truncated with a marker so a
// single 50KB minified line can't blow up the result.
function formatLineRange(opts: {
  label: string;          // "File" for local, "Remote" for remote
  path: string;
  raw: string;
  offset: number;         // 1-indexed
  limit: number;
  toolName: string;       // for the "Continue with X(...)" footer
}): string {
  const { label, path, raw, offset, limit, toolName } = opts;
  const allLines = raw.split('\n');
  const totalLines = allLines.length;
  const startIdx = offset - 1;

  if (startIdx >= totalLines) {
    return (
      `${label}: ${path} (${totalLines} line${totalLines === 1 ? '' : 's'})\n\n` +
      `[offset ${offset} is past end of file]`
    );
  }

  const endIdx = Math.min(startIdx + limit, totalLines);
  const slice = allLines.slice(startIdx, endIdx);
  const numWidth = String(endIdx).length;

  const formatted = slice.map((line, i) => {
    const num = String(startIdx + 1 + i).padStart(numWidth, ' ');
    const truncated = line.length > READ_FILE_MAX_LINE_LEN
      ? line.slice(0, READ_FILE_MAX_LINE_LEN) + '… [line truncated]'
      : line;
    return `${num}→${truncated}`;
  }).join('\n');

  const header =
    `${label}: ${path}  (${totalLines} line${totalLines === 1 ? '' : 's'}, showing ${offset}-${endIdx})`;
  let footer = '';
  if (endIdx < totalLines) {
    const remaining = totalLines - endIdx;
    footer =
      `\n\n[+${remaining} more line${remaining === 1 ? '' : 's'} not shown. ` +
      `Continue with ${toolName}(path="${path}", offset=${endIdx + 1})]`;
  }

  return `${header}\n\n${formatted}${footer}`;
}

const FILE_TOOL_DEFS: ToolDefinition[] = [
  {
    name: 'list_directory',
    description:
      'List files and subdirectories at a given path inside the working repo. Path is relative to repo root. Use empty string or "." for repo root.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to repo root' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description:
      'Read a range of lines from a text file. Returns line-numbered content (e.g. `   42→const x = 1`). For large files, prefer grep_file to locate the section you care about, then call read_file with offset/limit to load just that range. Defaults read the first 200 lines; if the file has more, the tool tells you how many remain and what offset to use to continue.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to repo root' },
        offset: {
          type: 'number',
          description:
            '1-indexed line number to start reading from. Default 1.',
        },
        limit: {
          type: 'number',
          description:
            'Number of lines to read. Default 200, max 2000. Lines longer than 800 chars are truncated with an ellipsis.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'grep_file',
    description:
      'Search for a literal substring inside a single file and return matching lines with their line numbers. Cheaper than read_file for finding a known symbol/string in a large file. Once you find the line numbers you care about, use read_file with offset/limit to load the surrounding context.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to repo root' },
        pattern: {
          type: 'string',
          description: 'Literal substring to search for (not regex).',
        },
        ignore_case: {
          type: 'boolean',
          description: 'Case-insensitive match. Default false.',
        },
        max_results: {
          type: 'number',
          description: `Cap on returned matches. Default ${GREP_DEFAULT_MAX_RESULTS}.`,
        },
      },
      required: ['path', 'pattern'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a text file. Path is relative to repo root.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to repo root' },
        content: { type: 'string', description: 'Full file contents' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'push_changes',
    description:
      'Commit and push every locally-modified file to GitHub on the current branch. Returns the count pushed and a list of any per-file failures (sha_mismatch, branch_protected, auth, not_found, other). Only call when the user explicitly asks to push or commit.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description:
            'Commit message. If omitted, a default of "msc: agent commit" is used.',
        },
      },
    },
  },
  {
    name: 'pull_changes',
    description:
      'Pull from GitHub: fetch the remote tree and update local copies of files that were not modified locally. Files modified both locally and on remote are returned as conflicts; their local copies are left untouched. After this call, resolve each conflict with read_remote_file + resolve_conflict.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'read_remote_file',
    description:
      'Fetch the current contents of a file as it exists on the remote branch right now. Does not modify the local copy. Returns line-numbered output and supports `offset`/`limit` exactly like read_file — for large remote files during conflict resolution, page through with offset/limit (and use grep_file on the local copy first to find the lines you care about). Path is relative to repo root.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to repo root' },
        offset: {
          type: 'number',
          description:
            '1-indexed line number to start reading from. Default 1.',
        },
        limit: {
          type: 'number',
          description:
            'Number of lines to read. Default 200, max 2000. Long lines are truncated.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'resolve_conflict',
    description:
      'Mark a conflicted file resolved: writes the merged content locally, syncs the manifest sha to the latest remote sha (so the next push_changes uses it as the parent), and marks the file as modified so it gets included in the next push. Call only after merging the remote and local versions.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to repo root' },
        content: {
          type: 'string',
          description: 'Final merged file contents to write locally',
        },
      },
      required: ['path', 'content'],
    },
  },
];

const ISSUE_TOOL_DEFS: ToolDefinition[] = [
  {
    name: 'read_issue',
    description:
      'Fetch a GitHub issue body and its comments. With no arguments, reads the issue linked to the current task (recommended once at the start of work, then rely on memory). Pass `number` to read a different referenced issue.',
    input_schema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Issue number. Optional; defaults to the linked issue.',
        },
      },
    },
  },
  {
    name: 'comment_on_issue',
    description:
      'Post a comment on a GitHub issue. Use to record progress, decisions, or open questions back to the linked issue. With no `number`, comments on the linked issue.',
    input_schema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Issue number. Optional; defaults to the linked issue.',
        },
        body: {
          type: 'string',
          description: 'Markdown body of the comment.',
        },
      },
      required: ['body'],
    },
  },
];

// Compose the per-run tool list and system prompt. When the active task has a
// linked issue we expose the issue tools and tell Claude to read it on demand.
export function buildToolDefs(linkedIssue: LinkedIssue | null): ToolDefinition[] {
  return linkedIssue ? [...FILE_TOOL_DEFS, ...ISSUE_TOOL_DEFS] : FILE_TOOL_DEFS;
}

export function buildSystemPrompt(
  linkedIssue: LinkedIssue | null,
  projectInstructions: ProjectInstructions | null,
): string {
  let prompt = BASE_SYSTEM_PROMPT;
  if (projectInstructions) {
    prompt += `\n\n## Project instructions (from ${projectInstructions.source})

This repository ships a ${projectInstructions.source} with conventions and guidance specific to this project. Follow it when it applies; defer to user instructions when they conflict.

${projectInstructions.content}`;
  }
  if (linkedIssue) {
    prompt += `\n\nActive task is linked to GitHub issue #${linkedIssue.number}: "${linkedIssue.title}". On your first turn (or when the user asks for context), call read_issue() to fetch the body and comments. Don't keep the issue body in conversation; rely on read_issue when you need to recheck.`;
  }
  return prompt;
}

export type RunToolContext = {
  manifest: Manifest;
  pat: string | null;
  linkedIssue: LinkedIssue | null;
};

export async function runTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: RunToolContext,
): Promise<{ result: string; manifestChanged: boolean }> {
  const root = repoDir(ctx.manifest.repo);

  switch (toolName) {
    case 'list_directory': {
      const rel = (input.path as string) || '';
      const abs = root + rel;
      const entries = await listDir(abs);
      const filtered = entries.filter((e) => !isMscMetaFile(e));
      const annotated = await Promise.all(
        filtered.map(async (name) => {
          const child = (abs.endsWith('/') ? abs : abs + '/') + name;
          const dir = await isDirectory(child);
          return dir ? `${name}/` : name;
        }),
      );
      return {
        result:
          annotated.length === 0
            ? '(empty directory)'
            : annotated.sort().join('\n'),
        manifestChanged: false,
      };
    }
    case 'read_file': {
      const rel = (input.path as string).replace(/^\/+/, '');
      const offsetIn = (input.offset as number | undefined) ?? 1;
      const limitIn = (input.limit as number | undefined) ?? READ_FILE_DEFAULT_LIMIT;
      const offset = Math.max(1, Math.floor(offsetIn));
      const limit = Math.max(1, Math.min(READ_FILE_MAX_LIMIT, Math.floor(limitIn)));

      let raw: string;
      try {
        raw = await readText(root + rel);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'read failed';
        throw new Error(`read_file('${rel}'): ${msg}`);
      }

      return {
        result: formatLineRange({
          label: 'File',
          path: rel, raw, offset, limit, toolName: 'read_file',
        }),
        manifestChanged: false,
      };
    }
    case 'grep_file': {
      const rel = (input.path as string).replace(/^\/+/, '');
      const pattern = input.pattern as string;
      const ignoreCase = (input.ignore_case as boolean | undefined) ?? false;
      const maxResults = Math.max(1, Math.min(
        500,
        (input.max_results as number | undefined) ?? GREP_DEFAULT_MAX_RESULTS,
      ));

      if (!pattern) throw new Error('grep_file: pattern is required');

      let raw: string;
      try {
        raw = await readText(root + rel);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'read failed';
        throw new Error(`grep_file('${rel}'): ${msg}`);
      }

      const needle = ignoreCase ? pattern.toLowerCase() : pattern;
      const allLines = raw.split('\n');
      const matches: { lineNum: number; line: string }[] = [];

      for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        const cmp = ignoreCase ? line.toLowerCase() : line;
        if (cmp.includes(needle)) {
          const truncated = line.length > GREP_MAX_LINE_LEN
            ? line.slice(0, GREP_MAX_LINE_LEN) + '…'
            : line;
          matches.push({ lineNum: i + 1, line: truncated });
          if (matches.length >= maxResults) break;
        }
      }

      if (matches.length === 0) {
        return {
          result: `No matches for "${pattern}" in ${rel} (${allLines.length} line${allLines.length === 1 ? '' : 's'} scanned${ignoreCase ? ', case-insensitive' : ''}).`,
          manifestChanged: false,
        };
      }

      const numWidth = String(matches[matches.length - 1].lineNum).length;
      const formatted = matches.map((m) =>
        `${String(m.lineNum).padStart(numWidth, ' ')}→${m.line}`,
      ).join('\n');

      const cappedNote = matches.length === maxResults
        ? ` (capped at ${maxResults}; raise max_results or grep more narrowly to see all)`
        : '';
      const header =
        `Matches for "${pattern}" in ${rel}: ${matches.length} match${matches.length === 1 ? '' : 'es'}${cappedNote}`;

      return {
        result: `${header}\n\n${formatted}`,
        manifestChanged: false,
      };
    }
    case 'write_file': {
      // Normalize: strip any leading slash. downloadRepo stores manifest
      // keys without leading slash; if the model passes "/foo/bar" we'd
      // store a parallel key with the slash, which then breaks push (the
      // GitHub Contents API URL would have a double slash and 404).
      const rel = (input.path as string).replace(/^\/+/, '');
      const content = input.content as string;
      await writeText(root + rel, content);

      const existing = ctx.manifest.files[rel];
      if (existing) {
        ctx.manifest.files[rel] = { ...existing, modified: true };
      } else {
        ctx.manifest.files[rel] = { sha: null, modified: true };
      }
      return {
        result: `Wrote ${rel} (${content.length} chars).`,
        manifestChanged: true,
      };
    }
    case 'read_issue': {
      if (!ctx.pat) throw new Error('read_issue: no GitHub token configured');
      const num = (input.number as number | undefined) ?? ctx.linkedIssue?.number;
      if (!num) throw new Error('read_issue: no number provided and no issue linked to this task');
      const issue = await getIssue(ctx.pat, ctx.manifest.repo, num);
      const comments = await getIssueComments(ctx.pat, ctx.manifest.repo, num);
      const lines: string[] = [
        `Issue #${issue.number} — ${issue.title}  (${issue.state})`,
        `URL: ${issue.url}`,
        issue.labels.length ? `Labels: ${issue.labels.join(', ')}` : '',
        '',
        '## Body',
        issue.body || '(no body)',
      ];
      if (comments.length) {
        lines.push('', `## Comments (${comments.length})`);
        for (const c of comments) {
          lines.push('', `--- ${c.user} (${c.createdAt}) ---`, c.body);
        }
      }
      return { result: lines.filter((l) => l !== '').join('\n'), manifestChanged: false };
    }
    case 'pull_changes': {
      if (!ctx.pat) throw new Error('pull_changes: no GitHub token configured');
      const r = await pullRepo(ctx.pat, ctx.manifest);
      const lines: string[] = [];
      lines.push(
        `Pulled from ${ctx.manifest.repo} on ${ctx.manifest.branch}.`,
      );
      lines.push(
        `${r.added} added, ${r.updated} updated, ${r.unchanged} unchanged, ` +
        `${r.conflicts.length} conflict${r.conflicts.length === 1 ? '' : 's'}.`,
      );
      if (r.conflicts.length > 0) {
        lines.push('');
        lines.push('Conflicts (modified locally and remotely; local copy kept):');
        for (const p of r.conflicts) lines.push(`- ${p}`);
        lines.push('');
        lines.push(
          'For each conflict: call read_file(path) and read_remote_file(path) ' +
          'to see both sides, decide on a merge, then call ' +
          'resolve_conflict(path, merged_content).',
        );
      }
      return { result: lines.join('\n'), manifestChanged: true };
    }
    case 'read_remote_file': {
      if (!ctx.pat) throw new Error('read_remote_file: no GitHub token configured');
      const rel = (input.path as string).replace(/^\/+/, '');
      const offsetIn = (input.offset as number | undefined) ?? 1;
      const limitIn = (input.limit as number | undefined) ?? READ_FILE_DEFAULT_LIMIT;
      const offset = Math.max(1, Math.floor(offsetIn));
      const limit = Math.max(1, Math.min(READ_FILE_MAX_LIMIT, Math.floor(limitIn)));

      const remote = await getRemoteFile(
        ctx.pat, ctx.manifest.repo, ctx.manifest.branch, rel,
      );
      return {
        result: formatLineRange({
          label: 'Remote',
          path: rel, raw: remote.content, offset, limit, toolName: 'read_remote_file',
        }),
        manifestChanged: false,
      };
    }
    case 'resolve_conflict': {
      if (!ctx.pat) throw new Error('resolve_conflict: no GitHub token configured');
      const rel = (input.path as string).replace(/^\/+/, '');
      const content = input.content as string;
      // Pull the latest remote sha for this file. Using it as the manifest
      // sha means the next push_changes treats the merge commit as a normal
      // update of the current remote — no more sha mismatch.
      const remote = await getRemoteFile(
        ctx.pat, ctx.manifest.repo, ctx.manifest.branch, rel,
      );
      await writeText(repoDir(ctx.manifest.repo) + rel, content);
      ctx.manifest.files[rel] = { sha: remote.sha, modified: true };
      return {
        result:
          `Resolved ${rel}: wrote merged content (${content.length} chars), ` +
          `synced manifest sha to remote (${remote.sha.slice(0, 7)}). ` +
          `Push to commit the merge.`,
        manifestChanged: true,
      };
    }
    case 'push_changes': {
      if (!ctx.pat) throw new Error('push_changes: no GitHub token configured');
      const message = (input.message as string | undefined)?.trim()
        || 'msc: agent commit';
      const r = await pushModifiedFiles(ctx.pat, ctx.manifest, message);
      const lines: string[] = [];
      lines.push(
        `Pushed ${r.pushed} file${r.pushed === 1 ? '' : 's'} ` +
        `to ${ctx.manifest.repo} on ${ctx.manifest.branch}.`,
      );
      if (r.failures.length > 0) {
        lines.push('');
        lines.push(`Failed (${r.failures.length}):`);
        for (const f of r.failures) {
          lines.push(`- ${f.path} [${f.kind}]: ${f.message}`);
        }
        const kinds = new Set(r.failures.map((f) => f.kind));
        if (kinds.has('sha_mismatch')) {
          lines.push('');
          lines.push(
            'Hint: sha_mismatch means our local copy is out of sync with the ' +
            'remote — either the file was modified on the remote since we last ' +
            'pulled, OR the file was created locally with the same path as one ' +
            'that already exists on the remote (no recorded parent sha). Either ' +
            'way the fix is the same: call pull_changes — it will mark the path ' +
            'as a conflict and leave local edits intact. Then read_file + ' +
            'read_remote_file, decide on a merge, call resolve_conflict(path, ' +
            'merged_content), and finally retry push_changes. Do not retry ' +
            'push_changes without a pull + resolve first.',
          );
        }
      }
      // pushModifiedFiles mutates manifest.files in place when it succeeds; flag
      // dirty so the agent driver re-broadcasts the manifest.
      return { result: lines.join('\n'), manifestChanged: r.pushed > 0 };
    }
    case 'comment_on_issue': {
      if (!ctx.pat) throw new Error('comment_on_issue: no GitHub token configured');
      const num = (input.number as number | undefined) ?? ctx.linkedIssue?.number;
      const body = input.body as string;
      if (!num) throw new Error('comment_on_issue: no number provided and no issue linked');
      if (!body || !body.trim()) throw new Error('comment_on_issue: body is required');
      await commentOnIssue(ctx.pat, ctx.manifest.repo, num, body);
      return { result: `Commented on issue #${num}.`, manifestChanged: false };
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (/network|fetch failed|connection|timeout|aborted/i.test(msg)) return true;
  if (/\b(429|500|502|503|504)\b/.test(msg)) return true;
  return false;
}

function getRetryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
}

async function sleep(ms: number, signal: CancelSignal): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (signal.cancelled) throw new Error('Cancelled');
    const remaining = ms - (Date.now() - start);
    await new Promise((resolve) => setTimeout(resolve, Math.min(150, remaining)));
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  onAttempt: (attempt: number, delayMs: number, error: Error | null) => void,
  signal: CancelSignal,
): Promise<T> {
  let attempt = 0;
  while (true) {
    if (signal.cancelled) throw new Error('Cancelled');
    try {
      return await fn();
    } catch (e) {
      if (!isTransientError(e)) throw e;
      attempt++;
      const delay = getRetryDelay(attempt);
      onAttempt(attempt, delay, e instanceof Error ? e : new Error(String(e)));
      await sleep(delay, signal);
    }
  }
}

export type AgentEvent =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'tool_call'; name: string; input: Record<string, unknown> }
  | { kind: 'tool_result'; name: string; result: string; is_error: boolean }
  | { kind: 'context_optimized'; note: string };

export type RunAgentArgs = {
  provider: LLMProvider;
  pat: string | null;
  initialHistory: ChatMessage[];
  manifest: Manifest;
  linkedIssue: LinkedIssue | null;
  onEvent: (e: AgentEvent) => void;
  onManifestUpdate: (m: Manifest) => void;
  onRetry: (status: RetryStatus) => void;
  onCheckpoint: (history: ChatMessage[]) => Promise<void>;
  onComplete: () => Promise<void>;
  signal: CancelSignal;
};

export async function runAgent(args: RunAgentArgs): Promise<ChatMessage[]> {
  let messages = [...args.initialHistory];
  const tools = buildToolDefs(args.linkedIssue);
  // Loaded once per agent run. The system prompt is cached on the API
  // side, so updating CLAUDE.md mid-conversation requires a fresh send to
  // pick up — that's fine: it's a stable per-repo input.
  const projectInstructions = await loadProjectInstructions(args.manifest.repo);
  const systemPrompt = buildSystemPrompt(args.linkedIssue, projectInstructions);
  const toolCtx: RunToolContext = {
    manifest: args.manifest,
    pat: args.pat,
    linkedIssue: args.linkedIssue,
  };

  for (let iter = 0; iter < MAX_AGENT_ITERATIONS; iter++) {
    if (args.signal.cancelled) throw new Error('Cancelled');

    // Self-heal first: strip any tool_use blocks left orphaned in saved
    // history (e.g. from a previous version of the agent loop that didn't
    // filter on stop_reason). Without this, Anthropic 400s on every send
    // until the task's chat is cleared.
    const repaired = repairOrphanToolUses(messages);
    if (repaired.removed > 0) {
      messages = repaired.messages;
      args.onEvent({
        kind: 'context_optimized',
        note: `repaired ${repaired.removed} orphan tool_use block${repaired.removed === 1 ? '' : 's'}`,
      });
    }

    // Cheap, synchronous: drop stale read_file payloads in place.
    const evicted = evictStaleToolResults(messages);
    if (evicted.evicted > 0) {
      messages = evicted.messages;
      args.onEvent({
        kind: 'context_optimized',
        note: `evicted ${evicted.evicted} stale read_file result${evicted.evicted === 1 ? '' : 's'}`,
      });
    }

    // Async, fires only when history grows past the threshold. Summarizes
    // older turns via Haiku and replaces them with a single user/assistant pair.
    const compacted = await maybeCompactHistory(messages, args.provider);
    if (compacted.compacted) {
      messages = compacted.messages;
      args.onEvent({ kind: 'context_optimized', note: compacted.reason });
    }

    await args.onCheckpoint(messages);

    const response = await withRetry(
      () => args.provider.chat(messages, tools, systemPrompt),
      (attempt, delayMs, error) => {
        args.onRetry({
          attempt,
          delayMs,
          error: error?.message ?? 'unknown',
        });
      },
      args.signal,
    );
    args.onRetry(null);

    // Decide whether this iteration's response should drive another tool
    // round. tool_use → always. max_tokens → only when the model already
    // emitted complete tool_use blocks before running out of room (in
    // which case we run them and let the next iteration continue).
    // end_turn / stop_sequence → completion.
    const hasToolUse = response.content.some((b) => b.type === 'tool_use');
    const shouldRunTools =
      response.stop_reason === 'tool_use' ||
      (response.stop_reason === 'max_tokens' && hasToolUse);

    // For non-tool-running stops, defensively strip any orphan tool_use
    // blocks (no tool_result will follow → Anthropic would 400 next call).
    const safeContent = shouldRunTools
      ? response.content
      : response.content.filter((b) => b.type !== 'tool_use');

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: safeContent,
    };
    messages.push(assistantMsg);
    args.onEvent({ kind: 'message', message: assistantMsg });

    // If the response was truncated by the output token cap with no tools to
    // run, the model wasn't intentionally finished — make that visible so
    // the user knows to continue rather than seeing the chat go silent.
    if (response.stop_reason === 'max_tokens' && !hasToolUse) {
      args.onEvent({
        kind: 'context_optimized',
        note: 'response hit max_tokens cap; reply "continue" to extend',
      });
    }

    if (!shouldRunTools) {
      await args.onComplete();
      return messages;
    }

    const toolResults: ToolResultBlock[] = [];
    let manifestDirty = false;

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      args.onEvent({ kind: 'tool_call', name: block.name, input: block.input });
      try {
        const { result, manifestChanged } = await runTool(
          block.name,
          block.input,
          toolCtx,
        );
        if (manifestChanged) manifestDirty = true;
        // Cap the content sent back to the model so a single read of a
        // huge file can't blow up the context. The UI still shows the
        // full result via onEvent below.
        const capped = truncateToolResultContent(result);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: capped,
        });
        args.onEvent({
          kind: 'tool_result',
          name: block.name,
          result,
          is_error: false,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'tool error';
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: msg,
          is_error: true,
        });
        args.onEvent({
          kind: 'tool_result',
          name: block.name,
          result: msg,
          is_error: true,
        });
      }
    }

    if (manifestDirty) {
      await writeManifest(args.manifest);
      args.onManifestUpdate({ ...args.manifest });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  // Hit the iteration cap. Instead of throwing (which the user just sees as
  // a hard error), fire one more API call without tools so the model has to
  // produce a final text response — summarizing what got done and what's
  // pending. The conversation ends cleanly and the user can reply to continue.
  args.onEvent({
    kind: 'context_optimized',
    note: `iteration cap reached (${MAX_AGENT_ITERATIONS}) — generating summary`,
  });

  const wrapUpSystem = systemPrompt + `

[NOTICE: You have reached this turn's tool-call iteration cap. You cannot run any more tools right now. Briefly summarize what you accomplished, what tool calls you ran, and what work still remains. End with a clear next step the user can reply with to continue.]`;

  try {
    const wrapUp = await withRetry(
      () => args.provider.chat(messages, [], wrapUpSystem),
      (attempt, delayMs, error) => {
        args.onRetry({ attempt, delayMs, error: error?.message ?? 'unknown' });
      },
      args.signal,
    );
    args.onRetry(null);

    const summaryMsg: ChatMessage = {
      role: 'assistant',
      // Defensive: even with tools=[], strip any tool_use blocks just in case.
      content: wrapUp.content.filter((b) => b.type !== 'tool_use'),
    };
    messages.push(summaryMsg);
    args.onEvent({ kind: 'message', message: summaryMsg });
  } catch (e) {
    // If even the wrap-up call fails, surface a synthetic message so the
    // user knows what happened and the history isn't left dangling.
    const reason = e instanceof Error ? e.message : 'wrap-up failed';
    const fallback: ChatMessage = {
      role: 'assistant',
      content: `[Reached the ${MAX_AGENT_ITERATIONS}-iteration cap and the summary call also failed (${reason}). Reply to continue from where I left off.]`,
    };
    messages.push(fallback);
    args.onEvent({ kind: 'message', message: fallback });
  }

  await args.onComplete();
  return messages;
}
