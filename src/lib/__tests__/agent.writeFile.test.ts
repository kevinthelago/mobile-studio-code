/**
 * Tests for the agent `write_file` tool's manifest bookkeeping (issue #14).
 *
 * The contract the push pipeline relies on: writing a path that isn't yet in
 * the manifest records `sha: null` (a brand-new file, created on next push),
 * while writing a path that is already tracked preserves its parent sha and
 * only flips `modified` to true. Leading slashes are normalized so a model
 * passing "/foo" doesn't create a divergent manifest key.
 */
import type { Manifest } from '../types';

// write_file only touches writeText + repoDir from ../fs.
const mockWriteText = jest.fn(async (_abs: string, _content: string) => {});
jest.mock('../fs', () => ({
  repoDir: (repo: string) => `/repos/${repo.replace('/', '__')}/`,
  writeText: (abs: string, content: string) => mockWriteText(abs, content),
  // Other fs exports agent.ts imports at module load — stubbed so the import
  // resolves without pulling in expo-file-system.
  listDir: async () => [],
  readText: async () => '',
  isDirectory: async () => false,
  isMscMetaFile: () => false,
  writeManifest: async () => {},
  loadProjectInstructions: async () => null,
}));

// The agent module imports the Anthropic client at load; stub it out so the
// SDK never initializes in the test runner.
jest.mock('../anthropic', () => ({ anthropicChat: jest.fn() }));

import { runTool, type RunToolContext } from '../agent';

function ctxWith(files: Manifest['files']): RunToolContext {
  return {
    manifest: { repo: 'octo/repo', branch: 'main', syncedAt: 0, files },
    pat: null,
    linkedIssue: null,
  };
}

beforeEach(() => mockWriteText.mockClear());

describe('write_file manifest bookkeeping', () => {
  it('records sha:null and modified:true for a brand-new path', async () => {
    const ctx = ctxWith({});

    const out = await runTool(
      'write_file',
      { path: 'src/new.ts', content: 'console.log(1)' },
      ctx,
    );

    expect(out.manifestChanged).toBe(true);
    expect(ctx.manifest.files['src/new.ts']).toEqual({
      sha: null,
      modified: true,
    });
    expect(mockWriteText).toHaveBeenCalledWith(
      '/repos/octo__repo/src/new.ts',
      'console.log(1)',
    );
  });

  it('preserves the existing parent sha and only flips modified for a tracked path', async () => {
    const ctx = ctxWith({ 'src/old.ts': { sha: 'ABC123', modified: false } });

    await runTool('write_file', { path: 'src/old.ts', content: 'updated' }, ctx);

    expect(ctx.manifest.files['src/old.ts']).toEqual({
      sha: 'ABC123',
      modified: true,
    });
  });

  it('normalizes a leading slash so it does not create a divergent manifest key', async () => {
    const ctx = ctxWith({});

    await runTool('write_file', { path: '/src/leading.ts', content: 'x' }, ctx);

    expect(ctx.manifest.files['src/leading.ts']).toEqual({
      sha: null,
      modified: true,
    });
    expect(ctx.manifest.files['/src/leading.ts']).toBeUndefined();
  });
});
