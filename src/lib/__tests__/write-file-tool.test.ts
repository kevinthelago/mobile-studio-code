/**
 * #14 — `write_file` records `sha: null` for brand-new paths.
 *
 * The push path (see push-sha-null.test.ts) depends on new files entering the
 * manifest as `{ sha: null, modified: true }`. This suite pins that contract at
 * the source: the `write_file` agent tool in agent.ts.
 *
 * `../fs` is mocked (it's the only native dependency); the tool's filesystem
 * write is a no-op here — we only assert the manifest mutation it performs.
 */
import type { Manifest } from '../types';
import type { RunToolContext } from '../agent';

jest.mock('../fs', () => ({
  repoDir: (repo: string) => `/repos/${repo.replace('/', '__')}/`,
  writeText: jest.fn(async () => undefined),
  // Other exports agent.ts imports — unused by the write_file path but must
  // exist as module bindings.
  listDir: jest.fn(),
  readText: jest.fn(),
  isDirectory: jest.fn(),
  isMscMetaFile: jest.fn(() => false),
  writeManifest: jest.fn(),
  loadProjectInstructions: jest.fn(),
}));

import { runTool } from '../agent';
import { writeText } from '../fs';

const writeTextMock = writeText as jest.Mock;

function ctxWith(files: Manifest['files']): RunToolContext {
  return {
    manifest: { repo: 'owner/repo', branch: 'main', syncedAt: 0, files },
    pat: null,
    linkedIssue: null,
  };
}

describe('write_file tool — manifest sha tracking', () => {
  it('records sha:null + modified for a brand-new path', async () => {
    const ctx = ctxWith({});

    const { result, manifestChanged } = await runTool(
      'write_file',
      { path: 'src/brand-new.ts', content: 'export const x = 1;\n' },
      ctx,
    );

    expect(manifestChanged).toBe(true);
    expect(ctx.manifest.files['src/brand-new.ts']).toEqual({ sha: null, modified: true });
    // The bytes were written under the repo dir with the normalized path.
    expect(writeTextMock).toHaveBeenCalledWith(
      '/repos/owner__repo/src/brand-new.ts',
      'export const x = 1;\n',
    );
    expect(result).toContain('src/brand-new.ts');
  });

  it('strips a leading slash so the manifest key matches the download/push key', async () => {
    const ctx = ctxWith({});

    await runTool('write_file', { path: '/src/leading.ts', content: 'x' }, ctx);

    // Stored without the leading slash — a parallel "/src/..." key would 404 on
    // push (double slash in the Contents API URL).
    expect(ctx.manifest.files['/src/leading.ts']).toBeUndefined();
    expect(ctx.manifest.files['src/leading.ts']).toEqual({ sha: null, modified: true });
  });

  it('preserves the existing remote sha when overwriting a tracked file', async () => {
    const ctx = ctxWith({
      'src/existing.ts': { sha: 'EXISTINGSHA', modified: false },
    });

    await runTool('write_file', { path: 'src/existing.ts', content: 'updated' }, ctx);

    // An edit to a known file keeps its parent sha (so push does an update, not
    // a create) and only flips the modified flag.
    expect(ctx.manifest.files['src/existing.ts']).toEqual({ sha: 'EXISTINGSHA', modified: true });
  });
});
