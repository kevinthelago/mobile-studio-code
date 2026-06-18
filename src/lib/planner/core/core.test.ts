import test from 'node:test';
import assert from 'node:assert/strict';
import {
  // stageGate
  evalRequirement, evalGate, gateApplies, type PlanSignals,
  // blueprints
  makeBlueprints, sectionStatus, planSectionsComplete, incompleteSections,
  currentSection, enabledSections, type Pipeline,
  // planStageDerive + planStages
  planStateToSignals, buildPlanStageState,
  // engine
  pipelinesForTrigger, runPipeline, isGateBlocked, registerPipelineHandler,
  _resetPipelineHandlers, type StageContext,
  // command bus
  dispatchPipelineCommand, registerPipeline, _resetPipelineModules,
  // tags
  parsePipelineTags, stripPipelineTags, parseUiPreviewTags, stripUiPreviewTags,
} from './index';

// ── stageGate: the declarative evaluator ──────────────────────────────────────

test('evalRequirement: boolean presence flag', () => {
  assert.deepEqual(evalRequirement({ signal: 'coreConfirmed' }, { coreConfirmed: true }), { pass: true, progress: 1 });
  assert.deepEqual(evalRequirement({ signal: 'coreConfirmed' }, {}), { pass: false, progress: 0 });
});

test('evalRequirement: numeric target with default >= and partial progress', () => {
  assert.deepEqual(evalRequirement({ signal: 'issueCount', target: 4 }, { issueCount: 2 }), { pass: false, progress: 0.5 });
  assert.deepEqual(evalRequirement({ signal: 'issueCount', target: 4 }, { issueCount: 4 }), { pass: true, progress: 1 });
});

test('evalRequirement: ratio (X of Y) needs denom > 0 and X >= Y', () => {
  assert.deepEqual(evalRequirement({ signal: 'topicsResolved', of: 'topicsTotal' }, { topicsResolved: 1, topicsTotal: 4 }), { pass: false, progress: 0.25 });
  assert.deepEqual(evalRequirement({ signal: 'topicsResolved', of: 'topicsTotal' }, { topicsResolved: 4, topicsTotal: 4 }), { pass: true, progress: 1 });
  assert.deepEqual(evalRequirement({ signal: 'topicsResolved', of: 'topicsTotal' }, { topicsResolved: 0, topicsTotal: 0 }), { pass: false, progress: 0 });
});

test('evalGate: AND of requirements, weighted fraction, empty gate vacuous', () => {
  assert.deepEqual(evalGate(undefined, {}), { done: true, fraction: 1 });
  // weight 0 must-pass flag should not move the fill
  const gate = { require: [
    { signal: 'coreConfirmed', target: true, weight: 0 },
    { signal: 'topicsResolved', of: 'topicsTotal' },
  ] };
  const r = evalGate(gate, { coreConfirmed: false, topicsResolved: 2, topicsTotal: 4 });
  assert.equal(r.done, false);
  assert.equal(r.fraction, 0.5); // weight-0 flag excluded from the average
});

test('gateApplies: absent rule always applies', () => {
  assert.equal(gateApplies(undefined, {}), true);
  assert.equal(gateApplies({ signal: 'requiresUi', target: true }, { requiresUi: false }), false);
});

// ── blueprints: sections are the authority (no hardcoded enum) ─────────────────

const COMPLETE: PlanSignals = {
  coreConfirmed: true, topicsResolved: 3, topicsTotal: 3,
  requiresUi: false, // UI section -> N/A
  featuresCount: 4, featuresConfirmed: true,
  phasesConfirmed: true, issueCount: 5,
  fleetStreams: 2, profilesComplete: true,
  automationsAck: true, skillsAck: true,
};

function defaultBlueprint() {
  return makeBlueprints().find((b) => b.id === 'default')!;
}

test('a fully-satisfied signal bag completes the plan (UI N/A via requiresUi)', () => {
  const bp = defaultBlueprint();
  assert.equal(planSectionsComplete(bp.sections, COMPLETE), true);
  const ui = bp.sections.find((s) => s.key === 'ui')!;
  assert.equal(sectionStatus(ui, bp.sections, COMPLETE).status, 'na');
});

test('empty signals: context in-progress, dependents locked, plan incomplete', () => {
  const bp = defaultBlueprint();
  const empty: PlanSignals = {};
  assert.equal(planSectionsComplete(bp.sections, empty), false);

  const ctx = bp.sections.find((s) => s.key === 'context')!;
  const structure = bp.sections.find((s) => s.key === 'structure')!;
  assert.equal(sectionStatus(ctx, bp.sections, empty).status, 'in-progress');
  assert.equal(sectionStatus(structure, bp.sections, empty).status, 'locked');

  assert.equal(currentSection(bp.sections, empty)?.key, 'context');

  const left = incompleteSections(bp.sections, empty);
  const keys = left.map((s) => s.key);
  assert.ok(keys.includes('context'));
  assert.ok(!keys.includes('ui'));     // N/A excluded
  assert.ok(!keys.includes('repos'));  // disabled in the default blueprint excluded
  // each carries its section's own gate description as the reason
  assert.equal(left.find((s) => s.key === 'context')!.reason, 'all topics resolved');
});

test('enabledSections drops the disabled repos section in the default blueprint', () => {
  const bp = defaultBlueprint();
  assert.ok(!enabledSections(bp.sections).some((s) => s.key === 'repos'));
});

// ── planStateToSignals: the published vocabulary ──────────────────────────────

