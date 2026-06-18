import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  cachedGithubGet,
  clearGithubCache,
  getCacheSize,
  GithubAuthError,
  GithubRateLimitError,
  GithubOfflineError,
} from './githubCache.js';

type FetchInput = Parameters<typeof fetch>;
let mockFetch: ((...args: FetchInput) => Promise<Response>) | null = null;

function setFetch(impl: (...args: FetchInput) => Promise<Response>) {
  mockFetch = impl;
}

// Intercept globalThis.fetch before tests run.
const origFetch = globalThis.fetch;
(globalThis as Record<string, unknown>).fetch = (...args: FetchInput) => {
  if (mockFetch) return mockFetch(...args);
  return origFetch(...args);
};

function makeResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers(extraHeaders);
  return new Response(JSON.stringify(body), { status, headers });
}

describe('cachedGithubGet', () => {
  beforeEach(() => {
    clearGithubCache();
    mockFetch = null;
  });

  test('returns parsed JSON on a fresh 200', async () => {
    setFetch(() => Promise.resolve(makeResponse({ ok: true })));
    const result = await cachedGithubGet<{ ok: boolean }>('tok', 'repos/x/y');
    assert.deepEqual(result, { ok: true });
  });

  test('stores ETag and returns cached body on 304', async () => {
    let calls = 0;
    setFetch((url, init) => {
      calls++;
      const req = init as RequestInit;
      const headers = req.headers as Record<string, string>;
      if (calls === 1) {
        // First call: return 200 + ETag
        return Promise.resolve(
          makeResponse({ v: 1 }, 200, { etag: '"abc123"' }),
        );
      }
      // Second call: assert If-None-Match was sent, return 304
      assert.equal(headers['If-None-Match'], '"abc123"');
      return Promise.resolve(new Response(null, { status: 304, headers: new Headers() }));
    });

    const r1 = await cachedGithubGet<{ v: number }>('tok', 'repos/x/y');
    assert.equal(r1.v, 1);
    assert.equal(getCacheSize(), 1);

    const r2 = await cachedGithubGet<{ v: number }>('tok', 'repos/x/y');
    assert.equal(r2.v, 1); // served from cache
    assert.equal(calls, 2);
  });

  test('does not cache responses without ETag', async () => {
    setFetch(() => Promise.resolve(makeResponse({ x: 1 }, 200)));
    await cachedGithubGet('tok', 'repos/a/b');
    assert.equal(getCacheSize(), 0);
  });

  test('throws GithubAuthError on 401', async () => {
    setFetch(() => Promise.resolve(new Response('Unauthorized', { status: 401 })));
    await assert.rejects(
      () => cachedGithubGet('bad', 'user'),
      (e: Error) => e instanceof GithubAuthError,
    );
  });

  test('throws GithubRateLimitError on 403', async () => {
    setFetch(() =>
      Promise.resolve(
        new Response('Forbidden', {
          status: 403,
          headers: new Headers({ 'x-ratelimit-reset': '9999999999' }),
        }),
      ),
    );
    await assert.rejects(
      () => cachedGithubGet('tok', 'rate'),
      (e: Error) => {
        assert.ok(e instanceof GithubRateLimitError);
        assert.ok((e as GithubRateLimitError).resetAt !== null);
        return true;
      },
    );
  });

  test('throws GithubOfflineError when fetch rejects', async () => {
    setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await assert.rejects(
      () => cachedGithubGet('tok', 'offline'),
      (e: Error) => e instanceof GithubOfflineError,
    );
  });

  test('throws on non-200/304/401/403 status', async () => {
    setFetch(() => Promise.resolve(new Response('Not Found', { status: 404 })));
    await assert.rejects(
      () => cachedGithubGet('tok', 'missing'),
      /404/,
    );
  });

  test('clearGithubCache empties the cache', async () => {
    setFetch(() => Promise.resolve(makeResponse({}, 200, { etag: '"e"' })));
    await cachedGithubGet('tok', 'repos/c/d');
    assert.equal(getCacheSize(), 1);
    clearGithubCache();
    assert.equal(getCacheSize(), 0);
  });
});
