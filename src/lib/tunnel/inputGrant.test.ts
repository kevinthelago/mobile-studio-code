// Client-side input-grant tracking (base-studio-code#2511). The desktop puts its
// view-only gate on the wire — auth_ok.inputGranted (connect-time snapshot) +
// input_grant_changed (live toggles) — and TunnelClient mirrors it as
// `boolean | null` (null = a pre-#2511 desktop that never signals it). These tests
// drive the client's message handler directly (no WebSocket) and close the loop
// into decideInputGate, which SessionChat feeds with exactly this value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TunnelClient, TunnelCallbacks } from '../tunnel';
import type { TunnelServerMessage } from '../types';
import { decideInputGate } from '../sessions/inputGate';

/** TunnelClient with handleMessage exposed for driving frames in tests. */
type Drivable = { handleMessage(msg: TunnelServerMessage): void };

function makeClient(events: Array<boolean | null>) {
  const callbacks: TunnelCallbacks = {
    onConnectionStateChange: () => {},
    onPanesChange: () => {},
    onUserRequest: () => {},
    onInputGrantChanged: (granted) => events.push(granted),
  };
  const client = new TunnelClient(callbacks);
  return { client, drive: client as unknown as Drivable };
}

test('auth_ok seeds the grant and fires the callback (explicit false = view-only)', () => {
  const events: Array<boolean | null> = [];
  const { client, drive } = makeClient(events);
  assert.equal(client.getInputGranted(), null, 'unknown before any frame');

  drive.handleMessage({ type: 'auth_ok', protocolVersion: 2, inputGranted: false });
  assert.equal(client.getInputGranted(), false);
  assert.deepEqual(events, [false]);
});

test('a pre-#2511 auth_ok (no inputGranted) leaves the grant unknown (null)', () => {
  const events: Array<boolean | null> = [];
  const { client, drive } = makeClient(events);

  drive.handleMessage({ type: 'auth_ok', protocolVersion: 2 });
  assert.equal(client.getInputGranted(), null, 'old desktop never signals the grant');
  assert.deepEqual(events, [null]);
});

test('input_grant_changed toggles the tracked grant live', () => {
  const events: Array<boolean | null> = [];
  const { client, drive } = makeClient(events);
  drive.handleMessage({ type: 'auth_ok', protocolVersion: 2, inputGranted: false });

  drive.handleMessage({ type: 'input_grant_changed', granted: true });
  assert.equal(client.getInputGranted(), true);

  drive.handleMessage({ type: 'input_grant_changed', granted: false });
  assert.equal(client.getInputGranted(), false);

  assert.deepEqual(events, [false, true, false]);
});

test('integration: the tracked grant drives decideInputGate exactly as SessionChat feeds it', () => {
  const events: Array<boolean | null> = [];
  const { client, drive } = makeClient(events);

  // Freshly paired to a #2511 desktop: view-only rides in auth_ok → input disabled
  // with the grant-on-desktop hint (no attempt needed — the state is explicit now).
  drive.handleMessage({ type: 'auth_ok', protocolVersion: 2, inputGranted: false });
  const viewOnly = decideInputGate({
    connected: true, inputGranted: client.getInputGranted(), attempted: false,
  });
  assert.equal(viewOnly.status, 'view-only');
  assert.equal(viewOnly.editable, false);

  // The desktop grants input → the gate opens immediately.
  drive.handleMessage({ type: 'input_grant_changed', granted: true });
  const ready = decideInputGate({
    connected: true, inputGranted: client.getInputGranted(), attempted: false,
  });
  assert.deepEqual(ready, { status: 'ready', editable: true, hint: null });

  // Old desktop (no grant on the wire): the honest `unknown` branch is preserved —
  // editable, hint only after an attempt.
  const { client: old, drive: oldDrive } = makeClient([]);
  oldDrive.handleMessage({ type: 'auth_ok', protocolVersion: 2 });
  const unknown = decideInputGate({
    connected: true, inputGranted: old.getInputGranted(), attempted: false,
  });
  assert.equal(unknown.status, 'unconfirmed');
  assert.equal(unknown.editable, true);
});
