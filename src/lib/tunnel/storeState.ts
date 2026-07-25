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

// ── store_state_chunk reassembly (contract v2, base-studio-code#3757) ──────────────
// A `store_state` domain whose serialized json exceeds the Noise transport's per-message
// cap (~64 KB) is fragmented desktop-side into `store_state_chunk` frames — each a raw UTF-8
// slice of the json, `seq` 0..total. The phone buffers them per domain and, once every seq
// for a `rev` has arrived, concatenates them into the full json and applies it exactly as a
// `store_state`. Kept pure so it is unit-testable alongside applyStoreState.

/** The `store_state_chunk` member of the server→client union. */
export type StoreStateChunkMessage = Extract<TunnelServerMessage, { type: 'store_state_chunk' }>;

/** In-flight reassembly for ONE domain: the rev being assembled, the total expected, the
 *  received chunk strings by seq, and how many are filled. At most one rev per domain. */
export type ChunkAssembly = {
  rev: number;
  total: number;
  chunks: (string | undefined)[];
  received: number;
};

/** domain → in-flight reassembly (a newer rev supersedes a stale partial). */
export type ChunkBuffers = Record<string, ChunkAssembly>;

export type ChunkResult = {
  /** The buffers after folding the chunk. */
  buffers: ChunkBuffers;
  /** Present ONLY when this chunk completed a domain's json — apply it as a `store_state`. */
  completed?: StoreStateMessage;
};

/**
 * Fold one `store_state_chunk` into the per-domain reassembly buffers. A NEWER `rev` for the
 * domain starts a fresh assembly (dropping any stale partial); an OLDER `rev` is ignored; a
 * malformed frame (bad total/seq) is ignored. When every `seq` 0..total for the current rev has
 * arrived, the chunks concatenate into the full json and a synthetic `store_state` is returned
 * as `completed` (and that domain's buffer cleared). A lost/late chunk can therefore only DELAY
 * a domain, never wedge it — the next full rev supersedes the partial. Immutable: dropped/no-op
 * folds return the SAME `buffers` reference so callers can cheap-compare.
 */
export function applyStoreStateChunk(buffers: ChunkBuffers, msg: StoreStateChunkMessage): ChunkResult {
  const { domain, rev, seq, total, chunk } = msg;
  if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(seq) || seq < 0 || seq >= total) {
    return { buffers }; // malformed — ignore
  }
  const held = buffers[domain];
  if (held && rev < held.rev) return { buffers }; // stale chunk from an older rev — drop
  // Restart the assembly for a first-seen domain, a newer rev, or a total mismatch mid-rev.
  const fresh = !held || rev > held.rev || held.total !== total;
  const asm = fresh ? { rev, total, chunks: new Array<string | undefined>(total), received: 0 } : held;
  if (asm.chunks[seq] !== undefined) return { buffers }; // duplicate seq — no change
  const chunks = asm.chunks.slice();
  chunks[seq] = chunk;
  const received = asm.received + 1;
  if (received === total) {
    const rest = { ...buffers };
    delete rest[domain];
    return { buffers: rest, completed: { type: 'store_state', domain, rev, json: chunks.join('') } };
  }
  return { buffers: { ...buffers, [domain]: { rev, total, chunks, received } } };
}
