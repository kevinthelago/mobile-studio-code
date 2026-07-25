// The desktop-override half of the data-driven UI. When the tunnel is connected and the mirrored
// `components` domain carries a `spec` on a card (base-studio-code adds `spec?: GeneralNode` to its
// ComponentCard projection), that spec beats the bundled baseline of the same id — so the desktop can
// push a UI change to the phone without an app rebuild (sanctioned SDUI: DATA, not code). Until that
// payload field ships this returns {} and SpecHost falls back to the baseline, so wiring it now is
// safe and forward-ready.
//
// Pure + node-safe (no React) so the parse/validate is unit-testable. A live spec is used ONLY if it
// validates against the vendored manifest; an invalid push is ignored (baseline wins) rather than
// rendering broken.
import type { GeneralNode } from './generalNode';
import { validateGeneralNode } from './generalNode';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const EMPTY: Record<string, GeneralNode> = Object.freeze({});
// Memoize by the payload object reference — the mirror reducer keeps a stable reference for an
// unchanged domain (rev-deduped), so many SpecHosts share one parse of a 68-card payload.
const cache = new WeakMap<object, Record<string, GeneralNode>>();

/** Extract `id → spec` from the mirrored `components` payload, keeping only specs that validate. */
export function selectLiveSpecs(data: unknown): Record<string, GeneralNode> {
  if (!isObj(data)) return EMPTY;
  const hit = cache.get(data);
  if (hit) return hit;

  const out: Record<string, GeneralNode> = {};
  const comps = data.components;
  if (Array.isArray(comps)) {
    for (const c of comps) {
      if (!isObj(c)) continue;
      const { id, spec } = c;
      if (typeof id !== 'string' || id === '' || !isObj(spec)) continue;
      if (validateGeneralNode(spec).length === 0) out[id] = spec as unknown as GeneralNode;
    }
  }
  cache.set(data, out);
  return out;
}
