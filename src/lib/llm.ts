/**
 * Unified LLM client.
 * Supports: Anthropic, OpenAI, and any OpenAI-compatible API (Ollama, Groq,
 * OpenRouter, LM Studio, etc.).
 */

import Anthropic from '@anthropic-ai/sdk';
import { getLLMSettings, LLMSettings } from './storage';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// ── Provider catalogue ────────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'openai' | 'openai-compatible';

export interface ProviderInfo {
  id: LLMProvider;
  label: string;
  defaultBaseUrl: string;
  models: string[];
  keyPrefix?: string;
  keyHint?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    models: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
    keyPrefix: 'sk-ant-',
    keyHint: 'sk-ant-…  — console.anthropic.com',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
      'o3-mini',
    ],
    keyPrefix: 'sk-',
    keyHint: 'sk-…  — platform.openai.com',
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-Compatible',
    defaultBaseUrl: 'http://localhost:11434/v1',
    models: [],          // user enters a custom model
    keyHint: 'API key (leave blank if not required)',
  },
];

export function getProviderInfo(id: LLMProvider): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

// ── Anthropic sender ──────────────────────────────────────────────────────────

async function sendAnthropic(
  history: ChatMessage[],
  settings: LLMSettings,
): Promise<string> {
  const client = new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: settings.model,
    max_tokens: 4096,
    messages: history,
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

// ── OpenAI / OpenAI-compatible sender ─────────────────────────────────────────

async function sendOpenAI(
  history: ChatMessage[],
  settings: LLMSettings,
): Promise<string> {
  const baseUrl =
    settings.provider === 'openai'
      ? 'https://api.openai.com/v1'
      : settings.baseUrl.replace(/\/$/, '');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model,
      messages: history,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '(empty response)';
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendMessage(
  history: ChatMessage[],
  overrideSettings?: Partial<LLMSettings>,
): Promise<string> {
  const stored = await getLLMSettings();
  const settings: LLMSettings = { ...stored, ...overrideSettings };

  if (!settings.apiKey && settings.provider !== 'openai-compatible') {
    throw new Error('No API key set. Add one in Settings.');
  }
  if (!settings.model) {
    throw new Error('No model selected. Choose one in Settings.');
  }

  switch (settings.provider) {
    case 'anthropic':
      return sendAnthropic(history, settings);
    case 'openai':
    case 'openai-compatible':
      return sendOpenAI(history, settings);
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
