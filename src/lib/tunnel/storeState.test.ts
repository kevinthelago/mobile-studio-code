// store_state reducer (contract v2, base-studio-code#2497): last-per-domain map with a
// monotonic per-domain rev — stale frames are dropped, fresh ones replace.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStoreState, type StoreStateMap } from './storeState';

const frame = (domain: string, rev: number, json = '{}') =>
  ({ type: 'store_state', domain, rev, json }) as const;

test('a first frame for a domain is adopted', () => {
  const next = applyStoreState({}, frame('plan', 1, '{"v":1}'));
  assert.deepEqual(next, { plan: { rev: 1, json: '{"v":1}' } });
});

test('domains are independent — one domain never touches another', () => {
  let map: StoreStateMap = {};
  map = applyStoreState(map, frame('plan', 3, '{"p":1}'));
  map = applyStoreState(map, frame('glance', 1, '{"g":1}'));
  assert.deepEqual(map, {
    plan: { rev: 3, json: '{"p":1}' },
    glance: { rev: 1, json: '{"g":1}' },
  });
});

test('a higher rev replaces the held entry (last write wins)', () => {
  let map: StoreStateMap = { plan: { rev: 1, json: '{"v":1}' } };
  map = applyStoreState(map, frame('plan', 2, '{"v":2}'));
  assert.deepEqual(map.plan, { rev: 2, json: '{"v":2}' });
});

test('a STALE (lower-rev) frame is dropped and the SAME map is returned (cheap skip)', () => {
  const map: StoreStateMap = { plan: { rev: 5, json: '{"v":5}' } };
  const next = applyStoreState(map, frame('plan', 4, '{"v":4}'));
  assert.equal(next, map, 'must return the identical object so callers can skip re-renders');
  assert.deepEqual(next.plan, { rev: 5, json: '{"v":5}' });
});

test('an EQUAL rev re-applies (a reconnect replay may republish the same rev)', () => {
  const map: StoreStateMap = { plan: { rev: 5, json: '{"old":1}' } };
  const next = applyStoreState(map, frame('plan', 5, '{"new":1}'));
  assert.notEqual(next, map);
  assert.deepEqual(next.plan, { rev: 5, json: '{"new":1}' });
});

test('the input map is never mutated', () => {
  const map: StoreStateMap = { plan: { rev: 1, json: '{"v":1}' } };
  applyStoreState(map, frame('plan', 2, '{"v":2}'));
  assert.deepEqual(map, { plan: { rev: 1, json: '{"v":1}' } });
});
