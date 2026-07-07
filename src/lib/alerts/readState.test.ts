import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_READ_STATE, markAllRead, clearRead, parseReadState, serializeReadState,
  type AlertReadState,
} from './readState';
import type { AlertEvent } from './model';

const ev = (id: string, at: number): AlertEvent => ({ id, kind: 'agent-paused', text: 'x', at });

describe('markAllRead', () => {
  it('advances readAt to the newest alert', () => {
    const next = markAllRead(EMPTY_READ_STATE, [ev('a', 10), ev('b', 30), ev('c', 20)]);
    assert.equal(next.readAt, 30);
    assert.equal(next.clearedAt, 0);
  });
  it('returns the SAME reference when nothing changes', () => {
    const state: AlertReadState = { readAt: 30, clearedAt: 0 };
    assert.equal(markAllRead(state, [ev('a', 10), ev('b', 30)]), state); // all already read
    assert.equal(markAllRead(state, []), state);                          // no alerts
  });
});

describe('clearRead', () => {
  it('catches clearedAt up to readAt', () => {
    const next = clearRead({ readAt: 30, clearedAt: 0 });
    assert.equal(next.clearedAt, 30);
    assert.equal(next.readAt, 30);
  });
  it('same-reference when already caught up (never clears unread)', () => {
    const state: AlertReadState = { readAt: 30, clearedAt: 30 };
    assert.equal(clearRead(state), state);
  });
});

describe('parse / serialize', () => {
  it('round-trips', () => {
    const state: AlertReadState = { readAt: 42, clearedAt: 12 };
    assert.deepEqual(parseReadState(serializeReadState(state)), state);
  });
  it('falls back to empty on null / garbage', () => {
    assert.deepEqual(parseReadState(null), EMPTY_READ_STATE);
    assert.deepEqual(parseReadState('{not json'), EMPTY_READ_STATE);
    assert.deepEqual(parseReadState('{}'), EMPTY_READ_STATE);
  });
  it('clamps clearedAt to never exceed readAt', () => {
    assert.deepEqual(parseReadState('{"readAt":10,"clearedAt":99}'), { readAt: 10, clearedAt: 10 });
  });
});
