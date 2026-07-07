import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_DRILL,
  canDrillPop,
  drillDepth,
  drillPop,
  drillPush,
  drillTop,
  stackFromDrillId,
  topDrillId,
  type DrillStack,
} from './drillStack';

// ── push / pop / peek ───────────────────────────────────────────────────────

test('push adds a frame; top and depth follow', () => {
  const s1 = drillPush(EMPTY_DRILL, { domain: 'glance', id: 'identity-svc' });
  assert.equal(drillDepth(s1), 1);
  assert.deepEqual(drillTop(s1), { domain: 'glance', id: 'identity-svc' });
  const s2 = drillPush(s1, { domain: 'org', id: 'pool:engineer' });
  assert.equal(drillDepth(s2), 2);
  assert.equal(drillTop(s2)?.id, 'pool:engineer');
});

test('push is immutable — the input stack is untouched', () => {
  const s1 = drillPush(EMPTY_DRILL, { domain: 'glance', id: 'a' });
  const s2 = drillPush(s1, { domain: 'glance', id: 'b' });
  assert.equal(drillDepth(s1), 1);
  assert.equal(drillDepth(s2), 2);
  assert.notEqual(s1, s2);
});

test('pushing the current top again is a no-op (double-fired tap)', () => {
  const s1 = drillPush(EMPTY_DRILL, { domain: 'glance', id: 'a' });
  const s2 = drillPush(s1, { domain: 'glance', id: 'a' });
  assert.equal(s2, s1);
  // …but the same id in the OTHER domain still stacks.
  const s3 = drillPush(s1, { domain: 'org', id: 'a' });
  assert.equal(drillDepth(s3), 2);
});

test('pop removes the top; popping empty is a no-op', () => {
  const s2 = drillPush(drillPush(EMPTY_DRILL, { domain: 'glance', id: 'a' }), { domain: 'glance', id: 'b' });
  const s1 = drillPop(s2);
  assert.deepEqual(drillTop(s1), { domain: 'glance', id: 'a' });
  assert.equal(drillPop(EMPTY_DRILL), EMPTY_DRILL);
});

test('canDrillPop mirrors depth', () => {
  assert.equal(canDrillPop(EMPTY_DRILL), false);
  assert.equal(canDrillPop(drillPush(EMPTY_DRILL, { domain: 'org', id: 'x' })), true);
});

test('top of the empty stack is null', () => {
  assert.equal(drillTop(EMPTY_DRILL), null);
});

// ── desktop sync (glanceDrill / orgDrill single-id model) ───────────────────

test('topDrillId returns the topmost frame of the requested domain', () => {
  const s: DrillStack = [
    { domain: 'glance', id: 'p1' },
    { domain: 'org', id: 'pool:engineer' },
    { domain: 'glance', id: 'p2' },
  ];
  assert.equal(topDrillId(s, 'glance'), 'p2');
  assert.equal(topDrillId(s, 'org'), 'pool:engineer');
  assert.equal(topDrillId(EMPTY_DRILL, 'glance'), null);
});

test('stackFromDrillId round-trips the desktop-shaped value', () => {
  assert.equal(stackFromDrillId('glance', null), EMPTY_DRILL);
  const s = stackFromDrillId('glance', 'identity-svc', 'identity-svc');
  assert.equal(drillDepth(s), 1);
  assert.equal(topDrillId(s, 'glance'), 'identity-svc');
});
