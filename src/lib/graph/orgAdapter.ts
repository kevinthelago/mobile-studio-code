// Org adapter (#220) — org-shaped input (positions wired by relationship archetypes) → a laid-out
// GraphScene, mirroring base-studio-code's org model:
//   • POOLS (desktop orgPools.ts #2199/#2436): ≥2 positions on the same STACKABLE persona
//     (`pooled`, or worker-role by default) collapse into ONE synthetic stacked-card node with a
//     member-count badge; external edges are rerouted to the pool and deduped, internal peer-mesh
//     edges fold away; `homogeneous` records whether members share identical external wiring.
//     Drilling into a pool shows the member subgraph + its boundary neighbors (poolSubgraph).
//   • LAYOUT (desktop orgLayout.ts `layerNodes`): only the HIERARCHY archetypes (manages / serves /
//     oversees / stewards) drive layering — vendored findBackEdges as the cycle-break set, layerDag
//     top-down (manager above report), orderLayers with org's tunables (4 sequential passes,
//     cross-layer hierarchy neighbors only). Layers become ROWS, in-layer order becomes COLUMNS.
//     DEVIATION: the desktop refines this seed with a fixed-y d3-force pass; mobile keeps the fixed
//     grid (see layout.ts header).
//   • EDGES: vendored perimeter-ANCHOR routing (the org designer's organic line), archetype
//     style → dash, hue → colour, bidirectional archetypes double-ended.
// Pure + deterministic.
import { findBackEdges } from './cycles';
import { graphEdge } from './edgePath';
import { layeredLayout } from './layout';
import { styleDash, type GraphScene, type SceneEdge, type SceneNode } from './scene';
import type { GraphEdge } from './types';

export type OrgPositionKind = 'agent' | 'external' | 'resource';

export interface OrgPersona {
  id: string;
  name?: string;
  /** Session role (director / worker / reviewer / …). Worker-role personas stack by default. */
  role?: string;
  /** Explicit stacking override — always wins (desktop `isStackable`). */
  pooled?: boolean;
}

export interface OrgPosition {
  nodeId: string;
  kind: OrgPositionKind;
  /** For agent positions: the persona this node embodies. */
  personaId?: string;
  /** Display override — required for external/resource nodes. */
  label?: string;
}

export interface OrgRelationship {
  id: string;
  archetype: string;
  from: string;
  to: string;
}

export interface OrgGraphInput {
  positions: OrgPosition[];
  relationships: OrgRelationship[];
  personas: OrgPersona[];
}

/** Archetype display meta (desktop @data/org/archetypes.json — style · hue · bidirectional). */
export const ORG_ARCHETYPES: Record<
  string,
  { label: string; style: string; hue: number; bidirectional?: boolean }
> = {
  manages: { label: 'Manages', style: 'solid', hue: 210 },
  serves: { label: 'Serves', style: 'dashed', hue: 160 },
  oversees: { label: 'Oversees', style: 'gated', hue: 45 },
  consults: { label: 'Consults', style: 'dotted', hue: 280, bidirectional: true },
  peers: { label: 'Peers', style: 'dotted', hue: 190, bidirectional: true },
  stewards: { label: 'Stewards', style: 'resource', hue: 20 },
};

/** Archetypes that impose a top-down hierarchy (desktop orgLayout.ts `HIERARCHY_ARCHETYPES`). */
const HIERARCHY_ARCHETYPES = new Set(['manages', 'serves', 'oversees', 'stewards']);

// Node sizes per kind (desktop orgLayout.ts NODE_SIZE) + org grid spacing (AUTO_COL / AUTO_ROW).
export const ORG_NODE_SIZE: Record<OrgPositionKind, { w: number; h: number }> = {
  agent: { w: 190, h: 96 },
  resource: { w: 156, h: 82 },
  external: { w: 152, h: 80 },
};
const COL_GAP = 230;
const ROW_GAP = 200;
const PAD = 160;

// ── Pools (ported from desktop orgPools.ts; simplified: no packaged-persona registry on mobile —
//    an explicit `pooled` wins, else worker-role stacks) ─────────────────────────────────────────

export interface OrgPool {
  /** Synthetic node id for the collapsed group (`pool:<personaId>`). */
  nodeId: string;
  personaId: string;
  memberNodeIds: string[];
  count: number;
  /** True when every member has the identical external relationship signature. */
  homogeneous: boolean;
}

function isStackable(p: OrgPersona): boolean {
  if (p.pooled !== undefined) return p.pooled;
  return p.role === 'worker';
}

/** External relationship signature of a position (desktop `externalSignature`): every edge to a
 *  node OUTSIDE the member set, sorted `dir|archetype|counterpart`. */
