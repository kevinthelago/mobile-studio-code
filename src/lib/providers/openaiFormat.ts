import {
  ChatMessage, ContentBlock, ToolDefinition, ImageBlock,
} from '../types';
import { LLMResponse } from './types';
import { asBlocks } from './canonical';

/**
 * Translation between the canonical Anthropic-shaped format and the OpenAI
 * Chat Completions format. OpenAI, xAI (Grok), and Ollama all expose this same
 * wire shape, so M1c / M1e / M1f adapters build on these two pure functions.
 *
 * The mapping in brief:
 *   - tools:        Anthropic {name, description, input_schema}
 *                 → OpenAI   {type:'function', function:{name, description, parameters}}
 *   - tool_use:     assistant content block → message.tool_calls[]
 *   - tool_result:  user content block      → a standalone {role:'tool'} message
 *   - images:       {source:{base64}}       → {type:'image_url', image_url:{url: data URI}}
 *   - finish_reason 'tool_calls'|'stop'|'length' → stop_reason 'tool_use'|'end_turn'|'max_tokens'
 */

// ── OpenAI wire types (minimal) ──────────────────────────────────────────────

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OpenAIContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type OpenAIChatBody = {
  model: string;
  max_tokens: number;
  messages: OpenAIMessage[];
  tools?: { type: 'function'; function: { name: string; description: string; parameters: object } }[];
};

export type OpenAIChatResponse = {
  id?: string;
  choices?: {
    message?: { content?: string | null; tool_calls?: OpenAIToolCall[] };
    finish_reason?: string;
  }[];
};

// ── Encode: canonical → OpenAI ───────────────────────────────────────────────

function imageDataUri(block: ImageBlock): string {
  return `data:${block.source.media_type};base64,${block.source.data}`;
}

/** Convert non-tool blocks (text/image) into OpenAI content parts. */
function toContentParts(blocks: ContentBlock[]): OpenAIContentPart[] {
  const parts: OpenAIContentPart[] = [];
  for (const b of blocks) {
    if (b.type === 'text') parts.push({ type: 'text', text: b.text });
    else if (b.type === 'image') parts.push({ type: 'image_url', image_url: { url: imageDataUri(b) } });
  }
  return parts;
}

function encodeUserMessage(content: ChatMessage['content'], out: OpenAIMessage[]): void {
  const blocks = asBlocks(content);
  // tool_result blocks become standalone {role:'tool'} messages…
  for (const b of blocks) {
    if (b.type === 'tool_result') {
      out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.content });
    }
  }
  // …and any text/image in the same turn becomes a following user message.
  const parts = toContentParts(blocks);
  if (parts.length > 0) {
    const onlyText = parts.length === 1 && parts[0].type === 'text';
    out.push({
      role: 'user',
      content: onlyText ? (parts[0] as { text: string }).text : parts,
    });
  }
}

function encodeAssistantMessage(content: ChatMessage['content'], out: OpenAIMessage[]): void {
  if (typeof content === 'string') {
    out.push({ role: 'assistant', content });
    return;
  }
  let text = '';
  const toolCalls: OpenAIToolCall[] = [];
  for (const b of content) {
    if (b.type === 'text') text += b.text;
    else if (b.type === 'tool_use') {
      toolCalls.push({
        id: b.id,
        type: 'function',
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      });
    }
  }
  out.push({
    role: 'assistant',
    content: text || null,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  });
}

export function buildOpenAIBody(args: {
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  maxTokens?: number;
}): OpenAIChatBody {
  const messages: OpenAIMessage[] = [];
  if (args.systemPrompt) messages.push({ role: 'system', content: args.systemPrompt });

  for (const m of args.messages) {
    if (m.role === 'assistant') encodeAssistantMessage(m.content, messages);
    else encodeUserMessage(m.content, messages);
  }

  const body: OpenAIChatBody = {
    model: args.model,
    max_tokens: args.maxTokens ?? 8192,
    messages,
  };
  if (args.tools.length) {
    body.tools = args.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
  }
  return body;
}

// ── Decode: OpenAI → canonical ───────────────────────────────────────────────

function mapFinishReason(reason: string | undefined): LLMResponse['stop_reason'] {
  switch (reason) {
    case 'tool_calls': return 'tool_use';
    case 'length': return 'max_tokens';
    case 'stop': return 'end_turn';
    default: return 'end_turn';
  }
}

export function parseOpenAIResponse(json: OpenAIChatResponse): LLMResponse {
  const choice = json.choices?.[0];
  const msg = choice?.message;
  const content: ContentBlock[] = [];

  if (msg?.content) content.push({ type: 'text', text: msg.content });

  for (const call of msg?.tool_calls ?? []) {
    let input: Record<string, unknown> = {};
    try {
      input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    } catch {
      // Malformed JSON args — surface raw so the tool runner can error clearly.
      input = { __raw: call.function.arguments };
    }
    content.push({ type: 'tool_use', id: call.id, name: call.function.name, input });
  }

  return {
    id: json.id ?? '',
    content,
    stop_reason: mapFinishReason(choice?.finish_reason),
  };
}
