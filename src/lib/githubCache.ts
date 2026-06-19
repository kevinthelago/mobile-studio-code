// ETag-based conditional GET cache for GitHub REST API.
// In-memory only — survives the session, resets on app restart. Reduces rate-limit
// consumption: after the first fetch GitHub returns 304 + no body when nothing changed,
// and we serve the stored response without parsing a new payload.

export class GithubAuthError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'GithubAuthError';
  }
}

export class GithubRateLimitError extends Error {
  readonly resetAt: number | null;
  constructor(resetHeader: string | null) {
    super('GitHub rate limit exceeded.');
    this.name = 'GithubRateLimitError';
    this.resetAt = resetHeader ? parseInt(resetHeader, 10) * 1000 : null;
  }
}

export class GithubOfflineError extends Error {
  constructor() {
    super('Network request failed — check your connection.');
    this.name = 'GithubOfflineError';
  }
}

interface CacheEntry {
  etag: string;
  body: string;
}

const _cache = new Map<string, CacheEntry>();

export function clearGithubCache(): void {
  _cache.clear();
}

// Exposed for tests — read without mutating.
export function getCacheSize(): number {
  return _cache.size;
}

export async function cachedGithubGet<T>(pat: string, path: string): Promise<T> {
  const url = `https://api.github.com/${path}`;
  const entry = _cache.get(url);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (entry) {
    headers['If-None-Match'] = entry.etag;
  }

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new GithubOfflineError();
  }

  if (res.status === 304 && entry) {
    return JSON.parse(entry.body) as T;
  }

  if (res.status === 401) {
    throw new GithubAuthError('GitHub token invalid or expired (401).');
  }
  if (res.status === 403) {
    // Primary rate limit sends x-ratelimit-reset; secondary sends Retry-After.
    const reset = res.headers.get('x-ratelimit-reset') ?? res.headers.get('retry-after');
    throw new GithubRateLimitError(reset);
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} on ${path}`);
  }

  const text = await res.text();
  const etag = res.headers.get('etag');
  if (etag) {
    _cache.set(url, { etag, body: text });
  }
  return JSON.parse(text) as T;
}
