import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBlueprints, buildPlanStageState } from './core';
import {
  createPlanProject, projectSignals, projectReadiness,
  serializePlanProject, deserializePlanProject, isPlanProject,
  summarizeProject, upsertSummary, removeSummary,
  PLAN_PROJECT_SCHEMA, type PlanProject, type PlanProjectSummary,
} from './project';

function defaultBlueprint() {
  return makeBlueprints().find((b) => b.id === 'default')!;
}

test('createPlanProject seeds a section per enabled blueprint section', () => {
  const p = createPlanProject(defaultBlueprint(), { id: 'pid-1', title: 'Demo', now: 100 });
  assert.equal(p.schema, PLAN_PROJECT_SCHEMA);
  assert.equal(p.id, 'pid-1');
  assert.equal(p.createdAt, 100);
  // default blueprint disables `repos` → no section entry for it
  assert.ok(p.sections.context);
  assert.equal(p.sections.context.state, 'surfaced');
  assert.ok(!p.sections.repos);
  // empty stage + maps
  assert.deepEqual(p.pipelineRuns, {});
  assert.deepEqual(p.artifacts, {});
});

test('projectSignals flattens the stage snapshot', () => {
  const p = createPlanProject(defaultBlueprint(), { id: 'pid', title: 't', now: 0 });
  p.stage = buildPlanStageState({ repoCount: 2, issueCount: 5 });
  const sig = projectSignals(p);
  assert.equal(sig.repoCount, 2);
  assert.equal(sig.issueCount, 5);
  assert.equal(sig.coreConfirmed, false);
});

test('projectReadiness: empty plan is incomplete, current is context', () => {
  const p = createPlanProject(defaultBlueprint(), { id: 'pid', title: 't', now: 0 });
  const r = projectReadiness(p);
  assert.equal(r.complete, false);
  assert.equal(r.current?.key, 'context');
  assert.ok(r.incomplete.some((s) => s.key === 'context'));
  // readiness lists only enabled sections, never the disabled repos
  assert.ok(!r.sections.some((s) => s.section.key === 'repos'));
});

test('projectReadiness: a satisfied stage completes the plan (UI N/A via requiresUi=false)', () => {
  const p = createPlanProject(defaultBlueprint(), { id: 'pid', title: 't', now: 0 });
  p.stage = buildPlanStageState({
    context: { resolved: 2, total: 2, coreConfirmed: true },
    requiresUi: false,
    phasesConfirmed: true, issueCount: 3,
    fleet: { streams: 1, profilesComplete: true },
    automationsAck: true, skillsAck: true,
  });
  const r = projectReadiness(p);
  assert.equal(r.complete, true);
  assert.equal(r.incomplete.length, 0);
});

test('serialize → deserialize round-trips; junk is rejected', () => {
  const p = createPlanProject(defaultBlueprint(), { id: 'pid', title: 't', now: 7 });
  p.sections.context.state = 'confirmed';
  p.sections.context.content = '# Goal\nShip it.';
  const back = deserializePlanProject(serializePlanProject(p));
  assert.deepEqual(back, p);

  assert.equal(deserializePlanProject('not json'), null);
  assert.equal(isPlanProject({ ...p, schema: 999 } as unknown), false);
  assert.equal(isPlanProject({ ...p, id: '' } as unknown), false);
});

test('summarizeProject reports blueprint + progress counts', () => {
  const p = createPlanProject(defaultBlueprint(), { id: 'pid', title: 'My plan', now: 5 });
  const s = summarizeProject(p);
  assert.equal(s.id, 'pid');
  assert.equal(s.title, 'My plan');
  assert.equal(s.blueprintId, 'default');
  assert.equal(s.complete, false);
  assert.equal(s.done, 0);
  // default blueprint: 6 enabled sections, but `ui` is N/A (requiresUi=false) → 5 applicable
  assert.equal(s.total, 5);
});

test('upsertSummary replaces by id and sorts most-recent first; removeSummary drops', () => {
  const a: PlanProjectSummary = { id: 'a', title: 'A', blueprintId: 'd', blueprintName: 'Default', createdAt: 1, updatedAt: 10, total: 5, done: 0, complete: false };
  const b: PlanProjectSummary = { ...a, id: 'b', updatedAt: 20 };
  let list = upsertSummary(upsertSummary([], a), b);
  assert.deepEqual(list.map((s) => s.id), ['b', 'a']); // newest first

  // replacing 'a' with a newer updatedAt re-sorts it to the front
  list = upsertSummary(list, { ...a, updatedAt: 30, title: 'A2' });
  assert.deepEqual(list.map((s) => s.id), ['a', 'b']);
  assert.equal(list.find((s) => s.id === 'a')!.title, 'A2');
  assert.equal(list.length, 2); // replaced, not duplicated

  assert.deepEqual(removeSummary(list, 'a').map((s) => s.id), ['b']);
});