function externalSignature(relationships: OrgRelationship[], nodeId: string, memberSet: Set<string>): string {
  const parts: string[] = [];
  for (const r of relationships) {
    if (r.from === nodeId && !memberSet.has(r.to)) parts.push(`out|${r.archetype}|${r.to}`);
    else if (r.to === nodeId && !memberSet.has(r.from)) parts.push(`in|${r.archetype}|${r.from}`);
  }
  return parts.sort().join('~');
}

/** Detect the pools: every stackable persona placed ≥2× collapses. Mixed external wiring doesn't
 *  block the stack; it only clears `homogeneous` (#2436). Deterministic (positions in author order). */
export function detectPools(input: OrgGraphInput): OrgPool[] {
  const stackable = new Set(input.personas.filter(isStackable).map((p) => p.id));
  const byPersona = new Map<string, OrgPosition[]>();
  for (const p of input.positions) {
    if (p.kind === 'agent' && p.personaId && stackable.has(p.personaId)) {
      const list = byPersona.get(p.personaId) ?? [];
      list.push(p);
      byPersona.set(p.personaId, list);
    }
  }
  const pools: OrgPool[] = [];
  for (const [personaId, members] of byPersona) {
    if (members.length < 2) continue;
    const memberSet = new Set(members.map((m) => m.nodeId));
    const sig0 = externalSignature(input.relationships, members[0].nodeId, memberSet);
    const homogeneous = members.every(
      (m) => externalSignature(input.relationships, m.nodeId, memberSet) === sig0,
    );
    pools.push({
      nodeId: `pool:${personaId}`,
      personaId,
      memberNodeIds: members.map((m) => m.nodeId),
      count: members.length,
      homogeneous,
    });
  }
  return pools;
}

export interface CollapsedOrg {
  positions: OrgPosition[];
  relationships: OrgRelationship[];
  /** Pool metadata keyed by the synthetic pool nodeId. */
  poolInfo: Record<string, OrgPool>;
}

/** Collapse for the parent view (desktop `collapseOrg`): members → one synthetic pool position;
 *  external edges rerouted to the pool and deduped by from|to|archetype; internal edges dropped. */
export function collapseOrg(input: OrgGraphInput, pools: OrgPool[]): CollapsedOrg {
  if (!pools.length) {
    return { positions: input.positions, relationships: input.relationships, poolInfo: {} };
  }
  const memberToPool = new Map<string, OrgPool>();
  for (const pool of pools) for (const m of pool.memberNodeIds) memberToPool.set(m, pool);

  const positions: OrgPosition[] = input.positions.filter((p) => !memberToPool.has(p.nodeId));
  const poolInfo: Record<string, OrgPool> = {};
  for (const pool of pools) {
    positions.push({ nodeId: pool.nodeId, kind: 'agent', personaId: pool.personaId });
    poolInfo[pool.nodeId] = pool;
  }

  const remap = (nodeId: string): string => memberToPool.get(nodeId)?.nodeId ?? nodeId;
  const seen = new Set<string>();
  const relationships: OrgRelationship[] = [];
  for (const r of input.relationships) {
    const from = remap(r.from);
    const to = remap(r.to);
    if (from === to) continue; // internal edge, folded away
    const key = `${from}|${to}|${r.archetype}`;
    if (seen.has(key)) continue; // N member edges → one pool edge
    seen.add(key);
    relationships.push({ ...r, id: `pool-edge:${key}`, from, to });
  }
  return { positions, relationships, poolInfo };
}

/** A pool's OWN graph for drill-in (desktop `poolSubgraph`): the members, every edge touching a
 *  member, and the boundary neighbors those edges reach (context). */
export function poolSubgraph(input: OrgGraphInput, pool: OrgPool): OrgGraphInput {
  const memberSet = new Set(pool.memberNodeIds);
  const relationships = input.relationships.filter((r) => memberSet.has(r.from) || memberSet.has(r.to));
  const nodeIds = new Set<string>(pool.memberNodeIds);
  for (const r of relationships) {
    nodeIds.add(r.from);
    nodeIds.add(r.to);
  }
  return {
    positions: input.positions.filter((p) => nodeIds.has(p.nodeId)),
    relationships,
    personas: input.personas,
  };
}

// ── Scene assembly ───────────────────────────────────────────────────────────────────────────────

function edgeColor(hue: number): string {
  return `hsl(${hue}, 70%, 62%)`;
}

