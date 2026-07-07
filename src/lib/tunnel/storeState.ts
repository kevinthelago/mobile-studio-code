// store_state reducer (contract v2, base-studio-code#2497). The desktop broadcasts a
// generic projection frame per store domain — `{ domain, rev, json }` — replaying the
// last frame per domain on connect. The phone folds them into a domain → {rev, json}
// map. Kept pure (no React Native / WebSocket imports) so it is unit-testable under
// node/tsx, mirroring input.ts / paneSize.ts.

import type { StoreStateEntry, TunnelServerMessage } from '../types';

/** The `store_state` member of the server→client union. */
export type StoreStateMessage = Extract<TunnelServerMessage, { type: 'store_state' }>;

/** The mirrored store projections: domain → last accepted {rev, json}. */
export type StoreStateMap = Record<string, StoreStateEntry>;

/**
 * Fold one `store_state` frame into the map. Revisions are per-domain and monotonic on
 * the desktop side, so a frame whose `rev` is BELOW the held one is stale (out-of-order
 * delivery / a replay racing a live push) and is dropped — the same map object is
 * returned so callers can cheap-compare to skip re-renders. An equal `rev` re-applies
 * (the desktop may republish the same rev after a reconnect; content wins over dedupe).
 */
export function applyStoreState(map: StoreStateMap, msg: StoreStateMessage): StoreStateMap {
  const held = map[msg.domain];
  if (held && msg.rev < held.rev) return map; // stale — drop
  return { ...map, [msg.domain]: { rev: msg.rev, json: msg.json } };
}
