import test from 'node:test';
import assert from 'node:assert/strict';
import type { PaneDescriptor, PaneState } from '../types';
import {
  buildRoster, findPlannerPane, paneKind, shortCwd, toRosterEntry, KIND_ORDER,
} from './roster';

function desc(over: Partial<PaneDescriptor> & { id: string }): PaneDescriptor {
  return { cwd: '/home/k/proj', name: over.id, status: 'idle', ...over };
}

function pane(over: Partial<PaneState> & { descriptor: PaneDescriptor }): PaneState {
  return {
    streamingState: 'minimized',
    outputBuffer: '',
    sessionState: null,
    ptySize: null,
    hasUserRequest: false,
    lastUserRequestAt: null,
    lastActivityAt: null,
    ...over,
  };
}

function panesOf(...list: PaneState[]): Record<string, PaneState> {
  return Object.fromEntries(list.map((p) => [p.descriptor.id, p]));
}

// ── paneKind ──────────────────────────────────────────────────────────────────

test('wire kind wins when present', () => {
  assert.equal(paneKind(desc({ id: 't0p0', kind: 'worker' })), 'worker');
  assert.equal(paneKind(desc({ id: 'planning_x', kind: 'triage' })), 'triage');
});

test('pre-v2 fallback infers planner/designer from the session-identity id', () => {
  assert.equal(paneKind(desc({ id: 'planning_p-abc' })), 'planner');
  assert.equal(paneKind(desc({ id: 'design-studio:designer' })), 'designer');
});

test('pre-v2 fallback treats everything else as console (the wire default)', () => {
  assert.equal(paneKind(desc({ id: 't0p0' })), 'console');
  assert.equal(paneKind(desc({ id: 'myproj:api' })), 'console');
});

// ── shortCwd ──────────────────────────────────────────────────────────────────

test('shortCwd keeps the last two segments, both separator styles', () => {
  assert.equal(shortCwd('/home/kevin/Projects/app'), 'Projects/app');
  assert.equal(shortCwd('C:\\Users\\Kevin\\Projects\\rust\\base-studio-code'), 'rust/base-studio-code');
  assert.equal(shortCwd('app'), 'app');
  assert.equal(shortCwd(''), '');
});

// ── toRosterEntry ─────────────────────────────────────────────────────────────

test('the structured session_state status wins over the descriptor status', () => {
  const p = pane({
    descriptor: desc({ id: 't0p0', status: 'idle' }),
    sessionState: {
      paneId: 't0p0', status: 'awaiting_input', currentTask: '', lastActivity: '', prompt: 'go?',
    },
  });
  assert.equal(toRosterEntry(p).status, 'awaiting_input');
});

test('name falls back to the pane id when the desktop sent none', () => {
  const p = pane({ descriptor: desc({ id: 'proj:api', name: '' }) });
  assert.equal(toRosterEntry(p).name, 'proj:api');
});

// ── buildRoster ───────────────────────────────────────────────────────────────

test('groups by kind in the spec order, omitting empty groups', () => {
  const roster = buildRoster(panesOf(
    pane({ descriptor: desc({ id: 'planning_x', kind: 'planner' }) }),
    pane({ descriptor: desc({ id: 't0p0', kind: 'console' }) }),
    pane({ descriptor: desc({ id: 'proj:api', kind: 'worker' }) }),
  ));
  assert.deepEqual(roster.map((s) => s.kind), ['console', 'worker', 'planner']);
  // spec order is console / worker / planner / designer / triage
  assert.deepEqual([...KIND_ORDER], ['console', 'worker', 'planner', 'designer', 'triage']);
});

test('within a group: awaiting-input floats first (most recent request first)', () => {
  const roster = buildRoster(panesOf(
    pane({ descriptor: desc({ id: 'a', kind: 'worker' }), lastActivityAt: 900 }),
    pane({
      descriptor: desc({ id: 'b', kind: 'worker' }),
      hasUserRequest: true, lastUserRequestAt: 100, lastActivityAt: 100,
    }),
    pane({
      descriptor: desc({ id: 'c', kind: 'worker' }),
      hasUserRequest: true, lastUserRequestAt: 200, lastActivityAt: 50,
    }),
  ));
  assert.equal(roster.length, 1);
  assert.deepEqual(roster[0].entries.map((e) => e.paneId), ['c', 'b', 'a']);
});

test('non-waiting sessions order by last activity, newest first, then name', () => {
  const roster = buildRoster(panesOf(
    pane({ descriptor: desc({ id: 'older' }), lastActivityAt: 10 }),
    pane({ descriptor: desc({ id: 'newer' }), lastActivityAt: 20 }),
    pane({ descriptor: desc({ id: 'alpha' }), lastActivityAt: null }),
    pane({ descriptor: desc({ id: 'beta' }), lastActivityAt: null }),
  ));
  assert.deepEqual(roster[0].entries.map((e) => e.paneId), ['newer', 'older', 'alpha', 'beta']);
});

test('an empty panes map yields an empty roster', () => {
  assert.deepEqual(buildRoster({}), []);
});

// ── findPlannerPane ───────────────────────────────────────────────────────────

test('finds the planning_<key> session, most recently active first', () => {
  const panes = panesOf(
    pane({ descriptor: desc({ id: 't0p0', kind: 'console' }), lastActivityAt: 999 }),
    pane({ descriptor: desc({ id: 'planning_old', kind: 'planner' }), lastActivityAt: 1 }),
    pane({ descriptor: desc({ id: 'planning_new', kind: 'planner' }), lastActivityAt: 2 }),
  );
  assert.equal(findPlannerPane(panes)?.descriptor.id, 'planning_new');
});

test('finds a pre-v2 planner (no kind on the wire) by its id shape', () => {
  const panes = panesOf(pane({ descriptor: desc({ id: 'planning_p-x' }) }));
  assert.equal(findPlannerPane(panes)?.descriptor.id, 'planning_p-x');
});

test('returns null when no planner session is running', () => {
  const panes = panesOf(pane({ descriptor: desc({ id: 't0p0' }) }));
  assert.equal(findPlannerPane(panes), null);
});
