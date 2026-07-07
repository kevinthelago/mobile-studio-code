import type { MirrorFrame } from './state';
import type { StoreStateMap } from '../tunnel/storeState';

/**
 * The adapter between the tunnel's `store_state` map (contract v2,
 * base-studio-code#2497) and the mirror consumer tree.
 *
 * The tunnel client folds each `store_state { domain, rev, json }` frame into a
 * domain → {rev, json} map and hands it to `TunnelContext`. `MirrorProvider`
 * re-derives one `MirrorFrame` per domain from that map and dispatches them
 * into the mirror reducer — which is rev-deduped, so re-deriving the whole map
 * on every change is idempotent (already-seen domains fold to a no-op). This
 * keeps the transport out of the mirror tree: the reducer, `useMirrorDomain`,
 * and every page keep their exact shape.
 *
 * The wire carries each projection as an OPAQUE serialized string
 * (`StoreStateEntry.json`); this is where it's parsed once, so every page reads
 * a structured value from `useMirrorDomain(...).data` exactly as the desktop's
 * own pages do. Malformed JSON parses to `undefined` — the page falls back to
 * its awaiting/empty state rather than crashing the tree.
 *
 * Pure (no React / WebSocket imports) so it stays unit-testable under node/tsx.
 */
export function mirrorFramesFrom(map: StoreStateMap): MirrorFrame[] {
  const frames: MirrorFrame[] = [];
  for (const domain of Object.keys(map)) {
    const entry = map[domain];
    if (entry) frames.push({ domain, rev: entry.rev, json: parseProjection(entry.json) });
  }
  return frames;
}

function parseProjection(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
