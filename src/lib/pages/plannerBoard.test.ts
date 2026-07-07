import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectPlanBoard } from './plannerBoard';

const full = () => ({
  projectId: 'p-1',
  title: 'My App',
  currentStage: 'scope',
  statusLabel: 'in_progress',
  gateReady: true,
  planComplete: false,
  stages: [
    { key: 'goal', name: 'Goal', glyph: '◎', status: 'complete', fraction: 1, unmet: [] },
    { key: 'scope', name: 'Scope', glyph: '◇', status: 'active', fraction: 0.5, unmet: [{ label: 'Confirm scope' }] },
  ],
  confirmed: ['goal'],
  skipped: [],
  streams: [{ id: 's1', name: 'Auth', repo: 'app', issues: 3, dependsOn: [], persona: 'p' }],
  directorEnabled: true,
  deploy: { defined: true, services: [{ id: 'svc', repo: 'app', platform: 'fly', workload: 'web' }] },
  market: { defined: true, summary: 'B2B', recommendation: 'ship' },
});

describe('selectPlanBoard', () => {
  it('parses a full payload and derives canAct', () => {
    const m = selectPlanBoard(full())!;
    assert.equal(m.title, 'My App');
    assert.equal(m.stages.length, 2);
    assert.equal(m.stages[1].unmet[0].label, 'Confirm scope');
    assert.equal(m.streams[0].issues, 3);
    assert.equal(m.deploy.services.length, 1);
    assert.equal(m.market.recommendation, 'ship');
    assert.equal(m.canAct, true);
  });

  it('canAct is false without a passed gate', () => {
    const m = selectPlanBoard({ ...full(), gateReady: false })!;
    assert.equal(m.canAct, false);
  });

  it('canAct is false with no current stage', () => {
    const m = selectPlanBoard({ ...full(), currentStage: '' })!;
    assert.equal(m.canAct, false);
  });

  it('returns undefined for missing / malformed payloads', () => {
    assert.equal(selectPlanBoard(undefined), undefined);
    assert.equal(selectPlanBoard({}), undefined);
    assert.equal(selectPlanBoard({ title: 'no projectId' }), undefined);
  });

  it('tolerates absent optional collections', () => {
    const m = selectPlanBoard({ projectId: 'p' })!;
    assert.deepEqual(m.stages, []);
    assert.deepEqual(m.streams, []);
    assert.equal(m.deploy.defined, false);
    assert.equal(m.market.summary, '');
  });
});
