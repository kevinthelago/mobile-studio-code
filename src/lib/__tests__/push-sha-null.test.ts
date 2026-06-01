/**
 * #14 — manifest `sha: null` new-file push path.
 *
 * New local files carry `sha: null` in the manifest. These tests pin the
 * behaviour of {@link pushModifiedFiles} for that case:
 *   1. a `sha: null` file is created (the blob POST sends NO sha) and the
 *      manifest is stamped with the blob sha GitHub returns;
 *   2. the documented `not_found` failure mode is classified correctly and,
 *      crucially, leaves the manifest untouched so a recovery (re-auth / pull)
 *      can retry the same `sha: null` push.
 *
 * `./fs` is the only native dependency (expo-file-system); it is mocked so the
 * suite runs in plain Node. Network is mocked at the global `fetch` level.
 */
import type { Manifest } from '../types';

jest.mock('../fs', () => ({
  repoDir: (repo: string) => `/repos/${repo.replace('/', '__')}/`,
  readText: jest.fn(async () => 'console.log("brand new file");\n'),
  writeManifest: jest.fn(async () => undefined),
  ensureDir: jest.fn(async () => undefined),
  writeText: jest.fn(async () => undefined),
}));

import { pushModifiedFiles } from '../github';
import { writeManifest } from '../fs';

// github.ts logs every failed request via console.warn (for on-device
// debugging). That noise is expected here — the failure-path tests exercise it
// deliberately — so silence it to keep the test output readable.
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

type FetchCall = { url: string; method: string; body: unknown };

/** A single mock HTTP response in the shape github.ts's ghFetch consumes. */
function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => '' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/**
 * Install a `fetch` mock that walks the Git Data API push pipeline
 * (ref → commit → tree → blobs → tree → commit → ref). `overrides` lets a test
 * force a specific endpoint to fail. Every call is recorded in `calls`.
 */
