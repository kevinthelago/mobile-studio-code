import { ChatMessage, ToolDefinition, AnthropicResponse } from '../types';

/**
 * Canonical, agent-facing response shape. For now this is the Anthropic
 * content-block format (`AnthropicResponse`), which the agent loop in
 * `agent.ts` consumes directly. When non-Anthropic adapters land (M1b), each
 * provider normalizes its native response into this shape so the agent loop
 * stays provider-agnostic.
 */
export type LLMResponse = AnthropicResponse;

export type LLMProviderId = 'anthropic' | 'openai' | 'google' | 'xai' | 'local';

/**
 * The seam between the agent loop and a concrete model backend. A provider owns
 * its own credential and model selection; callers pass a provider instead of a
 * raw API key. Implementations must preserve the Anthropic-style tool-use
 * contract (`tool_use` blocks in, `tool_result` blocks back) so the existing
 * agent loop works unchanged.
 */
export interface LLMProvider {
  /** Stable provider identifier (used for storage keys, UI, telemetry). */
  readonly id: LLMProviderId;
  /** The model id used for the agentic `chat` path (for display / logging). */
  readonly model: string;

  /**
   * One agentic, tool-using turn. Returns the model's response including any
   * `tool_use` blocks and a `stop_reason` the agent loop branches on.
   */
  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
  ): Promise<LLMResponse>;

  /**
   * Short-form, tool-less completion used for summaries (history compaction)
   * and commit-message drafting. Returns plain text.
   */
  complete(
    systemPrompt: string,
    userMessage: string,
    maxTokens?: number,
  ): Promise<string>;
}
