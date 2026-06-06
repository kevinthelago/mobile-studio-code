import { ChatMessage, ToolDefinition, AnthropicResponse } from './types';

export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
export const ANTHROPIC_VERIFY_MODEL = 'claude-haiku-4-5-20251001';
export const ANTHROPIC_VERSION = '2023-06-01';

const CACHE_EPHEMERAL = { type: 'ephemeral' } as const;

export async function verifyAnthropicKey(apiKey: string): Promise<void> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_VERIFY_MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });
  if (res.status === 401) throw new Error('Invalid API key (401).');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 120)}`);
  }
}

// Build a messages payload with a cache breakpoint on the last assistant
// **text** block. The next request reuses everything up to and including
// that point as a cache hit, so only the user's new message and the model's
// response are billed at full input price.
//
// Crucially: only mark cache_control on text blocks. Putting cache_control
// on a model-generated tool_use block has been observed to cause 400 errors
// in some configurations, since cache_control adds a non-original field to
// a block whose shape Anthropic round-trips strictly. If the most-recent
// assistant turn has only tool_use blocks (no text), we walk backwards to
// the previous assistant turn that does. If none exists, we skip the
// message-level breakpoint — system + tools breakpoints still give us most
// of the cache savings.
function withMessageCacheBreakpoint(messages: ChatMessage[]): unknown[] {
  let target = -1;
  let textBlockIdx = -1;
  const STRING_SENTINEL = -2;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    if (typeof m.content === 'string') {
      target = i;
      textBlockIdx = STRING_SENTINEL;
      break;
    }
    let lastText = -1;
    for (let j = m.content.length - 1; j >= 0; j--) {
      if (m.content[j].type === 'text') { lastText = j; break; }
    }
    if (lastText !== -1) {
      target = i;
      textBlockIdx = lastText;
      break;
    }
    // tool_use-only assistant turn — keep looking back for a text block.
  }
  if (target === -1) return messages;
  return messages.map((m, i) => {
    if (i !== target) return m;
    if (textBlockIdx === STRING_SENTINEL) {
      return {
        role: m.role,
        content: [{
          type: 'text',
          text: m.content as string,
          cache_control: CACHE_EPHEMERAL,
        }],
      };
    }
    if (typeof m.content === 'string') return m; // unreachable
    return {
      role: m.role,
      content: m.content.map((b, j) =>
        j === textBlockIdx ? { ...b, cache_control: CACHE_EPHEMERAL } : b,
      ),
    };
  });
}

export async function anthropicChat(
  apiKey: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  systemPrompt: string,
  model: string = ANTHROPIC_MODEL,
): Promise<AnthropicResponse> {
  // Three cache breakpoints: system prompt, last tool def (covers all tools),
  // and last assistant turn in history. After the first call within a 5-minute
  // window, all three prefixes are 90% cheaper on input tokens.
  const systemBlocks = [
    { type: 'text' as const, text: systemPrompt, cache_control: CACHE_EPHEMERAL },
  ];
  const cachedTools = tools.map((tool, i) =>
    i === tools.length - 1 ? { ...tool, cache_control: CACHE_EPHEMERAL } : tool,
  );

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      // 8192: most responses fit in one call. Below 8K, long tool-using
      // turns hit max_tokens and the agent loop terminates mid-flight.
      max_tokens: 8192,
      system: systemBlocks,
      tools: cachedTools,
      messages: withMessageCacheBreakpoint(messages),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  return (await res.json()) as AnthropicResponse;
}

// Lightweight Haiku call for short-form generation (commit messages, summaries).
// Used by both the Git-page Draft button and the agent-loop history compactor.
export async function anthropicComplete(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 200,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_VERIFY_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 120)}`);
  }
  const body = (await res.json()) as {
    content: { type: string; text?: string }[];
  };
  return body.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}

