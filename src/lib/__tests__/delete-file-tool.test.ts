/**
 * #55 — `delete_file` agent tool.
 *
 * Pins the tool's three branches in agent.ts's runTool:
 *   1. tracked file (real sha) → local delete + remote Contents DELETE with the
 *      tracked sha, then the manifest entry is dropped;
 *   2. new/untracked file (sha:null or no entry) → local delete only, no remote
 *      call, entry dropped if it existed (the "sha-missing" graceful path);
 *   3. a 404 from the remote (already gone upstream) still drops the entry.
 *
 * `../fs` and `../github` are the native/network boundaries; both are mocked so
 * the suite runs in plain Node.
 */
import type { Manifest } from '../types';
import type { RunToolContext } from '../agent';

jest.mock('../fs', () => ({
  repoDir: (repo: string) => `/repos/${repo.replace('/', '__')}/`,
  deleteLocalFile: jest.fn(async () => undefined),
  // Other exports agent.ts imports — unused by the delete_file path but must
  // exist as module bindings.
  listDir: jest.fn(),
  readText: jest.fn(),
  writeText: jest.fn(),
  isDirectory: jest.fn(),
  isMscMetaFile: jest.fn(() => false),
  writeManifest: jest.fn(),
  loadProjectInstructions: jest.fn(),
}));

jest.mock('../github', () => ({
  deleteRemoteFile: jest.fn(async () => ({ alreadyAbsent: false })),
  // Bindings for the other github imports in agent.ts.
  commentOnIssue: jest.fn(),
  getIssue: jest.fn(),
  getIssueComments: jest.fn(),
  getRemoteFile: jest.fn(),
  pullRepo: jest.fn(),
  pushModifiedFiles: jest.fn(),
}));

import { runTool } from '../agent';
import { deleteLocalFile } from '../fs';
import { deleteRemoteFile } from '../github';

const deleteLocalMock = deleteLocalFile as jest.Mock;
const deleteRemoteMock = deleteRemoteFile as jest.Mock;

function ctxWith(files: Manifest['files'], pat: string | null = 'pat-123'): RunToolContext {
  return {
    manifest: { repo: 'owner/repo', branch: 'main', syncedAt: 0, files },
    pat,
    linkedIssue: null,
  };
}

describe('delete_file tool', () => {
  it('deletes a tracked file locally + on the remote with the tracked sha, then drops the entry', async () => {
    const ctx = ctxWith({ 'src/old.ts': { sha: 'OLDSHA', modified: false } });

    const { result, manifestChanged } = await runTool(
      'delete_file', { path: 'src/old.ts' }, ctx,
    );

    expect(manifestChanged).toBe(true);
    expect(deleteLocalMock).toHaveBeenCalledWith('/repos/owner__repo/src/old.ts');
    expect(deleteRemoteMock).toHaveBeenCalledWith(
      'pat-123', 'owner/repo', 'main', 'src/old.ts', 'OLDSHA', 'msc: delete src/old.ts',
    );
    // Entry gone from the manifest after a successful remote delete.
    expect(ctx.manifest.files['src/old.ts']).toBeUndefined();
    expect(result).toContain('owner/repo@main');
  });

  it('strips a leading slash before resolving the path and manifest key', async () => {
    const ctx = ctxWith({ 'src/old.ts': { sha: 'OLDSHA', modified: false } });

    await runTool('delete_file', { path: '/src/old.ts' }, ctx);

    expect(deleteLocalMock).toHaveBeenCalledWith('/repos/owner__repo/src/old.ts');
    expect(deleteRemoteMock).toHaveBeenCalledWith(
      'pat-123', 'owner/repo', 'main', 'src/old.ts', 'OLDSHA', expect.any(String),
    );
    expect(ctx.manifest.files['src/old.ts']).toBeUndefined();
  });

  it('deletes a never-pushed (sha:null) file locally only, no remote call', async () => {
    const ctx = ctxWith({ 'src/new.ts': { sha: null, modified: true } });

    const { result, manifestChanged } = await runTool(
      'delete_file', { path: 'src/new.ts' }, ctx,
    );

    expect(manifestChanged).toBe(true);
    expect(deleteLocalMock).toHaveBeenCalledWith('/repos/owner__repo/src/new.ts');
    expect(deleteRemoteMock).not.toHaveBeenCalled();
    expect(ctx.manifest.files['src/new.ts']).toBeUndefined();
    expect(result).toContain('never pushed');
  });

  it('deletes an untracked file locally only and reports nothing was tracked', async () => {
    const ctx = ctxWith({});

    const { result, manifestChanged } = await runTool(
      'delete_file', { path: 'src/ghost.ts' }, ctx,
    );

    // No manifest mutation (there was no entry) — manifestChanged stays false.
    expect(manifestChanged).toBe(false);
    expect(deleteLocalMock).toHaveBeenCalledWith('/repos/owner__repo/src/ghost.ts');
    expect(deleteRemoteMock).not.toHaveBeenCalled();
    expect(result).toContain("wasn't tracked");
  });

  it('drops the entry when the remote file is already gone (404 → alreadyAbsent)', async () => {
    deleteRemoteMock.mockResolvedValueOnce({ alreadyAbsent: true });
    const ctx = ctxWith({ 'src/old.ts': { sha: 'OLDSHA', modified: false } });

    const { result, manifestChanged } = await runTool(
      'delete_file', { path: 'src/old.ts' }, ctx,
    );

    expect(manifestChanged).toBe(true);
    expect(ctx.manifest.files['src/old.ts']).toBeUndefined();
    expect(result).toContain('already gone');
  });

  it('throws when deleting a tracked file without a GitHub token', async () => {
    const ctx = ctxWith({ 'src/old.ts': { sha: 'OLDSHA', modified: false } }, null);

    await expect(
      runTool('delete_file', { path: 'src/old.ts' }, ctx),
    ).rejects.toThrow(/no GitHub token/);

    // Local delete is still attempted before the token check; the remote call
    // is not, and the entry survives so a retry (after auth) can finish it.
    expect(deleteRemoteMock).not.toHaveBeenCalled();
    expect(ctx.manifest.files['src/old.ts']).toEqual({ sha: 'OLDSHA', modified: false });
  });
});
