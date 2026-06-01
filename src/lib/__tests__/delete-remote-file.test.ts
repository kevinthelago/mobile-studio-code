/**
 * #55 — `deleteRemoteFile` (GitHub Contents API DELETE).
 *
 * Pins the helper that the delete_file tool calls to remove a tracked file on
 * the remote:
 *   1. a successful DELETE sends { message, sha, branch } and reports the file
 *      was present (alreadyAbsent: false);
 *   2. a 404 is treated as idempotent success (alreadyAbsent: true) — the file
 *      was already gone, so the caller can still drop its manifest entry;
 *   3. other failures (409 sha mismatch, 403 protected, 401 auth) throw with the
 *      classified, actionable message.
 *
 * `../fs` is mocked (github.ts imports it); network is mocked at global fetch.
 */
jest.mock('../fs', () => ({
  repoDir: (repo: string) => `/repos/${repo.replace('/', '__')}/`,
  ensureDir: jest.fn(async () => undefined),
  writeText: jest.fn(async () => undefined),
  readText: jest.fn(async () => ''),
  writeManifest: jest.fn(async () => undefined),
}));

import { deleteRemoteFile } from '../github';

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

type FetchCall = { url: string; method: string; body: unknown };

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => '' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function installFetch(response: ReturnType<typeof jsonResponse>) {
  const calls: FetchCall[] = [];
  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: (init.method ?? 'GET').toUpperCase(),
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return response;
  });
  (global as unknown as { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch;
  return { calls };
}

describe('deleteRemoteFile', () => {
  it('sends a DELETE with message/sha/branch and reports the file was present', async () => {
    const { calls } = installFetch(jsonResponse(200, { commit: { sha: 'NEWCOMMIT' } }));

    const result = await deleteRemoteFile(
      'pat-123', 'owner/repo', 'main', 'src/old.ts', 'OLDSHA', 'msc: delete src/old.ts',
    );

    expect(result).toEqual({ alreadyAbsent: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toContain('/repos/owner/repo/contents/src/old.ts');
    expect(calls[0].body).toEqual({
      message: 'msc: delete src/old.ts',
      sha: 'OLDSHA',
      branch: 'main',
    });
  });

  it('encodes path segments (spaces) but keeps the slash separators', async () => {
    const { calls } = installFetch(jsonResponse(200, { commit: { sha: 'C' } }));

    await deleteRemoteFile(
      'pat', 'owner/repo', 'main', 'docs/my notes.md', 'SHA', 'msg',
    );

    expect(calls[0].url).toContain('/contents/docs/my%20notes.md');
  });

  it('treats a 404 as an idempotent success (already gone upstream)', async () => {
    installFetch(jsonResponse(404, { message: 'Not Found' }));

    const result = await deleteRemoteFile(
      'pat', 'owner/repo', 'main', 'src/old.ts', 'OLDSHA', 'msg',
    );

    expect(result).toEqual({ alreadyAbsent: true });
  });

  it('throws a sha_mismatch-flavoured message on a 409 stale sha', async () => {
    installFetch(jsonResponse(409, { message: 'does not match' }));

    await expect(
      deleteRemoteFile('pat', 'owner/repo', 'main', 'src/old.ts', 'STALE', 'msg'),
    ).rejects.toThrow(/409/);
  });

  it('throws an auth message on a 401', async () => {
    installFetch(jsonResponse(401, { message: 'Bad credentials' }));

    await expect(
      deleteRemoteFile('pat', 'owner/repo', 'main', 'src/old.ts', 'SHA', 'msg'),
    ).rejects.toThrow(/invalid or expired/i);
  });
});
