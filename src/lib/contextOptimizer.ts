import { ChatMessage, ContentBlock, ToolUseBlock, ToolResultBlock } from './types';
import { LLMProvider } from './providers';

// Rough char→token conversion. 1 token ≈ 4 chars for English code/prose.
// Lowered from 60K — at 60K we sometimes couldn't compact within a single
// agent turn (no user-text boundary) and the message would 400 on the next
// request. 30K leaves enough headroom to still fire most rounds.
const COMPACT_THRESHOLD_CHARS = 30_000;
const COMPACT_KEEP_USER_TURNS = 2;

// Hard cap on a single tool_result's content. Raised from 8K → 32K so that:
//   - read_file with the default 200-line limit fits without clipping the
//     "continue with offset=N+1" footer (which clipping would silently break)
//   - read_remote_file can return a meaningful chunk during conflict
//     resolution instead of a truncated head that fools the merger
// Tools that return content of bounded size (read_file, read_remote_file,
// grep_file) now self-bound via offset/limit/max_results — this cap is the
// last-line defense for tools that don't (e.g. list_directory of a huge dir).
const MAX_TOOL_RESULT_CHARS = 32_000;
const TRUNCATION_NOTE = '\n\n[…result truncated; re-read with a more specific path or smaller limit]';

// IMPORTANT: this message must NOT invite the model to re-read. Earlier
// wording ("re-read with read_file if you need the current contents") caused
// loops: the model saw the stub on an older read, re-read the file, which
// turned the previous current read into a stub, which the model then saw and
// re-read again. Tell the model the current contents are already in context.
const STALE_READ_STUB = '[older read superseded — this file was read again later in this conversation. The current contents are in that more recent read_file result. Do not re-read; scroll forward in the conversation for the live copy.]';

// Truncate a single tool_result content block to MAX_TOOL_RESULT_CHARS.
// Pure: returns possibly-new string; original unchanged.
export function truncateToolResultContent(content: string): string {
  if (content.length <= MAX_TOOL_RESULT_CHARS) return content;
  return content.slice(0, MAX_TOOL_RESULT_CHARS) + TRUNCATION_NOTE;
}

// Self-heal: drop tool_use blocks that don't have a matching tool_result in
// the following user message. Such orphans cause Anthropic to 400 with
// "messages.N: tool_use must be followed by tool_result". They can creep
// into history if a previous version of the agent loop persisted a tool_use
// the model emitted alongside an end_turn, or if a process died between
// pushing the assistant turn and the user-tool_results turn.
//
// Pure: returns a possibly-new array; original unchanged.
export function repairOrphanToolUses(messages: ChatMessage[]): {
  messages: ChatMessage[];
  removed: number;
} {
  let removed = 0;
  const out = messages.map((msg, i) => {
    if (msg.role !== 'assistant' || typeof msg.content === 'string') return msg;
    if (!msg.content.some((b) => b.type === 'tool_use')) return msg;

    // Collect tool_result ids from the very next message, if user.
    const next = messages[i + 1];
    const followingResultIds = new Set<string>();
    if (next && next.role === 'user' && Array.isArray(next.content)) {
      for (const b of next.content) {
        if (b.type === 'tool_result') followingResultIds.add(b.tool_use_id);
      }
    }

    const filtered = msg.content.filter((b) => {
      if (b.type !== 'tool_use') return true;
      if (followingResultIds.has(b.id)) return true;
      removed++;
      return false;
    });
    if (filtered.length === msg.content.length) return msg;
    return { ...msg, content: filtered };
  });
  return { messages: out, removed };
}

export function approxMessagesSize(messages: ChatMessage[]): number {
  return JSON.stringify(messages).length;
}

// Default limit for read_file when the model omits it. Must stay in sync
// with READ_FILE_DEFAULT_LIMIT in agent.ts — duplicated here to avoid a
// circular import (agent imports this module).
const READ_FILE_DEFAULT_LIMIT = 200;