test('planStateToSignals flattens PlanStageState into the signal bag', () => {
  const st = buildPlanStageState({
    context: { resolved: 2, total: 3, coreConfirmed: true },
    repoCount: 1, requiresUi: true, ui: { approved: 1, total: 2 },
    features: { count: 3, confirmed: false },
    phasesConfirmed: true, issueCount: 7,
    fleet: { streams: 2, profilesComplete: false },
  });
  assert.deepEqual(planStateToSignals(st), {
    coreConfirmed: true, topicsResolved: 2, topicsTotal: 3,
    repoCount: 1, requiresUi: true, screensApproved: 1, screensTotal: 2,
    featuresCount: 3, featuresConfirmed: false,
    phasesConfirmed: true, issueCount: 7,
    fleetStreams: 2, profilesComplete: false,
    automationsAck: false, skillsAck: false,
  });
});

test('features section: locked until context done, in-progress with count, complete once confirmed', () => {
  const bp = defaultBlueprint();
  const feat = bp.sections.find((s) => s.key === 'features')!;
  assert.ok(feat, 'default blueprint includes features section');

  // context not satisfied → features locked
  const empty: PlanSignals = {};
  assert.equal(sectionStatus(feat, bp.sections, empty).status, 'locked');

  // context done, no features yet → in-progress at fraction 0
  const ctxDone: PlanSignals = { coreConfirmed: true, topicsResolved: 2, topicsTotal: 2 };
  assert.equal(sectionStatus(feat, bp.sections, ctxDone).status, 'in-progress');

  // some features added but not confirmed → in-progress with partial fraction
  const withCount: PlanSignals = { ...ctxDone, featuresCount: 3, featuresConfirmed: false };
  const partial = sectionStatus(feat, bp.sections, withCount);
  assert.equal(partial.status, 'in-progress');
  assert.ok(partial.fraction > 0 && partial.fraction < 1);

  // features confirmed → complete
  const confirmed: PlanSignals = { ...ctxDone, featuresCount: 3, featuresConfirmed: true };
  assert.equal(sectionStatus(feat, bp.sections, confirmed).status, 'complete');
});

// ── pipeline engine ───────────────────────────────────────────────────────────

function mkPipeline(over: Partial<Pipeline> = {}): Pipeline {
  return {
    id: 'lint-plan', name: 'Lint plan', desc: '', suits: ['*'], kind: 'builtin',
    uid: 'pl-1', trigger: 'on completion', enabled: true, ...over,
  };
}

test('pipelinesForTrigger filters by enabled + matching trigger', () => {
  const pls = [
    mkPipeline({ uid: 'a', trigger: 'on completion', enabled: true }),
    mkPipeline({ uid: 'b', trigger: 'on completion', enabled: false }),
    mkPipeline({ uid: 'c', trigger: 'manual', enabled: true }),
  ];
  assert.deepEqual(pipelinesForTrigger(pls, 'on completion').map((p) => p.uid), ['a']);
});

test('runPipeline: missing handler fails gracefully; registered handler runs', async () => {
  _resetPipelineHandlers();
  const ctx: StageContext = { projectKey: 'p', stageId: 'structure', artifacts: {}, trigger: 'on completion' };
  assert.equal((await runPipeline(mkPipeline({ id: 'nope' }), ctx)).status, 'fail');
  registerPipelineHandler('lint-plan', () => ({ status: 'ok', message: 'clean' }));
  assert.equal((await runPipeline(mkPipeline(), ctx)).status, 'ok');
});

test('isGateBlocked: an unrun gate blocks; an ok run unblocks', () => {
  const gate = mkPipeline({ uid: 'g', gate: true });
  assert.equal(isGateBlocked([gate], {}), true);
  assert.equal(isGateBlocked([gate], { g: { status: 'ok', lastRun: 1 } }), false);
  assert.equal(isGateBlocked([mkPipeline({ uid: 'n', gate: false })], {}), false);
});

test('dispatchPipelineCommand routes to a module; unknown id fails structured', async () => {
  _resetPipelineModules();
  assert.equal((await dispatchPipelineCommand('x', 'run', { projectKey: 'p', args: {} })).ok, false);
  let seen = '';
  registerPipeline({ id: 'grade-plan', command: (cmd) => { seen = cmd; } });
  const res = await dispatchPipelineCommand('grade-plan', 'confirm', { projectKey: 'p', args: {} });
  assert.equal(res.ok, true);
  assert.equal(seen, 'confirm');
});

// ── planner tags ──────────────────────────────────────────────────────────────

test('parsePipelineTags: free-form args, skips unknown cmd, smart quotes', () => {
  const text = 'a <pipeline id="render-preview" cmd="run" screen="Home" mode="3d" /> b '
    + '<pipeline id="x" cmd="bogus" /> c <pipeline id=“lint-plan” cmd=“save” />';
  const tags = parsePipelineTags(text);
  assert.equal(tags.length, 2);
  assert.deepEqual(tags[0], { id: 'render-preview', cmd: 'run', args: { screen: 'Home', mode: '3d' } });
  assert.deepEqual(tags[1], { id: 'lint-plan', cmd: 'save', args: {} });
  assert.equal(stripPipelineTags('x <pipeline id="a" cmd="run" /> y').trim(), 'x  y'.trim());
});

test('parseUiPreviewTags: explicit + default mode, and stripping', () => {
  assert.deepEqual(parseUiPreviewTags('<ui_preview screen="Home" mode="3d" />'), [{ screen: 'Home', mode: '3d' }]);
  assert.deepEqual(parseUiPreviewTags('<ui_preview screen="Login" />'), [{ screen: 'Login', mode: '2d' }]);
  assert.equal(stripUiPreviewTags('p <ui_preview screen="X" /> q').includes('ui_preview'), false);
});
