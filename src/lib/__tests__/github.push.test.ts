/**
 * Tests for the standalone push pipeline (`pushModifiedFiles`).
 *
 * Focus (issue #14): new local files carry `sha: null` in the manifest. The
 * push path must create them on the remote without sending a parent sha and
 * then stamp the manifest with the blob sha GitHub returns. We also lock in the
 * two failure modes that used to surface as a bare `not_found`: a new file that
 * already exists on the remote (must ask the user to pull) and a 404 from the
 * Git Data API (token/branch problem), so a future tunnel change can't silently
 * regress them.
 *
 * The push talks to the GitHub Git Data API over `fetch` and reads local file
 * content via `../fs`; both are mocked here so the test is hermetic.
 */
import type { Manifest } from '../types';

// Mock the file-system layer: github.ts only needs repoDir / readText /
// writeManifest / ensureDir from it on the push path.
const mockWriteManifest = jest.fn(async (_m: unknown) => {});
const mockReadText = jest.fn(async (_abs: string) => 'file contents');
jest.mock('../fs', () => ({
  repoDir: (repo: string) => `/repos/${repo.replace('/', '__')}/`,
  readText: (abs: string) => mockReadText(abs),
  writeManifest: (m: unknown) => mockWriteManifest(m),
  ensureDir: async () => {},
  writeText: async () => {},
}));

import { pushModifiedFiles } from '../github';

const REPO = 'octo/repo';
const BRANCH = 'main';

type Json = Record<string, unknown>;

/** A minimal fetch-Response stand-in matching what github.ts reads. */
function jsonResponse(body: Json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => '' },
  } as unknown as Response;
}

/**
 * Route the Git Data API calls a push makes. `remoteTree` is the set of blobs
 * the remote branch currently has; `overrides` lets a test force a specific
 * response for the first matching (method, urlFragment).
 */
