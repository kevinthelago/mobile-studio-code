import { AnthropicProvider } from './anthropic';
import { LLMProvider, ProviderConfig } from './types';
import { isProviderImplemented } from './registry';

export * from './types';
export * from './registry';
export * from './storage';
export { AnthropicProvider } from './anthropic';

/**
 * Build a provider from a resolved config. Anthropic is the only backend with a
 * concrete adapter today (M1a); OpenAI / Google / xAI / local (M1c–M1f) plug in
 * here. Selecting an unimplemented provider throws rather than silently using
 * the wrong backend.
 */
export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.id) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model);
    default:
      if (!isProviderImplemented(config.id)) {
        throw new Error(`Provider "${config.id}" isn't supported yet.`);
      }
      throw new Error(`No adapter wired for provider "${config.id}".`);
  }
}
