/**
 * Pure reconnect policy for the tunnel client (#217).
 *
 * TunnelClient owns the sockets and timers; this module owns the *decisions* —
 * the backoff schedule, whether a dropped socket should redial, and the coarse
 * lifecycle status the UI banner shows. Keeping it pure (no sockets, no timers,
 * injectable randomness) makes it unit-testable under `tsx --test`.
 */
import type { TunnelConnectionState } from '../types';

/** Delay before the first retry; doubles per attempt. */
export const RECONNECT_BASE_DELAY_MS = 1_000;
/** Backoff ceiling — retries never wait longer than this. */
export const RECONNECT_MAX_DELAY_MS = 30_000;
/** Jitter fraction: each delay is skewed ±15% so drops don't retry in lockstep. */
export const RECONNECT_JITTER = 0.15;

/**
 * Delay before reconnect `attempt` (0-based): 1s → 2s → 4s → … capped at 30s,
 * with ±15% jitter applied after the cap.
 *
 * @param attempt Retries already burned since the last successful auth (0 = first retry).
 * @param random Uniform [0,1) source — injectable for deterministic tests.
 */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  // Clamp the exponent: 2**31 is already far past the cap, and larger values
  // would overflow into Infinity/NaN territory for absurd attempt counts.
  const exp = Math.min(Math.max(Math.floor(attempt), 0), 31);
  const base = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** exp, RECONNECT_MAX_DELAY_MS);
  const skew = 1 + (random() * 2 - 1) * RECONNECT_JITTER;
  return Math.round(base * skew);
}

/** Everything the drop-time decision needs, captured by TunnelClient. */
export type DropContext = {
  /** The user deliberately called disconnect() — never auto-reconnect. */
  userClosed: boolean;
  /** auth_ok was reached at least once during this connect() session. */
  everConnected: boolean;
  /** Retries already burned since the last successful auth (0 = none yet). */
  attempt: number;
};

export type ReconnectDecision =
  | { reconnect: false }
  | { reconnect: true; attempt: number; delayMs: number };

/**
 * Whether a dropped socket should auto-reconnect, and after how long.
 *
 * Policy: only sessions that actually established (auth_ok) auto-reconnect. A
 * failed FIRST connect (stale QR, relay down, desktop off) stays manual, so
 * the pairing screen's failure diagnosis is what the user sees — not a silent
 * retry loop against a desktop that was never there. A deliberate disconnect()
 * never reconnects. Eligible retries continue indefinitely at the capped
 * delay; disconnect() stops them.
 *
 * @returns On `reconnect: true`, `attempt` is the new burned-retry count to
 *          store and `delayMs` the jittered wait before redialling.
 */
export function decideReconnect(
  ctx: DropContext,
  random: () => number = Math.random,
): ReconnectDecision {
  if (ctx.userClosed || !ctx.everConnected) return { reconnect: false };
  const attempt = Math.max(Math.floor(ctx.attempt), 0);
  return { reconnect: true, attempt: attempt + 1, delayMs: backoffDelayMs(attempt, random) };
}

/** Coarse connection status surfaced through TunnelContext for the UI banner. */
export type TunnelLifecycleStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** The wire state + reconnect bookkeeping the status derives from. */
export type LifecycleContext = {
  wireState: TunnelConnectionState;
  /** auth_ok was reached at least once during this connect() session. */
  everConnected: boolean;
  /** A reconnect timer is armed (waiting out the backoff). */
  retryPending: boolean;
  /** The user deliberately called disconnect(). */
  userClosed: boolean;
};

/**
 * Derive the banner status. 'reconnecting' spans both the backoff wait and the
 * redial attempt itself; 'connecting' is only the first (manual) dial of a
 * session; anything terminal with no retry armed is 'offline'.
 */
export function deriveLifecycleStatus(ctx: LifecycleContext): TunnelLifecycleStatus {
  if (ctx.wireState === 'connected') return 'connected';
  if (ctx.userClosed) return 'offline';
  if (ctx.retryPending) return 'reconnecting';
  if (ctx.wireState === 'connecting' || ctx.wireState === 'authenticating') {
    return ctx.everConnected ? 'reconnecting' : 'connecting';
  }
  return 'offline'; // disconnected / error with no retry armed
}
