import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECONNECT_BASE_DELAY_MS, RECONNECT_JITTER, RECONNECT_MAX_DELAY_MS,
  backoffDelayMs, decideReconnect, deriveLifecycleStatus,
} from './reconnect';
import type { DropContext, LifecycleContext } from './reconnect';

/** random() = 0.5 → jitter skew of exactly 1.0 (the nominal schedule). */
const noJitter = () => 0.5;

// ── Backoff schedule ─────────────────────────────────────────────────────────

test('backoff doubles from 1s and caps at 30s (nominal, no jitter)', () => {
  assert.equal(backoffDelayMs(0, noJitter), 1_000);
  assert.equal(backoffDelayMs(1, noJitter), 2_000);
  assert.equal(backoffDelayMs(2, noJitter), 4_000);
  assert.equal(backoffDelayMs(3, noJitter), 8_000);
  assert.equal(backoffDelayMs(4, noJitter), 16_000);
  assert.equal(backoffDelayMs(5, noJitter), 30_000); // 32s → capped
  assert.equal(backoffDelayMs(20, noJitter), RECONNECT_MAX_DELAY_MS);
});

test('jitter skews the delay by at most ±15% of the nominal value', () => {
  // Extremes of the injected uniform source hit the exact bounds.
  assert.equal(backoffDelayMs(2, () => 0), Math.round(4_000 * (1 - RECONNECT_JITTER)));
  assert.equal(backoffDelayMs(2, () => 0.999999), Math.round(4_000 * (1 + 0.999998 * RECONNECT_JITTER)));
  // And every sample stays inside [0.85·base, 1.15·base].
  for (let i = 0; i < 200; i++) {
    const d = backoffDelayMs(3);
    assert.ok(d >= 8_000 * (1 - RECONNECT_JITTER) && d <= 8_000 * (1 + RECONNECT_JITTER),
      `attempt 3 delay ${d} outside jitter bounds`);
  }
});

test('degenerate attempt values clamp instead of exploding', () => {
  assert.equal(backoffDelayMs(-3, noJitter), RECONNECT_BASE_DELAY_MS); // negative → first retry
  assert.equal(backoffDelayMs(2.9, noJitter), 4_000); // fractional → floored
  assert.equal(backoffDelayMs(10_000, noJitter), RECONNECT_MAX_DELAY_MS); // huge → capped, finite
});

// ── Reconnect decision ───────────────────────────────────────────────────────

const dropped = (over: Partial<DropContext> = {}): DropContext => ({
  userClosed: false, everConnected: true, attempt: 0, ...over,
});

test('a dropped established session reconnects', () => {
  const d = decideReconnect(dropped(), noJitter);
  assert.deepEqual(d, { reconnect: true, attempt: 1, delayMs: 1_000 });
});

test('a deliberate disconnect() never reconnects', () => {
  assert.deepEqual(decideReconnect(dropped({ userClosed: true }), noJitter), { reconnect: false });
  // …even mid-retry-loop.
  assert.deepEqual(
    decideReconnect(dropped({ userClosed: true, attempt: 4 }), noJitter),
    { reconnect: false },
  );
});

test('a first connect that never established stays manual (no retry loop)', () => {
  assert.deepEqual(decideReconnect(dropped({ everConnected: false }), noJitter), { reconnect: false });
});

test('consecutive drops walk the backoff schedule and never give up', () => {
  const delays: number[] = [];
  let attempt = 0;
  for (let i = 0; i < 7; i++) {
    const d = decideReconnect(dropped({ attempt }), noJitter);
    assert.ok(d.reconnect, `retry ${i} should still reconnect`);
    delays.push(d.delayMs);
    attempt = d.attempt;
  }
  assert.deepEqual(delays, [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  assert.equal(attempt, 7);
});

test('a successful auth resets the schedule (attempt 0 → 1s again)', () => {
  // TunnelClient zeroes reconnectAttempt on auth_ok; the next drop starts over.
  const d = decideReconnect(dropped({ attempt: 0 }), noJitter);
  assert.ok(d.reconnect);
  assert.equal(d.delayMs, 1_000);
});

// ── Lifecycle status derivation ──────────────────────────────────────────────

const ctx = (over: Partial<LifecycleContext>): LifecycleContext => ({
  wireState: 'disconnected', everConnected: false, retryPending: false, userClosed: false, ...over,
});

test('first manual dial reads connecting (through the auth phase)', () => {
  assert.equal(deriveLifecycleStatus(ctx({ wireState: 'connecting' })), 'connecting');
  assert.equal(deriveLifecycleStatus(ctx({ wireState: 'authenticating' })), 'connecting');
});

test('an established session reads connected', () => {
  assert.equal(deriveLifecycleStatus(ctx({ wireState: 'connected', everConnected: true })), 'connected');
});

test('a drop with a retry armed reads reconnecting (backoff wait + redial)', () => {
  // Waiting out the backoff:
  assert.equal(
    deriveLifecycleStatus(ctx({ wireState: 'disconnected', everConnected: true, retryPending: true })),
    'reconnecting',
  );
  // The redial attempt itself (timer fired, socket dialling / re-authing):
  assert.equal(
    deriveLifecycleStatus(ctx({ wireState: 'connecting', everConnected: true })),
    'reconnecting',
  );
  assert.equal(
    deriveLifecycleStatus(ctx({ wireState: 'authenticating', everConnected: true })),
    'reconnecting',
  );
});

test('user disconnect and terminal failures read offline', () => {
  assert.equal(
    deriveLifecycleStatus(ctx({ wireState: 'disconnected', everConnected: true, userClosed: true })),
    'offline',
  );
  // Failed first connect (diagnosed error, no retry armed):
  assert.equal(deriveLifecycleStatus(ctx({ wireState: 'error' })), 'offline');
  // Idle before any dial:
  assert.equal(deriveLifecycleStatus(ctx({})), 'offline');
});

test('full drop→reconnect walk-through transitions in order', () => {
  const seen: string[] = [];
  const emit = (c: LifecycleContext) => seen.push(deriveLifecycleStatus(c));
  emit(ctx({ wireState: 'connecting' }));                                          // manual dial
  emit(ctx({ wireState: 'connected', everConnected: true }));                      // auth_ok
  emit(ctx({ wireState: 'disconnected', everConnected: true, retryPending: true })); // drop, timer armed
  emit(ctx({ wireState: 'connecting', everConnected: true }));                     // timer fired, redial
  emit(ctx({ wireState: 'connected', everConnected: true }));                      // re-established
  emit(ctx({ wireState: 'disconnected', everConnected: true, userClosed: true })); // user disconnects
  assert.deepEqual(seen, [
    'connecting', 'connected', 'reconnecting', 'reconnecting', 'connected', 'offline',
  ]);
});
