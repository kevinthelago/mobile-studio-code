import { ChatMessage, ToolDefinition } from '../types';
import {
  anthropicChat, anthropicComplete, ANTHROPIC_MODEL,
} from '../anthropic';
import { LLMProvider, LLMResponse } from './types';

/**
 * Anthropic-backed provider. Delegates to the existing `anthropic.ts` HTTP
 * helpers so behavior is byte-for-byte identical to the pre-abstraction agent
 * — including the prompt-cache breakpoints (`chat`) and the Haiku model used
 * for short completions (`complete`). The `model` field is informational; the
 * underlying helpers still pin their own models until per-model selection
 * lands (M1g).
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string = ANTHROPIC_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
  ): Promise<LLMResponse> {
    return anthropicChat(this.apiKey, messages, tools, systemPrompt);
  }

  complete(
    systemPrompt: string,
    userMessage: string,
    maxTokens?: number,
  ): Promise<string> {
    return anthropicComplete(this.apiKey, systemPrompt, userMessage, maxTokens);
  }
}
