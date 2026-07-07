import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPlanState, applyPlanStatus, applyPlanEvent, deriveSections, emptyLivePlan,
  type LivePlanRegistry,
} from './livePlan';
import type { TunnelServerMessage } from '../types';

type PlanStateFrame = Extract<TunnelServerMessage, { type: 'plan_state' }>;
type PlanStatusFrame = Extract<TunnelServerMessage, { type: 'plan_status' }>;
type PlanEventFrame = Extract<TunnelServerMessage, { type: 'plan_event' }>;

const PROJ = 'proj-1';

function snapshot(over: Partial<PlanStateFrame> = {}): PlanStateFrame {
  return {
    type: 'plan_state',
    projectId: PROJ,
    currentStage: 'goal',
    confirmedSections: ['goal'],
    files: [{ relpath: 'goal.md', content: '# Goal' }],
    messages: [{ role: 'assistant', text: 'hi', at: 1000 }],
    pipelineRuns: [{ id: 'build', stage: 'test', status: 'running' }],
    ...over,
  };
}

test('applyPlanState builds a project mirror from a snapshot', () => {
  const reg = applyPlanState({}, snapshot(), 5);
  const s = reg[PROJ];
  assert.equal(s.currentStage, 'goal');
  assert.deepEqual(s.confirmedSections, ['goal']);
  assert.equal(s.files.length, 1);
  assert.equal(s.messages.length, 1);
  assert.equal(s.pipelineRuns.length, 1);
  assert.equal(s.updatedAt, 5);
});

test('applyPlanState replaces prior state wholesale (reconnect rebuild, never additive)', () => {
  // Seed a rich prior state, then snapshot a leaner one — the old data must be gone.
  let reg: LivePlanRegistry = applyPlanState({}, snapshot({
    confirmedSections: ['goal', 'scope'],
    messages: [{ role: 'user', text: 'a', at: 1 }, { role: 'assistant', text: 'b', at: 2 }],
  }), 1);
  reg = applyPlanState(reg, snapshot({
    currentStage: 'scope', confirmedSections: ['goal'], messages: [], files: [], pipelineRuns: [],
  }), 2);
  const s = reg[PROJ];
  assert.equal(s.currentStage, 'scope');
  assert.deepEqual(s.confirmedSections, ['goal']);
  assert.deepEqual(s.messages, []);
  assert.deepEqual(s.files, []);
  assert.deepEqual(s.pipelineRuns, []);
});

test('applyPlanState copies arrays so later deltas do not mutate the frame', () => {
  const frame = snapshot();
  const reg = applyPlanState({}, frame, 1);
  const reg2 = applyPlanEvent(reg, {
    type: 'plan_event', projectId: PROJ, kind: 'section_confirmed', section: 'scope', at: 9,
  });
  assert.deepEqual(frame.confirmedSections, ['goal'], 'original frame array was mutated');
  assert.deepEqual(reg2[PROJ].confirmedSections, ['goal', 'scope']);
});

test('applyPlanStatus updates the header and preserves it across a later snapshot', () => {
  const status: PlanStatusFrame = { type: 'plan_status', projectId: PROJ, currentStage: 'scope', status: 'in_progress' };
  let reg = applyPlanStatus({}, status, 3);
  assert.equal(reg[PROJ].status, 'in_progress');
  assert.equal(reg[PROJ].currentStage, 'scope');
  // A snapshot carries no status label — the last header should survive.
  reg = applyPlanState(reg, snapshot({ currentStage: 'goal' }), 4);
  assert.equal(reg[PROJ].status, 'in_progress');
  assert.equal(reg[PROJ].currentStage, 'goal');
});

test('plan_event section_confirmed is idempotent', () => {
  let reg = applyPlanState({}, snapshot({ confirmedSections: [] }), 1);
  const ev: PlanEventFrame = { type: 'plan_event', projectId: PROJ, kind: 'section_confirmed', section: 'goal', at: 2 };
  reg = applyPlanEvent(reg, ev);
  reg = applyPlanEvent(reg, ev);
  assert.deepEqual(reg[PROJ].confirmedSections, ['goal']);
});

test('plan_event stage_advanced and message_appended apply deltas', () => {
  let reg = applyPlanState({}, snapshot({ currentStage: 'goal', messages: [] }), 1);
  reg = applyPlanEvent(reg, { type: 'plan_event', projectId: PROJ, kind: 'stage_advanced', stage: 'scope', at: 2 });
  reg = applyPlanEvent(reg, {
    type: 'plan_event', projectId: PROJ, kind: 'message_appended',
    message: { role: 'user', text: 'go', at: 3 }, at: 3,
  });
  assert.equal(reg[PROJ].currentStage, 'scope');
  assert.deepEqual(reg[PROJ].messages, [{ role: 'user', text: 'go', at: 3 }]);
  assert.equal(reg[PROJ].updatedAt, 3);
});

test('plan_event pipeline_run upserts by id', () => {
  let reg = applyPlanState({}, snapshot({ pipelineRuns: [{ id: 'build', stage: 'test', status: 'running' }] }), 1);
  reg = applyPlanEvent(reg, {
    type: 'plan_event', projectId: PROJ, kind: 'pipeline_run',
    run: { id: 'build', stage: 'test', status: 'passed' }, at: 2,
  });
  assert.deepEqual(reg[PROJ].pipelineRuns, [{ id: 'build', stage: 'test', status: 'passed' }]);
  reg = applyPlanEvent(reg, {
    type: 'plan_event', projectId: PROJ, kind: 'pipeline_run',
    run: { id: 'lint', stage: 'check', status: 'running' }, at: 3,
  });
  assert.equal(reg[PROJ].pipelineRuns.length, 2);
});

test('a delta for an unseen project starts from empty rather than dropping it', () => {
  const reg = applyPlanEvent({}, {
    type: 'plan_event', projectId: 'late', kind: 'message_appended',
    message: { role: 'assistant', text: 'orphan', at: 7 }, at: 7,
  });
  assert.ok(reg.late, 'orphan delta was dropped');
  assert.deepEqual(reg.late.messages, [{ role: 'assistant', text: 'orphan', at: 7 }]);
});

test('a malformed delta (missing detail) is ignored', () => {
  const reg = applyPlanState({}, snapshot(), 1);
  const after = applyPlanEvent(reg, { type: 'plan_event', projectId: PROJ, kind: 'stage_advanced', at: 2 });
  assert.equal(after, reg, 'malformed delta should return the registry unchanged');
});

test('deriveSections orders by files, marks confirmed/current, and folds in fileless stages', () => {
  const reg = applyPlanState({}, snapshot({
    currentStage: 'scope',
    confirmedSections: ['goal', 'architecture'],
    files: [
      { relpath: 'goal.md', content: '# Goal' },
      { relpath: 'sections/scope.md', content: '# Scope' },
    ],
  }), 1);
  const steps = deriveSections(reg[PROJ]);
  assert.deepEqual(steps.map((s) => s.key), ['goal', 'scope', 'architecture']);
  assert.deepEqual(steps.map((s) => s.confirmed), [true, false, true]);
  assert.deepEqual(steps.map((s) => s.isCurrent), [false, true, false]);
  assert.equal(steps[0].file?.content, '# Goal');
  assert.equal(steps[2].file, null, 'a confirmed stage with no file still appears, fileless');
  assert.equal(steps[1].label, 'Scope');
});

test('reducers do not touch other projects in the registry', () => {
  const other = emptyLivePlan('other');
  const reg: LivePlanRegistry = { other };
  const next = applyPlanState(reg, snapshot(), 1);
  assert.equal(next.other, other, 'unrelated project state was replaced');
});
