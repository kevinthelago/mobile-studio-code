// Local read/cleared tracking for the alerts inbox (#222). PURE — the
// SecureStore persistence lives in AlertsContext (this module stays
// unit-testable under node/tsx).
//
// Read-state is DEVICE-LOCAL UX state, deliberately watermark-based rather
// than per-id: two epoch-ms watermarks cover the whole inbox in a handful of
// bytes (SecureStore values are size-limited) and survive the desktop's
// rolling-inbox cap dropping old entries.
//
//   readAt    — everything at or before this is read (viewing the inbox
//               advances it to the newest alert).
//   clearedAt — everything at or before this is hidden ("clear read"); only
//               ever advanced to readAt, so an unread alert can never be
//               cleared unseen.

import type { AlertEvent } from './model';

export interface AlertReadState {
  readAt: number;
  clearedAt: number;
}

export const EMPTY_READ_STATE: AlertReadState = { readAt: 0, clearedAt: 0 };

/**
 * Mark every current alert read: advance `readAt` to the newest alert's
 * timestamp. Returns the SAME reference when nothing changes (no alerts, or
 * all already read) so callers can cheap-skip persistence.
 */
export function markAllRead(
  state: AlertReadState,
  alerts: ReadonlyArray<AlertEvent>,
): AlertReadState {
  let newest = state.readAt;
  for (const a of alerts) if (a.at > newest) newest = a.at;
  if (newest === state.readAt) return state;
  return { ...state, readAt: newest };
}

/**
 * Hide everything already read (`clearedAt` catches up to `readAt`). Unread
 * alerts are untouched. Same-reference when already caught up.
 */
export function clearRead(state: AlertReadState): AlertReadState {
  if (state.clearedAt === state.readAt) return state;
  return { ...state, clearedAt: state.readAt };
}

/** Parse a persisted read-state blob; anything malformed falls back to empty. */
export function parseReadState(raw: string | null): AlertReadState {
  if (!raw) return EMPTY_READ_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<AlertReadState> | null;
    const readAt = typeof parsed?.readAt === 'number' && Number.isFinite(parsed.readAt)
      ? parsed.readAt : 0;
    const clearedAt = typeof parsed?.clearedAt === 'number' && Number.isFinite(parsed.clearedAt)
      ? parsed.clearedAt : 0;
    // clearedAt can never exceed readAt (cleared implies read).
    return { readAt, clearedAt: Math.min(clearedAt, readAt) };
  } catch {
    return EMPTY_READ_STATE;
  }
}

export function serializeReadState(state: AlertReadState): string {
  return JSON.stringify(state);
}
