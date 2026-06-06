import { LLMProviderId } from './types';

/** How a provider is credentialed. */
export type ProviderAuth = 'key' | 'local';

export type ModelInfo = {
  /** Model id sent to the provider API. */
  id: string;
  /** Display name. */
  name: string;
  /** Context-window label for the UI, e.g. "200K", "1M". */
  contextLabel: string;
  /** Marks the default / suggested model for its provider. */
  recommended?: boolean;
};

export type ProviderInfo = {
  id: LLMProviderId;
  /** Display name. */
  name: string;
  /** Brand colour (used by the Providers screen, #59). */
  accent: string;
  auth: ProviderAuth;
  models: ModelInfo[];
};

/**
 * Static catalogue of selectable providers and models. Mirrors the redesign's
 * `PROVIDERS` data (design/Mobile Studio Code/page-terminal.jsx). Adapters for
 * everything except Anthropic land in M1c–M1f; until then these are selectable
 * in the registry but `createProvider` will reject them.
 */
export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    accent: '#d97757',
    auth: 'key',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextLabel: '200K', recommended: true },
      { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', contextLabel: '200K' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', contextLabel: '200K' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    accent: '#10a37f',
    auth: 'key',
    models: [
      { id: 'gpt-5', name: 'GPT-5', contextLabel: '256K' },
      { id: 'gpt-5-mini', name: 'GPT-5 mini', contextLabel: '256K' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    accent: '#4285f4',
    auth: 'key',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextLabel: '1M' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextLabel: '1M' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI',
    accent: '#1d1d1f',
    auth: 'key',
    models: [
      { id: 'grok-4', name: 'Grok 4', contextLabel: '256K' },
    ],
  },
  {
    id: 'local',
    name: 'Local · Ollama',
    accent: '#6b7280',
    auth: 'local',
    models: [
      { id: 'llama3.3:70b', name: 'Llama 3.3 70B', contextLabel: '128K' },
      { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder', contextLabel: '128K' },
    ],
  },
];

export const DEFAULT_PROVIDER: LLMProviderId = 'anthropic';

export function getProviderInfo(id: LLMProviderId): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** The recommended model for a provider, falling back to its first model. */
export function defaultModelFor(id: LLMProviderId): string {
  const p = getProviderInfo(id);
  if (!p) return '';
  return (p.models.find((m) => m.recommended) ?? p.models[0])?.id ?? '';
}

/** Whether a concrete adapter exists for this provider yet. */
export function isProviderImplemented(id: LLMProviderId): boolean {
  return id === 'anthropic';
}
