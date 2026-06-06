import * as SecureStore from 'expo-secure-store';

export const KEYS = {
  GITHUB_PAT: 'github_pat',
  GITHUB_USER: 'github_user',
  ANTHROPIC_KEY: 'anthropic_api_key',
  REPO: 'repo_full_name',
  BRANCH: 'repo_branch',
  TUNNEL_URL: 'tunnel_url',
  TUNNEL_TOKEN: 'tunnel_token',
  FCM_TOKEN: 'fcm_token',
  // Multi-provider (M1g). Per-provider API keys use the `provider_key_` prefix
  // via providers/storage.ts; Anthropic keeps its legacy ANTHROPIC_KEY slot.
  SELECTED_PROVIDER: 'selected_provider',
  SELECTED_MODEL: 'selected_model',
  LOCAL_ENDPOINT: 'local_endpoint',
} as const;

export async function getSecret(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
