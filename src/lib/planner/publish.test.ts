import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBlueprints } from './core';
import { createPlanProject } from './project';
import { buildPublishPlan, buildIssueBody, defaultRepoFromPlan } from './publishPlan';

function project() {
  return createPlanProject(makeBlueprints().find((b) => b.id === 'default')!, { id: 'p', title: 'T', now: 0 });
}

test('buildPublishPlan: milestones from phases.json, issues with bodies + labels', () => {
  const p = project();
  p.sections['phases.json'] = { state: 'confirmed', content: '[{"name":"MVP","description":"first cut"}]' };
  p.sections['issues.json'] = {
    state: 'confirmed',
    content: JSON.stringify([
      { title: 'Add auth', acceptance: 'login works', files: ['src/auth.ts'], deps: ['#2'], labels: ['feature'], milestone: 'MVP' },
    ]),
  };
  const plan = buildPublishPlan(p);
  assert.deepEqual(plan.milestones, [{ name: 'MVP', description: 'first cut' }]);
  assert.equal(plan.issues.length, 1);
  assert.equal(plan.issues[0].title, 'Add auth');
  assert.deepEqual(plan.issues[0].labels, ['feature']);
  assert.equal(plan.issues[0].milestone, 'MVP');
  assert.match(plan.issues[0].body, /Acceptance criteria/);
  assert.match(plan.issues[0].body, /src\/auth\.ts/);
});

test('buildPublishPlan: warns on unknown milestone, missing acceptance, no issues', () => {
  const p = project();
  p.sections['issues.json'] = { state: 'confirmed', content: '[{"title":"x","milestone":"Ghost"}]' };
  const plan = buildPublishPlan(p);
  assert.ok(plan.warnings.some((w) => /Ghost/.test(w)));
  assert.ok(plan.warnings.some((w) => /no acceptance criteria/.test(w)));

  const empty = buildPublishPlan(project());
  assert.ok(empty.warnings.some((w) => /No issues to publish/.test(w)));
  assert.equal(empty.issues.length, 0);
});

test('buildPublishPlan: skips issues without a title', () => {
  const p = project();
  p.sections['issues.json'] = { state: 'confirmed', content: '[{"acceptance":"x"},{"title":"ok"}]' };
  const plan = buildPublishPlan(p);
  assert.equal(plan.issues.length, 1);
  assert.ok(plan.warnings.some((w) => /no title/.test(w)));
});

test('buildIssueBody composes the agent-ready fields', () => {
  const body = buildIssueBody({ acceptance: 'done when X', files: ['a.ts', 'b.ts'], deps: ['#1'], stream: 'ui' });
  assert.match(body, /## Acceptance criteria\ndone when X/);
  assert.match(body, /- `a\.ts`/);
  assert.match(body, /\*\*Stream:\*\* ui/);
});

test('defaultRepoFromPlan reads repos.json (owner/repo or fullName)', () => {
  const p = project();
  p.sections['repos.json'] = { state: 'confirmed', content: '[{"owner":"kevinthelago","repo":"demo"}]' };
  assert.equal(defaultRepoFromPlan(p), 'kevinthelago/demo');

  const p2 = project();
  p2.sections['repos.json'] = { state: 'confirmed', content: '[{"fullName":"a/b"}]' };
  assert.equal(defaultRepoFromPlan(p2), 'a/b');

  assert.equal(defaultRepoFromPlan(project()), undefined);
});
