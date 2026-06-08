import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeBlueprints, registerPipelineHandler, _resetPipelineHandlers,
  type StageContext, type Pipeline,
} from './core';
import { createPlanProject, projectReadiness, effectiveSectionStatus, projectSignals } from './project';
import { lintPlan, gradePlan } from './pipelineHandlers';
import { runProjectPipeline, firePipelinesForTrigger, newlyCompleteSections } from './pipelines';

function project() {
  return createPlanProject(makeBlueprints().find((b) => b.id === 'default')!, { id: 'p', title: 'T', now: 0 });
}
function ctx(artifacts: Record<string, string>): StageContext {
  return { projectKey: 'p', stageId: 'structure', artifacts, trigger: 'manual' };
}

// ── builtin handlers ──────────────────────────────────────────────────────────

test('lintPlan flags missing goal / phases / issues and bad issues', () => {
  assert.equal(lintPlan(ctx({})).status, 'fail');
  const ok = lintPlan(ctx({
    goal: 'g',
    'phases.json': '[{"name":"MVP"}]',
    'issues.json': '[{"title":"a","acceptance":"x","files":["y"]}]',
  }));
  assert.equal(ok.status, 'ok');
  const bad = lintPlan(ctx({ goal: 'g', 'phases.json': '[{}]', 'issues.json': '[{"title":"a"}]' }));
  assert.equal(bad.status, 'fail');
  assert.ok((bad.output as string[]).some((f) => f.includes('acceptance')));
});

test('gradePlan scores by completeness and returns a letter', () => {
  const weak = gradePlan(ctx({ goal: 'g' }));
  assert.match(weak.message ?? '', /Grade [A-F] \(\d+%\)/);
  const strong = gradePlan(ctx({
    goal: 'g', scope: 's',
    'phases.json': '[{"name":"MVP"}]',
    'issues.json': '[{"title":"a","acceptance":"x","files":["f"]}]',
  }));
  const ws = (weak.output as { score: number }).score;
  const ss = (strong.output as { score: number }).score;
  assert.ok(ss > ws);
});

// ── runner ────────────────────────────────────────────────────────────────────

test('runProjectPipeline records the run state keyed by pipeline uid', async () => {
  _resetPipelineHandlers();
  registerPipelineHandler('lint-plan', () => ({ status: 'ok', message: 'clean' }));
  const p = project();
  const lint: Pipeline = {
    id: 'lint-plan', name: 'Lint', desc: '', suits: ['*'], kind: 'builtin',
    uid: 'pl-x', trigger: 'manual', enabled: true,
  };
  const next = await runProjectPipeline(p, 'structure', lint, 'manual');
  assert.equal(next.pipelineRuns['pl-x'].status, 'ok');
  assert.equal(next.pipelineRuns['pl-x'].message, 'clean');
  assert.ok(next.pipelineRuns['pl-x'].lastRun! > 0);
});

test('firePipelinesForTrigger runs matching enabled pipelines on the given sections', async () => {
  _resetPipelineHandlers();
  let calls = 0;
  registerPipelineHandler('lint-plan', () => { calls++; return { status: 'ok' }; });
  const p = project(); // default: context has lint-plan on completion (enabled)
  await firePipelinesForTrigger(p, ['context'], 'on completion');
  assert.equal(calls, 1);
});

// ── gating ────────────────────────────────────────────────────────────────────

test('a gate pipeline holds a data-complete section at in-progress until it passes', () => {
  const p = project();
  // Make context's data gate pass, and mark its lint-plan pipeline a gate.
  p.stage = { ...p.stage, context: { resolved: 1, total: 1, coreConfirmed: true } };
  const ctxSection = p.blueprint.sections.find((s) => s.key === 'context')!;
  ctxSection.pipelines = ctxSection.pipelines.map((pl) => ({ ...pl, gate: true }));
  const signals = projectSignals(p);

  // gate hasn't run → blocked, held at in-progress
  const blocked = effectiveSectionStatus(ctxSection, p.blueprint.sections, signals, {});
  assert.equal(blocked.status, 'in-progress');
  assert.equal(blocked.blocked, true);

  // gate passes (ok) → complete
  const gateUid = ctxSection.pipelines[0].uid;
  const passed = effectiveSectionStatus(ctxSection, p.blueprint.sections, signals,
    { [gateUid]: { status: 'ok', lastRun: 1 } });
  assert.equal(passed.status, 'complete');
  assert.equal(passed.blocked, false);
});

test('newlyCompleteSections detects a section transitioning to complete', () => {
  const before = project();
  const after = { ...before, stage: { ...before.stage, skillsAck: true } };
  // skills gate = skillsAck; default blueprint includes skills (no deps)
  const newly = newlyCompleteSections(before, after);
  assert.ok(newly.includes('skills'));
  assert.equal(projectReadiness(before).sections.find((s) => s.section.key === 'skills')!.status.status, 'in-progress');
});
