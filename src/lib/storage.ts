import * as SecureStore from 'expo-secure-store';

export const KEYS = {
  GITHUB_PAT: 'github_pat',
  GITHUB_USER: 'github_user',
  ANTHROPIC_KEY: 'anthropic_api_key',
  REPO: 'repo_full_name',
  BRANCH: 'repo_branch',
  TUNNEL_URL: 'tunnel_url',
  TUNNEL_TOKEN: 'tunnel_token',
  /** JSON-encoded PairingPayload from the desktop QR (relay + Noise pairing). */
  TUNNEL_PAIRING: 'tunnel_pairing',
  FCM_TOKEN: 'fcm_token',
  /** JSON AlertReadState — the alerts inbox's local read/cleared watermarks (#222). */
  ALERTS_READ: 'alerts_read_state',
  // Multi-provider (M1g). Per-provider API keys use the `provider_key_` prefix
  // via providers/storage.ts; Anthropic keeps its legacy ANTHROPIC_KEY slot.
  SELECTED_PROVIDER: 'selected_provider',
  SELECTED_MODEL: 'selected_model',
  LOCAL_ENDPOINT: 'local_endpoint',
  RECENT_REPOS: 'recent_repos',
} as const;

export type RecentRepo = { repo: string; branch: string };

const MAX_RECENT_REPOS = 6;

export async function getRecentRepos(): Promise<RecentRepo[]> {
  const raw = await getSecret(KEYS.RECENT_REPOS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentRepo[]) : [];
  } catch {
    return [];
  }
}

/** Prepend a repo to the recents list (most-recent first, deduped, capped). */
export async function addRecentRepo(repo: string, branch: string): Promise<void> {
  const list = await getRecentRepos();
  const next = [
    { repo, branch },
    ...list.filter((r) => !(r.repo === repo && r.branch === branch)),
  ].slice(0, MAX_RECENT_REPOS);
  await setSecret(KEYS.RECENT_REPOS, JSON.stringify(next));
}

export async function getSecret(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
