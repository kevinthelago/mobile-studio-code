import {
  ChatMessage, ContentBlock, ToolDefinition, ImageBlock,
} from '../types';
import { LLMResponse } from './types';
import { asBlocks } from './canonical';

/**
 * Translation between the canonical Anthropic-shaped format and Google's Gemini
 * `generateContent` format. Gemini diverges enough from the OpenAI shape to
 * warrant its own module:
 *   - roles are `user` / `model` (not `assistant`)
 *   - tool calls/results are `functionCall` / `functionResponse` parts
 *   - crucially, `functionResponse` keys on the function **name**, not a call
 *     id — so we resolve tool_use_id → name from the assistant history.
 *   - tool calls have no id in the response, so we synthesize stable ones.
 */

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

export type GeminiBody = {
  systemInstruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
  tools?: { functionDeclarations: { name: string; description: string; parameters: object }[] }[];
  generationConfig?: { maxOutputTokens?: number };
};

export type GeminiResponse = {
  responseId?: string;
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
};

// ── Encode: canonical → Gemini ───────────────────────────────────────────────

function imageInlineData(b: ImageBlock): GeminiPart {
  return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
}

/** Map every tool_use id seen in assistant turns to its tool name. */
function toolUseNames(messages: ChatMessage[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of messages) {
    if (m.role !== 'assistant' || typeof m.content === 'string') continue;
    for (const b of m.content) {
      if (b.type === 'tool_use') map[b.id] = b.name;
    }
  }
  return map;
}

function encodeParts(
  blocks: ContentBlock[],
  idToName: Record<string, string>,
): GeminiPart[] {
  const parts: GeminiPart[] = [];
  for (const b of blocks) {
    if (b.type === 'text') parts.push({ text: b.text });
    else if (b.type === 'image') parts.push(imageInlineData(b));
    else if (b.type === 'tool_use') {
      parts.push({ functionCall: { name: b.name, args: b.input ?? {} } });
    } else if (b.type === 'tool_result') {
      const name = idToName[b.tool_use_id] ?? b.tool_use_id;
      parts.push({
        functionResponse: {
          name,
          response: b.is_error ? { error: b.content } : { result: b.content },
        },
      });
    }
  }
  return parts;
}

export function buildGeminiBody(args: {
  systemPrompt: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  maxTokens?: number;
}): GeminiBody {
  const idToName = toolUseNames(args.messages);
  const contents: GeminiContent[] = [];
  for (const m of args.messages) {
    const parts = encodeParts(asBlocks(m.content), idToName);
    if (parts.length) {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
    }
  }

  const body: GeminiBody = { contents };
  if (args.systemPrompt) body.systemInstruction = { parts: [{ text: args.systemPrompt }] };
  if (args.tools.length) {
    body.tools = [{
      functionDeclarations: args.tools.map((t) => ({
        name: t.name, description: t.description, parameters: t.input_schema,
      })),
    }];
  }
  if (args.maxTokens) body.generationConfig = { maxOutputTokens: args.maxTokens };
  return body;
}

// ── Decode: Gemini → canonical ───────────────────────────────────────────────

function mapGeminiFinish(reason: string | undefined): LLMResponse['stop_reason'] {
  switch (reason) {
    case 'MAX_TOKENS': return 'max_tokens';
    case 'STOP': return 'end_turn';
    default: return 'end_turn';
  }
}

export function parseGeminiResponse(json: GeminiResponse): LLMResponse {
  const candidate = json.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const content: ContentBlock[] = [];
  let fnIndex = 0;
  let hasFunctionCall = false;

  for (const p of parts) {
    if ('text' in p && p.text) {
      content.push({ type: 'text', text: p.text });
    } else if ('functionCall' in p) {
      hasFunctionCall = true;
      // Gemini gives no call id; synthesize a stable one so the agent loop can
      // pair the tool_result back to it (re-encoded by name on the next turn).
      content.push({
        type: 'tool_use',
        id: `gemini_${p.functionCall.name}_${fnIndex++}`,
        name: p.functionCall.name,
        input: p.functionCall.args ?? {},
      });
    }
  }

  return {
    id: json.responseId ?? '',
    content,
    stop_reason: hasFunctionCall ? 'tool_use' : mapGeminiFinish(candidate?.finishReason),
  };
}
