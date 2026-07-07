// Layered placement (#220) — turn the vendored core's layer assignment (layerDag) + in-layer order
// (orderLayers) into world coordinates, mirroring the desktop's seeding: LAYERS become the main
// axis (columns for a left→right glance DAG, rows for a top-down org hierarchy) and the in-layer
// ORDER becomes the cross axis, centered per layer — exactly base-studio-code's glance placement
// math (glanceGraph.ts `buildGraph`) and the org autoLayout SEED.
//
// DELIBERATE DEVIATION vs desktop: the org designer refines its seed with a d3-force pass
// (forceSimulation, y pinned per row — orgLayout.ts `autoLayout`). Mobile skips the force
// refinement entirely — fixed spacing straight from the seed. No d3-force dependency on the phone,
// fully deterministic, and the phone view is READ-ONLY at glance scale where the crossing-reduced
// grid already reads fine. Revisit only if real orgs get too crowded.
import { layerDag } from './layers';
import { orderLayers, type OrderLayersOpts } from './order';
import type { GraphEdge } from './types';

export interface LayeredLayoutOpts {
  /** Which way layers flow: "right" = layers are columns (glance); "down" = layers are rows (org). */
  direction: 'right' | 'down';
  /** Node box size (uniform for spacing; per-node sizes only offset the box around its cell center). */
  nodeW: number;
  nodeH: number;
  /** Gap between layer centers along the main axis. */
  layerGap: number;
  /** Gap between node centers within a layer (cross axis). */
  crossGap: number;
  /** World padding before the first cell. */
  pad: number;
  /** Barycenter tunables forwarded to the vendored orderLayers. */
  order?: OrderLayersOpts;
  /** Edge ids to exclude from layering (the caller's cycle-break set). */
  backEdgeIds?: ReadonlySet<string>;
  /** Neighbor gathering for crossing reduction; defaults to every edge endpoint (glance's). */
  neighborsOf?: (id: string) => readonly string[];
}

export interface LayeredLayout {
  /** nodeId → cell CENTER in world coordinates + its layer. */
  cells: Record<string, { cx: number; cy: number; layer: number }>;
  worldW: number;
  worldH: number;
}

/**
 * Deterministic layered layout over the vendored core. `edges` must already be in layerDag's
 * "from → deeper" orientation (a depends-on graph reverses first — see glanceAdapter).
 * Isolated nodes land in layer 0; a graph with no edges degrades to one centered column/row
 * per the same math (callers wanting a grid handle that case themselves).
 */
export function layeredLayout(
  nodeIds: readonly string[],
  edges: readonly GraphEdge[],
  opts: LayeredLayoutOpts,
): LayeredLayout {
  const layer = layerDag(nodeIds, edges, opts.backEdgeIds);

  const defaultNeighbors = (): ((id: string) => readonly string[]) => {
    const nb = new Map<string, string[]>(nodeIds.map((n) => [n, []]));
    for (const e of edges) {
      if (nb.has(e.from) && nb.has(e.to)) {
        nb.get(e.from)!.push(e.to);
        nb.get(e.to)!.push(e.from);
      }
    }
    return (id) => nb.get(id) ?? [];
  };
  const order = orderLayers(
    nodeIds,
    (id) => layer[id],
    opts.neighborsOf ?? defaultNeighbors(),
    opts.order,
  );

  // Cross-axis centering: every layer is centered against the largest layer (glance's `Cy`).
  const maxCount = Math.max(1, ...[...order.values()].map((a) => a.length));
  const crossMid = opts.pad + ((maxCount - 1) * opts.crossGap) / 2;

  const cells: Record<string, { cx: number; cy: number; layer: number }> = {};
  let maxMain = 0;
  let maxCross = 0;
  for (const [l, arr] of order) {
    arr.forEach((id, i) => {
      const main = opts.pad + l * opts.layerGap;
      const cross = crossMid + (i - (arr.length - 1) / 2) * opts.crossGap;
      maxMain = Math.max(maxMain, main);
      maxCross = Math.max(maxCross, cross);
      cells[id] =
        opts.direction === 'right'
          ? { cx: main, cy: cross, layer: l }
          : { cx: cross, cy: main, layer: l };
    });
  }

  // Cells hold CENTERS; the world adds half a node + padding beyond the outermost center.
  const mainExtent = maxMain + opts.pad;
  const crossExtent = maxCross + opts.pad;
  const [rawW, rawH] =
    opts.direction === 'right'
      ? [mainExtent + opts.nodeW / 2, crossExtent + opts.nodeH / 2]
      : [crossExtent + opts.nodeW / 2, mainExtent + opts.nodeH / 2];
  return { cells, worldW: rawW, worldH: rawH };
}

/** A plain centered grid (glance's no-edges fallback): cell CENTERS row-major, √n columns. */
export function gridLayout(
  nodeIds: readonly string[],
  opts: Pick<LayeredLayoutOpts, 'nodeW' | 'nodeH' | 'layerGap' | 'crossGap' | 'pad'>,
): LayeredLayout {
  const cols = Math.max(1, Math.round(Math.sqrt(nodeIds.length)));
  const cells: Record<string, { cx: number; cy: number; layer: number }> = {};
  let maxX = 0;
  let maxY = 0;
  nodeIds.forEach((id, i) => {
    const cx = opts.pad + (i % cols) * opts.layerGap;
    const cy = opts.pad + Math.floor(i / cols) * opts.crossGap;
    maxX = Math.max(maxX, cx);
    maxY = Math.max(maxY, cy);
    cells[id] = { cx, cy, layer: 0 };
  });
  return { cells, worldW: maxX + opts.pad + opts.nodeW / 2, worldH: maxY + opts.pad + opts.nodeH / 2 };
}
