import { AnthropicProvider } from './anthropic';
import { LLMProvider } from './types';

export * from './types';
export { AnthropicProvider } from './anthropic';

/**
 * Build the active LLM provider. Anthropic is the only backend today (M1a);
 * OpenAI / Google / xAI / local adapters (M1c–M1f) plug in here, selected by
 * the stored provider id from the Providers screen (#59).
 */
export function createProvider(apiKey: string): LLMProvider {
  return new AnthropicProvider(apiKey);
}
