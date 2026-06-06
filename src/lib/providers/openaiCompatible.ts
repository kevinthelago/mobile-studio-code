import { ChatMessage, ToolDefinition } from '../types';
import { LLMProvider, LLMProviderId, LLMResponse } from './types';
import {
  buildOpenAIBody, parseOpenAIResponse, OpenAIChatResponse,
} from './openaiFormat';
import { getResponseText } from './canonical';

export type OpenAICompatibleOptions = {
  id: LLMProviderId;
  model: string;
  /** Full chat-completions endpoint URL. */
  chatUrl: string;
  /** Bearer token; omitted for keyless local endpoints. */
  apiKey?: string;
  /** Extra provider-specific headers. */
  headers?: Record<string, string>;
};

/**
 * Provider for any backend exposing the OpenAI Chat Completions API: OpenAI
 * itself (M1c), xAI / Grok (M1e), and Ollama's `/v1` endpoint (M1f). All three
 * share `buildOpenAIBody` / `parseOpenAIResponse` from the M1b normalization
 * layer, so this single class plus a base URL + auth header covers them.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: LLMProviderId;
  readonly model: string;
  private readonly chatUrl: string;
  private readonly headers: Record<string, string>;

  constructor(opts: OpenAICompatibleOptions) {
    this.id = opts.id;
    this.model = opts.model;
    this.chatUrl = opts.chatUrl;
    this.headers = {
      'Content-Type': 'application/json',
      ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
      ...opts.headers,
    };
  }

  private async post(body: object): Promise<OpenAIChatResponse> {
    const res = await fetch(this.chatUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${this.id} ${res.status}: ${err.slice(0, 200)}`);
    }
    return res.json() as Promise<OpenAIChatResponse>;
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
  ): Promise<LLMResponse> {
    const body = buildOpenAIBody({ model: this.model, systemPrompt, messages, tools });
    return parseOpenAIResponse(await this.post(body));
  }

  async complete(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 200,
  ): Promise<string> {
    const body = buildOpenAIBody({
      model: this.model,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: [],
      maxTokens,
    });
    return getResponseText(parseOpenAIResponse(await this.post(body))).trim();
  }
}
