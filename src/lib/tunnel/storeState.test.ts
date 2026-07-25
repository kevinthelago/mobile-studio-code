// store_state reducer (contract v2, base-studio-code#2497): last-per-domain map with a
// monotonic per-domain rev — stale frames are dropped, fresh ones replace.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStoreState, applyStoreStateChunk, type StoreStateMap, type ChunkBuffers } from './storeState';

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

// ── store_state_chunk reassembly (base-studio-code#3757) ──
const chunkFrame = (domain: string, rev: number, seq: number, total: number, chunk: string) =>
  ({ type: 'store_state_chunk', domain, rev, seq, total, chunk }) as const;

test('chunks reassemble in order into a completed store_state, clearing the buffer', () => {
  let buffers: ChunkBuffers = {};
  const first = applyStoreStateChunk(buffers, chunkFrame('components', 7, 0, 2, '{"kits":'));
  assert.equal(first.completed, undefined, 'not complete after the first of two');
  buffers = first.buffers;
  const done = applyStoreStateChunk(buffers, chunkFrame('components', 7, 1, 2, '[]}'));
  assert.deepEqual(done.completed, { type: 'store_state', domain: 'components', rev: 7, json: '{"kits":[]}' });
  assert.deepEqual(done.buffers, {}, 'the domain buffer is cleared on completion');
});

test('out-of-order chunks reassemble by seq index', () => {
  let buffers: ChunkBuffers = {};
  buffers = applyStoreStateChunk(buffers, chunkFrame('components', 1, 2, 3, 'c')).buffers;
  buffers = applyStoreStateChunk(buffers, chunkFrame('components', 1, 0, 3, 'a')).buffers;
  const done = applyStoreStateChunk(buffers, chunkFrame('components', 1, 1, 3, 'b'));
  assert.equal(done.completed?.json, 'abc');
});

test('a single-chunk domain (total 1) completes immediately', () => {
  const done = applyStoreStateChunk({}, chunkFrame('components', 1, 0, 1, '{"whole":true}'));
  assert.deepEqual(done.completed, { type: 'store_state', domain: 'components', rev: 1, json: '{"whole":true}' });
});

test('a NEWER rev mid-reassembly drops the stale partial and starts fresh', () => {
  const stale = applyStoreStateChunk({}, chunkFrame('components', 1, 0, 2, 'old')).buffers;
  const a = applyStoreStateChunk(stale, chunkFrame('components', 2, 0, 2, 'new-a'));
  assert.equal(a.buffers.components.rev, 2);
  assert.equal(a.buffers.components.received, 1, 'the rev-1 partial did not carry over');
  const done = applyStoreStateChunk(a.buffers, chunkFrame('components', 2, 1, 2, 'new-b'));
  assert.deepEqual(done.completed, { type: 'store_state', domain: 'components', rev: 2, json: 'new-anew-b' });
});

test('a chunk from an OLDER rev is dropped (identical buffers returned)', () => {
  const buffers = applyStoreStateChunk({}, chunkFrame('components', 5, 0, 2, 'x')).buffers;
  const r = applyStoreStateChunk(buffers, chunkFrame('components', 4, 1, 2, 'stale'));
  assert.equal(r.buffers, buffers, 'stale-rev chunk is a no-op');
  assert.equal(r.completed, undefined);
});

test('a DUPLICATE seq is ignored (no double-count, identical buffers)', () => {
  const buffers = applyStoreStateChunk({}, chunkFrame('components', 1, 0, 2, 'a')).buffers;
  const r = applyStoreStateChunk(buffers, chunkFrame('components', 1, 0, 2, 'a-again'));
  assert.equal(r.buffers, buffers);
  assert.equal(r.buffers.components.received, 1);
});

test('a malformed chunk (seq >= total) is ignored', () => {
  const r = applyStoreStateChunk({}, chunkFrame('components', 1, 2, 2, 'x'));
  assert.deepEqual(r.buffers, {});
  assert.equal(r.completed, undefined);
});

test('the input buffers are never mutated', () => {
  const buffers: ChunkBuffers = {};
  applyStoreStateChunk(buffers, chunkFrame('components', 1, 0, 2, 'a'));
  assert.deepEqual(buffers, {}, 'the original buffers object stays empty');
});
