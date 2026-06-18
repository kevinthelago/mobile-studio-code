import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeBlueprints, registerPipelineHandler, registerPipeline,
  _resetPipelineHandlers, _resetPipelineModules,
} from './core';
import { createPlanProject } from './project';
import { lintPlan } from './pipelineHandlers';
import { pipelineCommandModule } from './pipelineModules';
import { applyPipelineTags } from './commandBus';

function project() {
  return createPlanProject(makeBlueprints().find((b) => b.id === 'default')!, { id: 'p', title: 'T', now: 0 });
}
function contextLintUid(p: ReturnType<typeof project>) {
  const ctx = p.blueprint.sections.find((s) => s.key === 'context')!;
  return ctx.pipelines.find((pl) => pl.id === 'lint-plan')!.uid;
}

test('applyPipelineTags: <pipeline cmd="run"> runs the handler and records the run state', async () => {
  _resetPipelineHandlers(); _resetPipelineModules();
  registerPipelineHandler('lint-plan', lintPlan);
  registerPipeline(pipelineCommandModule('lint-plan'));

  const p = project(); // default blueprint: context carries lint-plan
  const uid = contextLintUid(p);
  const out = await applyPipelineTags(p, 'Checking the plan.\n<pipeline id="lint-plan" cmd="run" />');
  assert.ok(out.pipelineRuns[uid], 'a run state was recorded for the context lint-plan');
  assert.equal(out.pipelineRuns[uid].status, 'fail'); // empty plan → gaps
  assert.ok(out.pipelineRuns[uid].lastRun! > 0);
});

test('applyPipelineTags: cmd="confirm" marks the pipeline ok (gate clear)', async () => {
  _resetPipelineHandlers(); _resetPipelineModules();
  registerPipeline(pipelineCommandModule('lint-plan'));

  const p = project();
  const uid = contextLintUid(p);
  const out = await applyPipelineTags(p, '<pipeline id="lint-plan" cmd="confirm" />');
  assert.equal(out.pipelineRuns[uid].status, 'ok');
});

test('applyPipelineTags: no tags → unchanged; unknown id → safe no-op', async () => {
  _resetPipelineHandlers(); _resetPipelineModules();
  registerPipeline(pipelineCommandModule('lint-plan'));

  const p = project();
  assert.equal(await applyPipelineTags(p, 'just chatting, no tags'), p);
  const out = await applyPipelineTags(p, '<pipeline id="not-registered" cmd="run" />');
  assert.deepEqual(out.pipelineRuns, {}); // dispatch to unknown id is a structured no-op
});
