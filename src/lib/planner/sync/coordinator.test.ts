import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBlueprints } from '../core';
import { createPlanProject, type PlanProject } from '../project';
import { projectToFileMap } from './fileMap';
import { mapToManifest } from './syncPlanner';
import { reconcileOnConnect, type SyncDeps } from './coordinator';
import type { PlanSyncManifestEntry } from '../../types';
import type { FileMap } from './reconcile';

function proj(id: string, goal: string) {
  const p = createPlanProject(makeBlueprints().find((b) => b.id === 'default')!, { id, title: id, now: 1 });
  p.sections.goal = { state: 'confirmed', content: goal };
  return p;
}
function entry(id: string, map: FileMap): PlanSyncManifestEntry {
  return { projectId: id, title: id, updatedAt: 1, files: mapToManifest(map) };
}

/** A mock deps that records writes/pushes and serves a fixed remote. */
function mockDeps(locals: PlanProject[], remoteMaps: Record<string, FileMap>, bases: Record<string, FileMap> = {}) {
  const written: Record<string, { project: PlanProject; base: FileMap }> = {};
  const pushed: Record<string, FileMap> = {};
  const deps: SyncDeps = {
    localProjects: async () => locals,
    readBase: async (id) => bases[id] ?? {},
    writeMerged: async (project, base) => { written[project.id] = { project, base }; },
    pull: async (id, paths) => Object.fromEntries(paths.map((p) => [p, remoteMaps[id][p]])),
    push: async (e) => { pushed[e.projectId] = e.files; },
    now: () => 100,
  };
  return { deps, written, pushed };
}

test('clean merge: non-overlapping edits to a file auto-merge → merged + pushed', async () => {
  const local = proj('p', 'goal\nMID\nscope\n');
  const base = projectToFileMap(local);
  // a stable middle line lets diff3 separate the two edits (no common anchor → conflict)
  local.sections.goal = { state: 'confirmed', content: 'GOAL\nMID\nscope\n' };   // local edits line 1
  const remoteMap = { ...base, 'goal.md': 'goal\nMID\nSCOPE\n' };                  // remote edits line 3
  const { deps, written, pushed } = mockDeps([local], { p: remoteMap }, { p: base });

  const report = await reconcileOnConnect([entry('p', remoteMap)], deps);
  assert.deepEqual(report.merged, ['p']);
  assert.equal(report.conflicts.length, 0);
  assert.equal(written['p'].project.sections.goal.content, 'GOAL\nMID\nSCOPE\n'); // both edits
  assert.equal(pushed['p']['goal.md'], 'GOAL\nMID\nSCOPE\n');                      // pushed agreed map
});

test('conflict: overlapping edit → parked, nothing written/pushed', async () => {
  const local = proj('p', 'a\nb\nc\n');
  const base = projectToFileMap(local);
  local.sections.goal = { state: 'confirmed', content: 'a\nMINE\nc\n' };
  const remoteMap = { ...base, 'goal.md': 'a\nTHEIRS\nc\n' };
  const { deps, written, pushed } = mockDeps([local], { p: remoteMap }, { p: base });

  const report = await reconcileOnConnect([entry('p', remoteMap)], deps);
  assert.equal(report.merged.length, 0);
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.conflicts[0].projectId, 'p');
  assert.deepEqual(report.conflicts[0].outcome.conflicts.map((c) => c.path), ['goal.md']);
  assert.ok(!('p' in written) && !('p' in pushed)); // nothing applied until resolved
});

test('new on peer → adopted; local-only → pushed', async () => {
  const localOnly = proj('local1', 'mine\n');
  const remoteOnlyMap = projectToFileMap(proj('remote1', 'theirs\n'));
  const { deps, written, pushed } = mockDeps([localOnly], { remote1: remoteOnlyMap });

  const report = await reconcileOnConnect([entry('remote1', remoteOnlyMap)], deps);
  assert.deepEqual(report.adopted, ['remote1']);
  assert.ok(report.pushed.includes('remote1')); // pushed back to set peer base
  assert.ok(report.pushed.includes('local1'));  // local-only pushed
  assert.equal(written['remote1'].project.sections.goal.content, 'theirs\n');
  assert.ok('local1' in written); // base set for the local-only project
});
