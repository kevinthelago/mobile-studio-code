import { AnthropicProvider } from './anthropic';
import { OpenAICompatibleProvider } from './openaiCompatible';
import { GoogleProvider } from './google';
import { LLMProvider, ProviderConfig } from './types';

export * from './types';
export * from './registry';
export * from './storage';
export * from './canonical';
export * from './openaiFormat';
export * from './googleFormat';
export { AnthropicProvider } from './anthropic';
export { OpenAICompatibleProvider } from './openaiCompatible';
export { GoogleProvider } from './google';

const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

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
    case 'openai':
      return new OpenAICompatibleProvider({
        id: 'openai',
        model: config.model,
        chatUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: config.apiKey,
      });
    case 'xai':
      return new OpenAICompatibleProvider({
        id: 'xai',
        model: config.model,
        chatUrl: 'https://api.x.ai/v1/chat/completions',
        apiKey: config.apiKey,
      });
    case 'local': {
      const base = (config.endpoint || DEFAULT_OLLAMA_ENDPOINT).replace(/\/+$/, '');
      return new OpenAICompatibleProvider({
        id: 'local',
        model: config.model,
        chatUrl: `${base}/v1/chat/completions`,
        // Ollama is keyless by default; pass a token through if one was set.
        apiKey: config.apiKey || undefined,
      });
    }
    case 'google':
      return new GoogleProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unknown provider "${config.id}".`);
  }
}
