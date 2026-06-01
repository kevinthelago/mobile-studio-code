/**
 * #56 — branch create/switch tooling (GitHub layer).
 *
 * Pins the two helpers the Git tab's branch switcher calls:
 *   - listBranches — pages `/repos/{repo}/branches` (100/page) and returns names;
 *   - createBranch — reads the source ref's sha then POSTs a new
 *     `refs/heads/{name}` at it; a 422 means the branch already exists.
 *
 * `../fs` is mocked (github.ts imports it); network is mocked at global fetch
 * with a per-call response queue so multi-request flows can be asserted in order.
 */
jest.mock('../fs', () => ({
  repoDir: (repo: string) => `/repos/${repo.replace('/', '__')}/`,
  ensureDir: jest.fn(async () => undefined),
  writeText: jest.fn(async () => undefined),
  readText: jest.fn(async () => ''),
  writeManifest: jest.fn(async () => undefined),
}));

import { listBranches, createBranch } from '../github';

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

// Install a fetch mock that returns queued responses in order (one per call).
// Returns the recorded calls for assertions.
function installFetchQueue(responses: ReturnType<typeof jsonResponse>[]) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: (init.method ?? 'GET').toUpperCase(),
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return responses[Math.min(i++, responses.length - 1)];
  });
  (global as unknown as { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch;
  return { calls };
}

function namePage(count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) => ({ name: `${prefix}-${i}` }));
}

describe('listBranches', () => {
  it('returns branch names from a single short page', async () => {
    const { calls } = installFetchQueue([
      jsonResponse(200, [{ name: 'main' }, { name: 'develop' }, { name: 'feature/x' }]),
    ]);

    const names = await listBranches('pat', 'owner/repo');

    expect(names).toEqual(['main', 'develop', 'feature/x']);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toContain('/repos/owner/repo/branches?per_page=100&page=1');
  });

  it('pages until a short page is returned', async () => {
    // First page is full (100) → keep going; second page is short → stop.
    const { calls } = installFetchQueue([
      jsonResponse(200, namePage(100, 'a')),
      jsonResponse(200, namePage(7, 'b')),
    ]);

    const names = await listBranches('pat', 'owner/repo');

    expect(names).toHaveLength(107);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('page=1');
    expect(calls[1].url).toContain('page=2');
  });

  it('throws a classified message on failure', async () => {
    installFetchQueue([jsonResponse(404, { message: 'Not Found' })]);

    await expect(listBranches('pat', 'owner/repo')).rejects.toThrow(/404/);
  });
});

describe('createBranch', () => {
  it('reads the source ref sha and POSTs a new ref at it', async () => {
    const { calls } = installFetchQueue([
      jsonResponse(200, { object: { sha: 'BASESHA' } }),
      jsonResponse(201, { ref: 'refs/heads/feature/new', object: { sha: 'BASESHA' } }),
    ]);

    const result = await createBranch('pat', 'owner/repo', 'feature/new', 'main');

    expect(result).toEqual({ branch: 'feature/new', sha: 'BASESHA' });
    expect(calls).toHaveLength(2);
    // 1. read the source ref (branch name encoded, slash kept)
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toContain('/repos/owner/repo/git/ref/heads/main');
    // 2. create the new ref with the source sha
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toContain('/repos/owner/repo/git/refs');
    expect(calls[1].body).toEqual({ ref: 'refs/heads/feature/new', sha: 'BASESHA' });
  });

  it('throws an "already exists" message on a 422', async () => {
    installFetchQueue([
      jsonResponse(200, { object: { sha: 'BASESHA' } }),
      jsonResponse(422, { message: 'Reference already exists' }),
    ]);

    await expect(
      createBranch('pat', 'owner/repo', 'develop', 'main'),
    ).rejects.toThrow(/already exists/i);
  });

  it('throws a classified message when the source branch is missing', async () => {
    installFetchQueue([jsonResponse(404, { message: 'Not Found' })]);

    await expect(
      createBranch('pat', 'owner/repo', 'feature/x', 'no-such-branch'),
    ).rejects.toThrow(/404/);
  });
});
