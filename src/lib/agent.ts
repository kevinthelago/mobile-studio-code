import {
  ChatMessage, LinkedIssue, Manifest, ToolDefinition, ToolResultBlock,
  RetryStatus, CancelSignal,
} from './types';
import { anthropicChat } from './anthropic';
import {
  repoDir, listDir, readText, writeText, isDirectory, isMscMetaFile,
  writeManifest,
} from './fs';
import { evictStaleToolResults, maybeCompactHistory } from './contextOptimizer';
import { commentOnIssue, getIssue, getIssueComments } from './github';

const BASE_SYSTEM_PROMPT = `You are an AI coding assistant integrated into Mobile Studio Code, a mobile IDE running on iOS. You have tools to read and modify files in the user's local working copy of their git repository. After tool calls, briefly summarize what you did. Be concise; the user is on a phone.

You also have access to optimization context:
- Older turns may be auto-summarized; if you need detail from earlier, ask the user to clarify.
- read_file results may be evicted with a stale marker if a file changed later — do NOT re-read; scroll forward in the conversation for the live copy.
- When a task is linked to a GitHub issue, read it once at the start with read_issue rather than asking the user to paste the body.`;

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_AGENT_ITERATIONS = 25;

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
      'Read the full contents of a text file. Path is relative to repo root.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to repo root' },
      },
      required: ['path'],
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

export function buildSystemPrompt(linkedIssue: LinkedIssue | null): string {
  if (!linkedIssue) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}

Active task is linked to GitHub issue #${linkedIssue.number}: "${linkedIssue.title}". On your first turn (or when the user asks for context), call read_issue() to fetch the body and comments. Don't keep the issue body in conversation; rely on read_issue when you need to recheck.`;
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
      const rel = input.path as string;
      try {
        const content = await readText(root + rel);
        return { result: content, manifestChanged: false };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'read failed';
        throw new Error(`read_file('${rel}'): ${msg}`);
      }
    }
    case 'write_file': {
      const rel = input.path as string;
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
        `Issue #${issue.number} â ${issue.title}  (${issue.state})`,
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
  apiKey: string;
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
  const systemPrompt = buildSystemPrompt(args.linkedIssue);
  const toolCtx: RunToolContext = {
    manifest: args.manifest,
    pat: args.pat,
    linkedIssue: args.linkedIssue,
  };

  for (let iter = 0; iter < MAX_AGENT_ITERATIONS; iter++) {
    if (args.signal.cancelled) throw new Error('Cancelled');

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
    const compacted = await maybeCompactHistory(messages, args.apiKey);
    if (compacted.compacted) {
      messages = compacted.messages;
      args.onEvent({ kind: 'context_optimized', note: compacted.reason });
    }

    await args.onCheckpoint(messages);

    const response = await withRetry(
      () => anthropicChat(args.apiKey, messages, tools, systemPrompt),
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

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: response.content,
    };
    messages.push(assistantMsg);
    args.onEvent({ kind: 'message', message: assistantMsg });

    if (response.stop_reason !== 'tool_use') {
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
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
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

  await args.onComplete();
  throw new Error('Agent exceeded max iterations.');
}
