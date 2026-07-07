import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideInputGate, OFFLINE_HINT, UNCONFIRMED_HINT, VIEW_ONLY_HINT,
} from './inputGate';

test('disconnected → disabled with the offline hint, regardless of grant', () => {
  for (const inputGranted of [true, false, null] as const) {
    const d = decideInputGate({ connected: false, inputGranted, attempted: true });
    assert.equal(d.status, 'offline');
    assert.equal(d.editable, false);
    assert.equal(d.hint, OFFLINE_HINT);
  }
});

test('explicit view-only → disabled with the grant-on-desktop hint', () => {
  const d = decideInputGate({ connected: true, inputGranted: false, attempted: false });
  assert.equal(d.status, 'view-only');
  assert.equal(d.editable, false);
  assert.equal(d.hint, VIEW_ONLY_HINT);
});

test('explicit grant → fully editable, no hint', () => {
  const d = decideInputGate({ connected: true, inputGranted: true, attempted: true });
  assert.deepEqual(d, { status: 'ready', editable: true, hint: null });
});

test('unknown grant (the current wire) → editable, silent until an attempt', () => {
  const before = decideInputGate({ connected: true, inputGranted: null, attempted: false });
  assert.deepEqual(before, { status: 'unconfirmed', editable: true, hint: null });

  const after = decideInputGate({ connected: true, inputGranted: null, attempted: true });
  assert.equal(after.status, 'unconfirmed');
  assert.equal(after.editable, true);
  assert.equal(after.hint, UNCONFIRMED_HINT);
});
