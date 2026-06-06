import {
  KEYS, getSecret, setSecret, deleteSecret,
} from '../storage';
import { LLMProviderId } from './types';
import { DEFAULT_PROVIDER, defaultModelFor } from './registry';

/**
 * SecureStore key for a provider's API key. Anthropic keeps its legacy slot so
 * a key entered before multi-provider existed keeps working; everyone else uses
 * the `provider_key_<id>` namespace.
 */
function providerKeyName(id: LLMProviderId): string {
  return id === 'anthropic' ? KEYS.ANTHROPIC_KEY : `provider_key_${id}`;
}

export function getProviderKey(id: LLMProviderId): Promise<string | null> {
  return getSecret(providerKeyName(id));
}

export function setProviderKey(id: LLMProviderId, key: string): Promise<void> {
  return setSecret(providerKeyName(id), key);
}

export function deleteProviderKey(id: LLMProviderId): Promise<void> {
  return deleteSecret(providerKeyName(id));
}

export async function getSelectedProvider(): Promise<LLMProviderId> {
  const v = await getSecret(KEYS.SELECTED_PROVIDER);
  return (v as LLMProviderId) || DEFAULT_PROVIDER;
}

export function setSelectedProvider(id: LLMProviderId): Promise<void> {
  return setSecret(KEYS.SELECTED_PROVIDER, id);
}

/** Selected chat model, defaulting to the active provider's recommended one. */
export async function getSelectedModel(): Promise<string> {
  const stored = await getSecret(KEYS.SELECTED_MODEL);
  if (stored) return stored;
  const provider = await getSelectedProvider();
  return defaultModelFor(provider);
}

export function setSelectedModel(modelId: string): Promise<void> {
  return setSecret(KEYS.SELECTED_MODEL, modelId);
}

export function getLocalEndpoint(): Promise<string | null> {
  return getSecret(KEYS.LOCAL_ENDPOINT);
}

export function setLocalEndpoint(url: string): Promise<void> {
  return setSecret(KEYS.LOCAL_ENDPOINT, url);
}
