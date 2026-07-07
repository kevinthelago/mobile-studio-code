import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_AUTOMATIONS_VIEW, formatWhen, selectAutomationsView,
} from './automationsView';

// A well-formed frame in the desktop `buildAutomationsPayload` shape (#2498).
const payload = {
  automations: [
    {
      id: 'a1',
      name: 'Nightly triage',
      armed: true,
      when: { kind: 'simple', every: 'day', at: '09:00' },
      lastRunAt: 2_000,
      nextRunAt: 9_000,
      runs: [
        { at: 1_000, status: 'ok', note: 'dispatched' },
        { at: 3_000, status: 'fail', note: 'pane missing' },
        { at: 2_000, status: 'skipped', note: 'disarmed' },
      ],
    },
    {
      id: 'a2',
      name: 'Sweep',
      armed: false,
      when: { kind: 'cron', expr: '*/5 * * * *' },
      lastRunAt: null,
      nextRunAt: null,
      runs: [],
    },
  ],
  hooks: [
    { id: 'h1', name: 'Lint gate', enabled: true, event: 'PreToolUse', matcher: 'Bash', projects: [] },
    { id: 'h2', name: 'Log fires', enabled: false, event: 'PostToolUse', projects: ['p1', 'p2'] },
  ],
};

describe('selectAutomationsView', () => {
  it('maps schedule cards with cadence labels', () => {
    const v = selectAutomationsView(payload);
    assert.equal(v.automations.length, 2);
    const [a1, a2] = v.automations;
    assert.equal(a1.name, 'Nightly triage');
    assert.equal(a1.armed, true);
    assert.equal(a1.whenLabel, 'every day at 09:00');
    assert.equal(a1.lastRunAt, 2_000);
    assert.equal(a1.nextRunAt, 9_000);
    assert.equal(a2.whenLabel, 'cron */5 * * * *');
    assert.equal(a2.armed, false);
  });

  it('orders runs newest first regardless of payload order', () => {
    const v = selectAutomationsView(payload);
    assert.deepEqual(v.automations[0].runs.map((r) => r.at), [3_000, 2_000, 1_000]);
    assert.deepEqual(v.automations[0].runs.map((r) => r.status), ['fail', 'skipped', 'ok']);
  });

  it('caps runs at 10 and coerces unknown statuses', () => {
    const runs = Array.from({ length: 14 }, (_, i) => ({ at: i + 1, status: 'weird', note: '' }));
    const v = selectAutomationsView({ automations: [{ id: 'a', runs }], hooks: [] });
    assert.equal(v.automations[0].runs.length, 10);
    assert.equal(v.automations[0].runs[0].at, 14);
    assert.equal(v.automations[0].runs[0].status, 'unknown');
  });

  it('shows the target pane only when the payload carries it', () => {
    const v = selectAutomationsView(payload);
    assert.equal(v.automations[0].targetLabel, null); // today's projection omits it
    const withTarget = selectAutomationsView({
      automations: [{ id: 'a', targetTab: 'Build', targetPaneIdx: 1 }],
      hooks: [],
    });
    assert.equal(withTarget.automations[0].targetLabel, 'Build · pane 2');
    const tabOnly = selectAutomationsView({
      automations: [{ id: 'a', targetTab: 'Build' }],
      hooks: [],
    });
    assert.equal(tabOnly.automations[0].targetLabel, 'Build');
  });

  it('maps hooks with matcher and scope', () => {
    const v = selectAutomationsView(payload);
    assert.equal(v.hooks.length, 2);
    assert.deepEqual(v.hooks[0], {
      id: 'h1', name: 'Lint gate', enabled: true, event: 'PreToolUse',
      matcher: 'Bash', scopeLabel: 'Global', builtin: false,
    });
    assert.equal(v.hooks[1].matcher, null);
    assert.equal(v.hooks[1].scopeLabel, '2 projects');
    assert.equal(v.hasSystemFloor, false);
  });

  it('flags the system floor when the payload marks built-in hooks', () => {
    const v = selectAutomationsView({
      automations: [],
      hooks: [{ id: 'floor', name: 'bsc-deny', enabled: true, event: 'PreToolUse', projects: [], builtin: true }],
    });
    assert.equal(v.hasSystemFloor, true);
    assert.equal(v.hooks[0].builtin, true);
  });

  it('tolerates missing/partial fields', () => {
    const v = selectAutomationsView({ automations: [{}], hooks: [{}] });
    const a = v.automations[0];
    assert.equal(a.id, 'automation-0');
    assert.equal(a.name, 'automation-0');
    assert.equal(a.armed, false);
    assert.equal(a.whenLabel, '—');
    assert.equal(a.lastRunAt, null);
    assert.deepEqual(a.runs, []);
    assert.equal(v.hooks[0].event, '—');
  });

  it('drops non-object list entries and survives wire garbage', () => {
    const v = selectAutomationsView({ automations: [null, 7, 'x', { id: 'ok' }], hooks: 'nope' });
    assert.equal(v.automations.length, 1);
    assert.deepEqual(v.hooks, []);
    assert.deepEqual(selectAutomationsView(undefined), EMPTY_AUTOMATIONS_VIEW);
    assert.deepEqual(selectAutomationsView(null), EMPTY_AUTOMATIONS_VIEW);
    assert.deepEqual(selectAutomationsView([1, 2]), EMPTY_AUTOMATIONS_VIEW);
    assert.deepEqual(selectAutomationsView('junk'), EMPTY_AUTOMATIONS_VIEW);
  });
});

describe('formatWhen', () => {
  it('labels simple cadences', () => {
    assert.equal(formatWhen({ kind: 'simple', every: 'minute', at: '' }), 'every minute');
    assert.equal(formatWhen({ kind: 'simple', every: 'hour', at: ':15' }), 'every hour at :15');
    assert.equal(formatWhen({ kind: 'simple', every: 'weekday', at: '08:30' }), 'every weekday at 08:30');
    assert.equal(formatWhen({ kind: 'simple', every: 'day' }), 'every day');
  });

  it('labels cron cadences', () => {
    assert.equal(formatWhen({ kind: 'cron', expr: '0 9 * * 1' }), 'cron 0 9 * * 1');
    assert.equal(formatWhen({ kind: 'cron' }), 'cron');
  });

  it('renders — for malformed when values', () => {
    assert.equal(formatWhen(undefined), '—');
    assert.equal(formatWhen('daily'), '—');
    assert.equal(formatWhen({ kind: 'other' }), '—');
    assert.equal(formatWhen({ kind: 'simple' }), '—');
  });
});
