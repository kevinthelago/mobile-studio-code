// Health rollup (#238) — VENDORED from base-studio-code `glanceGraph.ts:354-385` (`rollUpHealth`
// + `HEALTH_RANK`), the desktop's dependency-escalation rule. A node shows the WORST health of
// itself and everything it transitively depends on, so a downstream error surfaces on the things
// that would break because of it.
//
// Kept as its own module (rather than inlined in glanceAdapter) because it is pure graph logic
// with no scene/layout concerns, and because it must stay diffable against the desktop original:
// this is a propagation rule, and a mobile-local "improvement" here would silently disagree with
// what the desktop shows for the same graph.

import type { GlanceHealth } from './glanceAdapter';

/**
 * Severity rank. Only `warning`/`error` (rank ≥ 1) propagate up dependency edges — `idle` and
 * `healthy` are both "no problem", and `off` is rank 0 so a deactivated node neither propagates
 * nor lights up.
 */
export const HEALTH_RANK: Record<GlanceHealth, number> = {
  idle: 0, healthy: 0, warning: 1, error: 2, off: 0,
};

export type RolledHealth = {
  /** The effective health after the rollup. */
  health: GlanceHealth;
  /** True when the rollup is worse than the node's OWN health — i.e. lit only by a dependency. */
  inherited: boolean;
};

/**
 * Roll dependency health up the graph. `edges` are in depends-on orientation: `from` DEPENDS ON
 * `to`, so health flows from `to` back to `from`.
 *
 * `off` is absorbing: a user-deactivated node stays `off` regardless of what it depends on (the
 * deliberate mute wins over any downstream error), and — being rank 0 — never propagates outward
 * either. Cycles terminate on the `seen` set, so a mutual dependency pair is safe.
 *
 * @param nodes Every node with its OWN (pre-rollup) health.
 * @param edges Depends-on edges; endpoints not in `nodes` are ignored.
 * @returns Per node id, the effective health and whether it was inherited.
 */
export function rollUpHealth(
  nodes: { id: string; health: GlanceHealth }[],
  edges: { from: string; to: string }[],
): Map<string, RolledHealth> {
  const own = new Map(nodes.map((n) => [n.id, n.health]));
  const deps = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) deps.get(e.from)?.push(e.to);

  const worstFrom = (start: string): GlanceHealth => {
    if (own.get(start) === 'off') return 'off';
    let worst = own.get(start) ?? 'idle';
    const seen = new Set<string>([start]);
    const stack = [...(deps.get(start) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const h = own.get(id) ?? 'idle';
      if (HEALTH_RANK[h] > HEALTH_RANK[worst]) worst = h;
      for (const d of deps.get(id) ?? []) stack.push(d);
    }
    return worst;
  };

  const out = new Map<string, RolledHealth>();
  for (const n of nodes) {
    const eff = worstFrom(n.id);
    out.set(n.id, { health: eff, inherited: HEALTH_RANK[eff] > HEALTH_RANK[own.get(n.id) ?? 'idle'] });
  }
  return out;
}