function assembleOrgScene(
  positions: OrgPosition[],
  relationships: OrgRelationship[],
  personas: OrgPersona[],
  poolInfo: Record<string, OrgPool>,
): GraphScene {
  const ids = positions.map((p) => p.nodeId);
  const idSet = new Set(ids);
  const personaById = new Map(personas.map((p) => [p.id, p]));

  // Hierarchy sub-graph drives layering (desktop `layerNodes`): parent → child is layerDag's
  // "from → deeper" convention directly, with DFS back-edges as the cycle-break set.
  const hierarchy: GraphEdge[] = relationships
    .filter((r) => HIERARCHY_ARCHETYPES.has(r.archetype) && idSet.has(r.from) && idSet.has(r.to))
    .map((r) => ({ id: r.id, from: r.from, to: r.to }));
  const { backEdgeIds } = findBackEdges(ids, hierarchy);

  // Crossing reduction pulls only from cross-layer hierarchy parents+children (org's discipline);
  // layeredLayout filters same-layer pulls out via the layer check below.
  const parents = new Map<string, string[]>(ids.map((n) => [n, []]));
  const children = new Map<string, string[]>(ids.map((n) => [n, []]));
  for (const e of hierarchy) {
    if (backEdgeIds.has(e.id)) continue;
    parents.get(e.to)!.push(e.from);
    children.get(e.from)!.push(e.to);
  }

  const layout = layeredLayout(ids, hierarchy, {
    direction: 'down', // layers are ROWS: manager above report
    nodeW: ORG_NODE_SIZE.agent.w,
    nodeH: ORG_NODE_SIZE.agent.h,
    layerGap: ROW_GAP,
    crossGap: COL_GAP,
    pad: PAD,
    backEdgeIds,
    order: { passes: 4, sweep: 'sequential' }, // org's tunables
    neighborsOf: (n) => [...parents.get(n)!, ...children.get(n)!],
  });
  // Same-layer neighbor pulls are excluded on the desktop; hierarchy edges always span layers
  // (layerDag guarantees layer[to] ≥ layer[from]+1 on the kept set), so the filter is implicit.

  const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const sceneNodes: SceneNode[] = positions.map((p) => {
    const { w, h } = ORG_NODE_SIZE[p.kind];
    const c = layout.cells[p.nodeId];
    const box = { x: Math.round(c.cx - w / 2), y: Math.round(c.cy - h / 2), w, h };
    boxes[p.nodeId] = box;
    const pool = poolInfo[p.nodeId];
    const persona = p.personaId ? personaById.get(p.personaId) : undefined;
    const title = p.label ?? persona?.name ?? p.personaId ?? p.nodeId;
    const subtitle = pool
      ? `${persona?.role ?? 'worker'} × ${pool.count}${pool.homogeneous ? '' : ' · mixed wiring'}`
      : p.kind === 'agent'
        ? persona?.role
        : p.kind;
    const accent = p.kind === 'agent' ? (persona?.role === 'worker' || pool ? '#4fd6a0' : '#5b9dff') : p.kind === 'resource' ? '#b98bff' : '#f2b155';
    return {
      id: p.nodeId,
      ...box,
      title,
      subtitle,
      accentColor: accent,
      stackCount: pool?.count,
      homogeneous: pool?.homogeneous,
      drillId: pool ? p.nodeId : undefined,
    };
  });

  const sceneEdges: SceneEdge[] = relationships
    .filter((r) => idSet.has(r.from) && idSet.has(r.to) && r.from !== r.to)
    .map((r) => {
      const meta = ORG_ARCHETYPES[r.archetype] ?? { label: r.archetype, style: 'solid', hue: 210 };
      const geom = graphEdge(boxes[r.from], boxes[r.to], {
        routing: 'anchor',
        doubleEnded: !!meta.bidirectional,
      });
      const dash = styleDash(meta.style);
      return {
        id: r.id,
        from: r.from,
        to: r.to,
        d: geom.d,
        arrow: geom.arrow,
        arrowStart: geom.arrowStart,
        color: edgeColor(meta.hue),
        dash: dash === '0' ? '' : dash,
        width: 1.6,
        label: meta.label,
        labelX: geom.labelX,
        labelY: geom.labelY,
      };
    });

  return { nodes: sceneNodes, edges: sceneEdges, worldW: layout.worldW, worldH: layout.worldH };
}

/** The parent org view: pools collapsed to stacked cards (count badge; drillable). Deterministic. */
export function buildOrgScene(input: OrgGraphInput): GraphScene {
  const pools = detectPools(input);
  const collapsed = collapseOrg(input, pools);
  return assembleOrgScene(collapsed.positions, collapsed.relationships, input.personas, collapsed.poolInfo);
}

/** Drill into a pool (`pool:<personaId>` node id): the member subgraph + boundary neighbors.
 *  Falls back to the parent view when the pool id is unknown. */
export function buildPoolScene(input: OrgGraphInput, poolNodeId: string): GraphScene {
  const pool = detectPools(input).find((p) => p.nodeId === poolNodeId);
  if (!pool) return buildOrgScene(input);
  const sub = poolSubgraph(input, pool);
  return assembleOrgScene(sub.positions, sub.relationships, sub.personas, {});
}
