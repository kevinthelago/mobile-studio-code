import { ChatMessage, ToolDefinition } from '../types';
import { LLMProvider, LLMResponse } from './types';
import { getResponseText } from './canonical';
import {
  buildGeminiBody, parseGeminiResponse, GeminiBody, GeminiResponse,
} from './googleFormat';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Google Gemini provider (M1d), using the `generateContent` REST endpoint. */
export class GoogleProvider implements LLMProvider {
  readonly id = 'google' as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async post(body: GeminiBody): Promise<GeminiResponse> {
    const res = await fetch(`${GEMINI_BASE}/${this.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`google ${res.status}: ${err.slice(0, 200)}`);
    }
    return res.json() as Promise<GeminiResponse>;
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
  ): Promise<LLMResponse> {
    const body = buildGeminiBody({ systemPrompt, messages, tools, maxTokens: 8192 });
    return parseGeminiResponse(await this.post(body));
  }

  async complete(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 200,
  ): Promise<string> {
    const body = buildGeminiBody({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: [],
      maxTokens,
    });
    return getResponseText(parseGeminiResponse(await this.post(body))).trim();
  }
}