function installFetch(opts: {
  remoteTree?: { path: string; sha: string }[];
  overrides?: (url: string, method: string) => ReturnType<typeof jsonResponse> | null;
} = {}) {
  const calls: FetchCall[] = [];
  const remoteTree = opts.remoteTree ?? [];

  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, method, body });

    const forced = opts.overrides?.(url, method);
    if (forced) return forced;

    if (method === 'GET' && /\/git\/ref\/heads\//.test(url)) {
      return jsonResponse(200, { object: { sha: 'HEADCOMMITSHA' } });
    }
    if (method === 'GET' && /\/git\/commits\//.test(url)) {
      return jsonResponse(200, { tree: { sha: 'BASETREESHA' } });
    }
    if (method === 'GET' && /\/git\/trees\//.test(url)) {
      return jsonResponse(200, {
        tree: remoteTree.map((e) => ({ ...e, type: 'blob', mode: '100644' })),
        truncated: false,
      });
    }
    if (method === 'POST' && /\/git\/blobs$/.test(url)) {
      return jsonResponse(201, { sha: 'NEWBLOBSHA' });
    }
    if (method === 'POST' && /\/git\/trees$/.test(url)) {
      return jsonResponse(201, { sha: 'NEWTREESHA' });
    }
    if (method === 'POST' && /\/git\/commits$/.test(url)) {
      return jsonResponse(201, { sha: 'NEWCOMMITSHA' });
    }
    if (method === 'PATCH' && /\/git\/refs\/heads\//.test(url)) {
      return jsonResponse(200, { object: { sha: 'NEWCOMMITSHA' } });
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  });

  (global as unknown as { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch;
  return { calls, fetchMock };
}

function manifestWithNewFile(): Manifest {
  return {
    repo: 'owner/repo',
    branch: 'main',
    syncedAt: 0,
    files: {
      'src/new.ts': { sha: null, modified: true },
    },
  };
}

describe('pushModifiedFiles — sha:null new-file path', () => {
  it('creates the file without sending a sha and stamps the returned blob sha', async () => {
    const { calls } = installFetch({ remoteTree: [] });
    const manifest = manifestWithNewFile();

    const result = await pushModifiedFiles('pat-123', manifest, 'add new file');

    expect(result.pushed).toBe(1);
    expect(result.failures).toEqual([]);

    // The blob POST must NOT carry a sha (it's a create, not an update).
    const blobCall = calls.find((c) => /\/git\/blobs$/.test(c.url));
    expect(blobCall).toBeDefined();
    expect(blobCall!.body).toHaveProperty('content');
    expect(blobCall!.body).toHaveProperty('encoding', 'base64');
    expect(blobCall!.body).not.toHaveProperty('sha');

    // The new tree entry references the blob by the sha GitHub returned — also
    // with no parent sha sent for the file itself.
    const treeCall = calls.find((c) => /\/git\/trees$/.test(c.url) && c.method === 'POST');
    const treeBody = treeCall!.body as { tree: { path: string; sha: string }[] };
    expect(treeBody.tree).toContainEqual(
      expect.objectContaining({ path: 'src/new.ts', sha: 'NEWBLOBSHA' }),
    );

    // Manifest stamped with the blob sha and cleared of the modified flag.
    expect(manifest.files['src/new.ts']).toEqual({ sha: 'NEWBLOBSHA', modified: false });
    expect(writeManifest).toHaveBeenCalledTimes(1);
  });

  it('does not send a parent sha for a sha:null file even when other files exist remotely', async () => {
    const { calls } = installFetch({
      remoteTree: [{ path: 'README.md', sha: 'READMESHA' }],
    });
    const manifest = manifestWithNewFile();

    const result = await pushModifiedFiles('pat-123', manifest, 'add new file');

    expect(result.pushed).toBe(1);
    const blobCall = calls.find((c) => /\/git\/blobs$/.test(c.url));
    expect(blobCall!.body).not.toHaveProperty('sha');
  });

  it('flags a conflict (no overwrite) when a sha:null path already exists on the remote', async () => {
    const { calls } = installFetch({
      remoteTree: [{ path: 'src/new.ts', sha: 'REMOTESHA' }],
    });
    const manifest = manifestWithNewFile();

    const result = await pushModifiedFiles('pat-123', manifest, 'add new file');

    expect(result.pushed).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ path: 'src/new.ts', kind: 'sha_mismatch' });
    // No blob/commit attempted, and the manifest is left intact for recovery.
    expect(calls.some((c) => /\/git\/blobs$/.test(c.url))).toBe(false);
    expect(manifest.files['src/new.ts']).toEqual({ sha: null, modified: true });
    expect(writeManifest).not.toHaveBeenCalled();
  });
});

describe('pushModifiedFiles — not_found recovery regression', () => {
  it('classifies a 404 on the ref read as not_found and leaves the manifest untouched', async () => {
    installFetch({
      overrides: (url, method) =>
        method === 'GET' && /\/git\/ref\/heads\//.test(url)
          ? jsonResponse(404, { message: 'Not Found' })
          : null,
    });
    const manifest = manifestWithNewFile();

    const result = await pushModifiedFiles('pat-123', manifest, 'add new file');

    expect(result.pushed).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ path: 'src/new.ts', kind: 'not_found', status: 404 });
    // The whole point of the recovery path: the sha:null state must survive so
    // a retry (after re-auth / pull) can re-attempt the create.
    expect(manifest.files['src/new.ts']).toEqual({ sha: null, modified: true });
    expect(writeManifest).not.toHaveBeenCalled();
  });

  it('classifies a 404 on the blob create as not_found for that file', async () => {
    installFetch({
      remoteTree: [],
      overrides: (url, method) =>
        method === 'POST' && /\/git\/blobs$/.test(url)
          ? jsonResponse(404, { message: 'Not Found' })
          : null,
    });
    const manifest = manifestWithNewFile();

    const result = await pushModifiedFiles('pat-123', manifest, 'add new file');

    expect(result.pushed).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ path: 'src/new.ts', kind: 'not_found', status: 404 });
    expect(manifest.files['src/new.ts']).toEqual({ sha: null, modified: true });
    expect(writeManifest).not.toHaveBeenCalled();
  });
});