function installFetchMock(opts: {
  remoteTree: { path: string; sha: string }[];
  truncated?: boolean;
  override?: (method: string, url: string) => Response | undefined;
  blobSha?: string;
}) {
  const blobSha = opts.blobSha ?? 'NEWBLOBSHA';
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const forced = opts.override?.(method, url);
    if (forced) return forced;

    if (method === 'GET' && /\/git\/ref\/heads\//.test(url)) {
      return jsonResponse({ object: { sha: 'HEADSHA' } });
    }
    if (method === 'GET' && /\/git\/commits\//.test(url)) {
      return jsonResponse({ tree: { sha: 'BASETREE' } });
    }
    if (method === 'GET' && /\/git\/trees\//.test(url)) {
      return jsonResponse({
        tree: opts.remoteTree.map((e) => ({ ...e, type: 'blob' })),
        truncated: opts.truncated ?? false,
      });
    }
    if (method === 'POST' && /\/git\/blobs$/.test(url)) {
      return jsonResponse({ sha: blobSha });
    }
    if (method === 'POST' && /\/git\/trees$/.test(url)) {
      return jsonResponse({ sha: 'NEWTREE' });
    }
    if (method === 'POST' && /\/git\/commits$/.test(url)) {
      return jsonResponse({ sha: 'NEWCOMMIT' });
    }
    if (method === 'PATCH' && /\/git\/refs\/heads\//.test(url)) {
      return jsonResponse({ object: { sha: 'NEWCOMMIT' } });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });
  (global as unknown as { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function manifest(files: Manifest['files']): Manifest {
  return { repo: REPO, branch: BRANCH, syncedAt: 0, files };
}

beforeEach(() => {
  mockWriteManifest.mockClear();
  mockReadText.mockClear();
  mockReadText.mockResolvedValue('file contents');
});

describe('pushModifiedFiles — new file (sha:null) create path', () => {
  it('creates a brand-new file without sending a sha and stamps the returned blob sha', async () => {
    const fetchMock = installFetchMock({ remoteTree: [], blobSha: 'CREATEDSHA' });
    const m = manifest({ 'src/new.ts': { sha: null, modified: true } });

    const res = await pushModifiedFiles('pat', m, 'add new file');

    expect(res.pushed).toBe(1);
    expect(res.failures).toEqual([]);
    // Manifest stamped with the blob sha GitHub returned; no longer modified.
    expect(res.manifest.files['src/new.ts']).toEqual({
      sha: 'CREATEDSHA',
      modified: false,
    });
    expect(mockWriteManifest).toHaveBeenCalledTimes(1);

    // The blob upload carries only content + encoding — never a parent sha for
    // the new file (it had none to send).
    const blobCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        /\/git\/blobs$/.test(url as string) &&
        (init as RequestInit)?.method === 'POST',
    );
    expect(blobCall).toBeDefined();
    const blobBody = JSON.parse((blobCall![1] as RequestInit).body as string);
    expect(Object.keys(blobBody).sort()).toEqual(['content', 'encoding']);
    expect(blobBody).not.toHaveProperty('sha');

    // The new tree entry references the freshly-created blob sha.
    const treeCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        /\/git\/trees$/.test(url as string) &&
        (init as RequestInit)?.method === 'POST',
    );
    const treeBody = JSON.parse((treeCall![1] as RequestInit).body as string);
    expect(treeBody.tree).toEqual([
      { path: 'src/new.ts', mode: '100644', type: 'blob', sha: 'CREATEDSHA' },
    ]);
  });

  it('updates a tracked file whose parent sha still matches the remote', async () => {
    installFetchMock({
      remoteTree: [{ path: 'src/existing.ts', sha: 'OLDSHA' }],
      blobSha: 'UPDATEDSHA',
    });
    const m = manifest({ 'src/existing.ts': { sha: 'OLDSHA', modified: true } });

    const res = await pushModifiedFiles('pat', m, 'update file');

    expect(res.pushed).toBe(1);
    expect(res.failures).toEqual([]);
    expect(res.manifest.files['src/existing.ts']).toEqual({
      sha: 'UPDATEDSHA',
      modified: false,
    });
  });
});

describe('pushModifiedFiles — failure modes that used to read as not_found', () => {
  it('flags a new (sha:null) file that already exists on the remote as a conflict to pull', async () => {
    installFetchMock({
      remoteTree: [{ path: 'src/clash.ts', sha: 'REMOTESHA' }],
    });
    const m = manifest({ 'src/clash.ts': { sha: null, modified: true } });

    const res = await pushModifiedFiles('pat', m, 'create clash');

    expect(res.pushed).toBe(0);
    expect(res.failures).toHaveLength(1);
    expect(res.failures[0].kind).toBe('sha_mismatch');
    expect(res.failures[0].message).toMatch(/pull/i);
    // Nothing committed → manifest untouched, file still pending.
    expect(mockWriteManifest).not.toHaveBeenCalled();
    expect(res.manifest.files['src/clash.ts']).toEqual({
      sha: null,
      modified: true,
    });
  });

  it('classifies a 404 from the Git Data API as not_found across every modified path', async () => {
    installFetchMock({
      remoteTree: [],
      override: (method, url) =>
        method === 'GET' && /\/git\/ref\/heads\//.test(url)
          ? jsonResponse({ message: 'Not Found' }, 404)
          : undefined,
    });
    const m = manifest({
      'a.ts': { sha: null, modified: true },
      'b.ts': { sha: null, modified: true },
    });

    const res = await pushModifiedFiles('pat', m, 'push two');

    expect(res.pushed).toBe(0);
    expect(res.failures).toHaveLength(2);
    for (const f of res.failures) {
      expect(f.kind).toBe('not_found');
      expect(f.status).toBe(404);
      expect(f.message).toMatch(/PAT|branch|repo/i);
    }
    expect(res.failures.map((f) => f.path).sort()).toEqual(['a.ts', 'b.ts']);
  });
});