// Walk messages and replace stale read_file results with a stub. A read_file
// result is "stale" only when a later call makes its content redundant:
//   - a write_file to the same path (file content may have changed), OR
//   - another read_file to the same path whose [offset, offset+limit) range
//     fully covers this read's range (so the later read is a strict superset).
//
// Crucially, two read_file calls for DIFFERENT chunks of the same file (e.g.
// lines 1-25 then lines 70-300 of a paged read) MUST NOT invalidate each
// other — they're complementary. The earlier "any later call" rule caused an
// infinite loop: each new chunk turned the previous chunk into a stub, which
// the model then re-fetched, evicting the new chunk in turn, ad infinitum.
//
// Pure: returns a new messages array; does not mutate input.
export function evictStaleToolResults(messages: ChatMessage[]): {
  messages: ChatMessage[];
  evicted: number;
} {
  type Entry = {
    id: string;
    name: 'read_file' | 'write_file';
    path: string;
    start?: number; // 1-indexed inclusive — read_file only
    end?: number;   // 1-indexed inclusive — read_file only
  };
  const calls: Entry[] = [];

  messages.forEach((msg) => {
    if (msg.role !== 'assistant' || typeof msg.content === 'string') return;
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue;
      const input = block.input as {
        path?: string; offset?: number; limit?: number;
      };
      const path = input.path;
      if (typeof path !== 'string') continue;
      if (block.name === 'write_file') {
        calls.push({ id: block.id, name: 'write_file', path });
      } else if (block.name === 'read_file') {
        const offset = typeof input.offset === 'number'
          ? Math.max(1, Math.floor(input.offset)) : 1;
        const limit = typeof input.limit === 'number'
          ? Math.max(1, Math.floor(input.limit)) : READ_FILE_DEFAULT_LIMIT;
        calls.push({
          id: block.id, name: 'read_file', path,
          start: offset, end: offset + limit - 1,
        });
      }
    }
  });

  const staleIds = new Set<string>();
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    if (c.name !== 'read_file') continue;
    for (let j = i + 1; j < calls.length; j++) {
      const later = calls[j];
      if (later.path !== c.path) continue;
      if (later.name === 'write_file') {
        staleIds.add(c.id);
        break;
      }
      // read_file: only stale if the later range fully covers this one.
      if (later.start !== undefined && later.end !== undefined &&
          c.start !== undefined && c.end !== undefined &&
          later.start <= c.start && later.end >= c.end) {
        staleIds.add(c.id);
        break;
      }
    }
  }

  if (staleIds.size === 0) return { messages, evicted: 0 };

  let evicted = 0;
  const out = messages.map((msg) => {
    if (msg.role !== 'user' || typeof msg.content === 'string') return msg;
    const newContent: ContentBlock[] = msg.content.map((block) => {
      if (block.type !== 'tool_result') return block;
      if (!staleIds.has(block.tool_use_id)) return block;
      if (block.content === STALE_READ_STUB) return block; // already evicted
      evicted++;
      return { ...block, content: STALE_READ_STUB };
    });
    return { ...msg, content: newContent };
  });

  return { messages: out, evicted };
}

// Find the cut index that keeps the last N text-only user messages plus
// everything after them. Returns -1 if no safe cut exists (too few user
// messages, or all user messages are tool_results).
function findCompactionCut(messages: ChatMessage[], keepLast: number): number {
  const userTextIndices: number[] = [];
  messages.forEach((m, i) => {
    if (m.role === 'user' && typeof m.content === 'string') {
      userTextIndices.push(i);
    }
  });
  if (userTextIndices.length <= keepLast) return -1;
  return userTextIndices[userTextIndices.length - keepLast];
}

function summarizableText(messages: ChatMessage[]): string {
  // Compress to a plain transcript for the summarizer. Skip raw tool_use IDs
  // and binary blobs; keep the human-readable signal.
  const lines: string[] = [];
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      lines.push(`${msg.role.toUpperCase()}: ${msg.content}`);
      continue;
    }
    for (const block of msg.content) {
      if (block.type === 'text') {
        lines.push(`${msg.role.toUpperCase()}: ${block.text}`);
      } else if (block.type === 'tool_use') {
        const u = block as ToolUseBlock;
        const path = (u.input as { path?: string }).path ?? '';
        lines.push(`TOOL_CALL: ${u.name}(${path})`);
      } else if (block.type === 'tool_result') {
        const r = block as ToolResultBlock;
        const head = r.content.slice(0, 400);
        lines.push(`TOOL_RESULT: ${head}${r.content.length > 400 ? '…' : ''}`);
      }
    }
  }
  return lines.join('\n');
}

const COMPACT_SYSTEM = `You are a conversation summarizer for a mobile coding assistant. Summarize the prior conversation between a user and the assistant. Focus on:
- What the user is trying to accomplish (the goal)
- Key decisions made
- Files that were read or modified, and why
- Any open questions or TODOs
Be concise (under 200 words) but preserve enough detail that another assistant could pick up where this left off without re-reading the original turns.`;

// Compact older history into a single synthesized user/assistant pair when the
// conversation exceeds the threshold. Uses Haiku for the summary call.
//
// Returns the (possibly unchanged) messages array, plus a flag indicating
// whether compaction happened so the caller can surface UI feedback.
export async function maybeCompactHistory(
  messages: ChatMessage[],
  provider: LLMProvider,
): Promise<{ messages: ChatMessage[]; compacted: boolean; reason: string }> {
  const size = approxMessagesSize(messages);
  if (size < COMPACT_THRESHOLD_CHARS) {
    return { messages, compacted: false, reason: 'under threshold' };
  }
  const cut = findCompactionCut(messages, COMPACT_KEEP_USER_TURNS);
  if (cut <= 0) {
    return { messages, compacted: false, reason: 'no safe cut point' };
  }

  const prefix = messages.slice(0, cut);
  const tail = messages.slice(cut);
  const transcript = summarizableText(prefix);
  let summary: string;
  try {
    summary = await provider.complete(COMPACT_SYSTEM, transcript, 400);
  } catch {
    // If the summarizer fails, return the original messages — better to pay
    // for a long turn than to lose context.
    return { messages, compacted: false, reason: 'summarizer failed' };
  }

  const synthUser: ChatMessage = {
    role: 'user',
    content:
      `[Earlier in this task — auto-compacted summary, ${prefix.length} prior turns]:\n\n${summary}`,
  };
  const synthAssistant: ChatMessage = {
    role: 'assistant',
    content: 'Acknowledged. Continuing from the summary above.',
  };

  return {
    messages: [synthUser, synthAssistant, ...tail],
    compacted: true,
    reason: `compacted ${prefix.length} → 2 turns (${size.toLocaleString()} chars)`,
  };
}
