import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBlueprints } from '../core';
import { createPlanProject } from '../project';
import { filenameForKey, projectToFileMap, fileMapToProject, PLAN_FILE } from './fileMap';

function project() {
  const p = createPlanProject(makeBlueprints().find((b) => b.id === 'default')!, { id: 'p', title: 'Demo', now: 1 });
  p.sections.goal = { state: 'confirmed', content: '# Goal\nShip it.' };
  p.sections['issues.json'] = { state: 'confirmed', content: '[{"id":"auth","title":"Add auth","acceptance":"works"}]' };
  return p;
}

test('filenameForKey: bare topics get .md, extended keys verbatim', () => {
  assert.equal(filenameForKey('goal'), 'goal.md');
  assert.equal(filenameForKey('issues.json'), 'issues.json');
  assert.equal(filenameForKey('automations.md'), 'automations.md');
});

test('projectToFileMap: files for non-empty sections + plan.json meta; conversation excluded', () => {
  const p = project();
  p.messages = [{ role: 'user', text: 'hi' }];
  const map = projectToFileMap(p);
  assert.ok(map['goal.md']?.startsWith('# Goal'));
  assert.ok(map['issues.json']?.includes('"auth"'));
  assert.ok(map[PLAN_FILE]);
  const meta = JSON.parse(map[PLAN_FILE]);
  assert.equal(meta.blueprintId, 'default');
  assert.equal(meta.title, 'Demo');
  assert.equal(meta.sections.goal, 'confirmed');
  // empty seeded sections appear as state-only (no file)
  assert.ok(!('context.md' in map));
  // device-local fields never serialized
  assert.ok(!JSON.stringify(map).includes('"role":"user"'));
});

test('round-trip: fileMap → project restores sections, title, blueprint; re-derives signals', () => {
  const p = project();
  const restored = fileMapToProject(projectToFileMap(p), { id: 'p2', now: 9 })!;
  assert.equal(restored.id, 'p2');
  assert.equal(restored.title, 'Demo');
  assert.equal(restored.blueprint.id, 'default');
  assert.equal(restored.sections.goal.content, '# Goal\nShip it.\n'); // canonical trailing NL
  assert.equal(restored.sections.goal.state, 'confirmed');
  // signals re-derived from the synced files
  assert.equal(restored.stage.issueCount, 1);
  // conversation device-local → empty on a fresh import
  assert.deepEqual(restored.messages, []);
});

test('fileMapToProject: base supplies local-only fields (id/messages/createdAt)', () => {
  const p = project();
  p.messages = [{ role: 'user', text: 'local chat' }];
  const map = projectToFileMap(p);
  const merged = fileMapToProject(map, { id: 'p', now: 50, base: p })!;
  assert.deepEqual(merged.messages, p.messages); // kept from base
  assert.equal(merged.createdAt, p.createdAt);
  assert.equal(merged.updatedAt, 50);
});

test('fileMapToProject: missing/invalid plan.json → null', () => {
  assert.equal(fileMapToProject({}, { id: 'x', now: 0 }), null);
  assert.equal(fileMapToProject({ 'plan.json': 'not json' }, { id: 'x', now: 0 }), null);
});
