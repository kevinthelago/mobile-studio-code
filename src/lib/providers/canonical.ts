import {
  ChatMessage, ContentBlock, ToolResultBlock, ToolUseBlock,
} from '../types';
import { LLMResponse } from './types';

/**
 * The canonical request/response contract every provider adapter implements.
 *
 * The agent loop (`agent.ts`) is written against the Anthropic content-block
 * format, so that *is* the canonical wire format:
 *
 *   - Requests are `ChatMessage[]` whose content is a string or `ContentBlock[]`
 *     (`text` | `image` | `tool_use` | `tool_result`), plus a separate system
 *     prompt and `ToolDefinition[]`.
 *   - Responses are `LLMResponse` = `{ content: ContentBlock[]; stop_reason }`,
 *     where tool requests surface as `tool_use` blocks and `stop_reason` is one
 *     of Anthropic's values (`tool_use` | `end_turn` | `max_tokens` | …).
 *
 * The Anthropic adapter passes this through untouched. Non-Anthropic adapters
 * (M1c–M1f) translate canonical ⇄ native in their own modules (e.g.
 * `openaiFormat.ts`) and MUST return responses in this exact shape so the agent
 * loop stays provider-agnostic. The helpers below are the supported way to read
 * a response and build the tool-result turn that follows it.
 */

/** Tool-use blocks the model emitted this turn (the calls to execute). */
export function getToolUses(res: LLMResponse): ToolUseBlock[] {
  return res.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
}

/** Concatenated assistant text from a response (ignores tool_use blocks). */
export function getResponseText(res: LLMResponse): string {
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('');
}

export function toolResultBlock(
  toolUseId: string,
  content: string,
  isError = false,
): ToolResultBlock {
  return isError
    ? { type: 'tool_result', tool_use_id: toolUseId, content, is_error: true }
    : { type: 'tool_result', tool_use_id: toolUseId, content };
}

/** The user-role message carrying tool results back to the model. */
export function toolResultsMessage(results: ToolResultBlock[]): ChatMessage {
  return { role: 'user', content: results };
}

/** Normalize a message's content to a block array for uniform iteration. */
export function asBlocks(content: ChatMessage['content']): ContentBlock[] {
  return typeof content === 'string'
    ? [{ type: 'text', text: content }]
    : content;
}
