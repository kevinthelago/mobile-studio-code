import test from 'node:test';
import assert from 'node:assert/strict';
import { hashContent } from './canonical';
import { mapToManifest, pathsToPull, assembleRemoteMap } from './syncPlanner';
import type { FileMap } from './reconcile';

test('mapToManifest hashes each file', () => {
  const map: FileMap = { 'goal.md': 'goal\n', 'plan.json': '{}\n' };
  assert.deepEqual(mapToManifest(map), {
    'goal.md': hashContent('goal\n'),
    'plan.json': hashContent('{}\n'),
  });
});

test('pathsToPull: only files whose remote hash differs from local (or are remote-only)', () => {
  const local: FileMap = { 'goal.md': 'goal\n', 'scope.md': 'scope\n' };
  const remote = {
    'goal.md': hashContent('goal\n'),        // same → skip
    'scope.md': hashContent('SCOPE\n'),       // differs → pull
    'issues.json': hashContent('[]\n'),       // remote-only → pull
  };
  assert.deepEqual(pathsToPull(local, remote), ['issues.json', 'scope.md']);
});

test('assembleRemoteMap: pulled for changed, local for matched, absent otherwise', () => {
  const local: FileMap = { 'goal.md': 'goal\n', 'scope.md': 'scope\n' };
  const manifest = {
    'goal.md': hashContent('goal\n'),    // matched
    'scope.md': hashContent('SCOPE\n'),  // changed
    'issues.json': hashContent('[]\n'),  // remote-only changed
  };
  const pulled: FileMap = { 'scope.md': 'SCOPE\n', 'issues.json': '[]\n' };
  const remote = assembleRemoteMap(local, manifest, pulled);
  assert.deepEqual(remote, {
    'goal.md': 'goal\n',       // matched → local content reused
    'scope.md': 'SCOPE\n',     // pulled
    'issues.json': '[]\n',     // pulled
  });
  // a local file absent from the manifest is NOT in the remote map (→ reconcile keeps it)
  assert.ok(!('extra.md' in assembleRemoteMap({ 'extra.md': 'x\n' }, {}, {})));
});
