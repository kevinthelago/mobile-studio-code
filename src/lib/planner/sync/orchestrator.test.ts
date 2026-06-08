import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBlueprints } from '../core';
import { createPlanProject } from '../project';
import { projectToFileMap } from './fileMap';
import { planSync, finishSync } from './orchestrator';

function project() {
  const p = createPlanProject(makeBlueprints().find((b) => b.id === 'default')!, { id: 'p', title: 'Demo', now: 1 });
  p.sections.goal = { state: 'confirmed', content: 'goal\nscope\nstack\n' };
  return p;
}

test('clean sync: peer edited a different section → both land, signals re-derived', () => {
  const local = project();
  // base = the shared ancestor (local's current map)
  const base = projectToFileMap(local);

  // local edits goal; remote (peer) added an issues.json
  local.sections.goal = { state: 'confirmed', content: 'GOAL\nscope\nstack\n' };
  const remote = { ...base, 'issues.json': '[{"id":"1","title":"a"}]\n',
    'plan.json': base['plan.json'].replace('"goal": "confirmed"', '"goal": "confirmed",\n    "issues.json": "confirmed"') };

  const out = planSync(local, remote, base, 99);
  assert.equal(out.conflicts.length, 0);
  assert.ok(out.resolved);
  const merged = out.resolved!.project;
  assert.equal(merged.sections.goal.content, 'GOAL\nscope\nstack\n');   // local edit kept
  assert.equal(merged.sections['issues.json'].content.trim(), '[{"id":"1","title":"a"}]'); // remote add
  assert.equal(merged.stage.issueCount, 1);                              // re-derived
  assert.equal(out.resolved!.base['issues.json'], remote['issues.json']);
});

test('conflict: overlapping edit to the same file → surfaced, then finished', () => {
  const local = project();
  const base = projectToFileMap(local);

  local.sections.goal = { state: 'confirmed', content: 'MINE\nscope\nstack\n' };
  const remote = { ...base, 'goal.md': 'THEIRS\nscope\nstack\n' };

  const out = planSync(local, remote, base, 5);
  assert.equal(out.resolved, undefined);
  assert.equal(out.conflicts.length, 1);
  assert.equal(out.conflicts[0].path, 'goal.md');

  // user picks theirs
  const done = finishSync(local, out, { 'goal.md': 'THEIRS\nscope\nstack\n' }, 7);
  assert.equal(done.project.sections.goal.content, 'THEIRS\nscope\nstack\n');
  assert.equal(done.base['goal.md'], 'THEIRS\nscope\nstack\n');
});

test('no changes → clean, project unchanged in substance', () => {
  const local = project();
  const base = projectToFileMap(local);
  const out = planSync(local, base, base, 3);
  assert.ok(out.resolved);
  assert.equal(out.resolved!.project.sections.goal.content, 'goal\nscope\nstack\n');
});
