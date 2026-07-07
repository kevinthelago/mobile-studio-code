// Glance adapter (#220) — glance-shaped input (projects as nodes, dependency links as edges) → a
// laid-out GraphScene, mirroring base-studio-code's glance model (glanceGraph.ts `buildGraph`):
// mutual pairs are cycles (excluded from layering, bowed apart when drawn), the depends-on DAG is
// layered left→right by handing layerDag the edges REVERSED (its "from → deeper" convention then
// puts each dependency in an earlier column), crossing reduction runs glance's tunables (6 snapshot
// barycenter passes over every edge endpoint), and edges use the vendored SIDE-PORT routing.
// Drill (L1): a project with a fleet drills into its agents as a subgraph in the same language
// (desktop glanceFleet.ts). Pure + deterministic.
import { mutualPairs } from './cycles';
import { graphEdge } from './edgePath';
import { gridLayout, layeredLayout } from './layout';
import { EDGE_META, ROLE_COLOR, STATUS_META, type GraphScene, type SceneEdge, type SceneNode } from './scene';
import type { GraphEdge } from './types';

export type GlanceRole = 'infra' | 'service' | 'data' | 'client';
export type GlanceStatus = 'idle' | 'planning' | 'building' | 'review' | 'blocked' | 'done' | 'live';
export type GlanceEdgeKind = 'api' | 'data' | 'events';

/** An agent in a project's fleet (the L1 drill subgraph). */
export interface GlanceAgent {
  id: string;
  name?: string;
  /** Session role (director / worker / reviewer / …) — mapped to a glance colour category. */
  role: string;
  status?: GlanceStatus;
  /** Agent ids this agent depends on (planning-time sequencing — drawn, never blocking). */
  dependsOn?: string[];
}

/** A project node, shaped like the desktop's GRawNode (+ its fleet for drill-in). */
export interface GlanceProject {
  id: string;
  slug?: string;
  role: GlanceRole;
  status: GlanceStatus;
  director?: string;
  /** Unresolved runtime-fault count (badge-worthy; carried through to the subtitle). */
  faults?: number;
  /** The project's fleet — present ⇒ the node is drillable to its L1 subgraph. */
  agents?: GlanceAgent[];
}

/** A dependency link, shaped like the desktop's GRawEdge: `from` DEPENDS ON `to`. */
export interface GlanceLink {
  from: string;
  to: string;
  kind: GlanceEdgeKind;
  id?: string;
}

export interface GlanceGraphInput {
  projects: GlanceProject[];
  links: GlanceLink[];
}

// Node box + spacing in world coordinates (desktop glanceGraph.ts: NW/NH · COLGAP/ROWGAP).
export const GLANCE_NODE_W = 186;
export const GLANCE_NODE_H = 66;
const COL_GAP = 252;
const ROW_GAP = 102;
const PAD = 150; // center-padding (desktop pads top-left by 70; centers ≈ 70 + node/2)

/** Session role → glance colour category (desktop glanceFleet.ts `ROLE_TO_GROLE`). */
const ROLE_TO_GROLE: Record<string, GlanceRole> = {
  director: 'infra',
  planner: 'infra',
  worker: 'service',
  reviewer: 'data',
  tester: 'data',
  juror: 'data',
  issuer: 'client',
  triage: 'client',
};

interface LaidNode {
  id: string;
  x: number;
  y: number;
}

/** Shared scene assembly: layer a depends-on DAG (reversed edges, cycle-break set = mutual-pair
 *  edges), place with glance spacing (grid fallback when there are no edges), route side-port
 *  beziers with cycle bows. */
function assembleScene(
  nodes: { id: string; title: string; subtitle?: string; accent: string; status?: GlanceStatus; drillId?: string }[],
  rawEdges: { id: string; from: string; to: string; kind: GlanceEdgeKind }[],
): GraphScene {
  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const edges = rawEdges.filter((e) => e.from !== e.to && idSet.has(e.from) && idSet.has(e.to));

  // Cycle detection: mutual pairs (a→b AND b→a), the glance hazard (vendored cycles.ts).
  const { edgeIds: cycleEdgeIds } = mutualPairs(edges as GraphEdge[]);

  const layoutOpts = { nodeW: GLANCE_NODE_W, nodeH: GLANCE_NODE_H, layerGap: COL_GAP, crossGap: ROW_GAP, pad: PAD };
  const layout =
    edges.length === 0
      ? gridLayout(ids, layoutOpts) // peers grid — desktop's no-edges fallback
      : layeredLayout(
          ids,
          // Depends-on orientation: reverse so the dependency lands in an EARLIER column.
          edges.map((e) => ({ id: e.id, from: e.to, to: e.from })),
          {
            ...layoutOpts,
            direction: 'right',
            backEdgeIds: cycleEdgeIds,
            order: { passes: 6, sweep: 'snapshot' }, // glance's tunables
          },
        );

  const laid: Record<string, LaidNode> = {};
  const sceneNodes: SceneNode[] = nodes.map((n) => {
    const c = layout.cells[n.id];
    const x = Math.round(c.cx - GLANCE_NODE_W / 2);
    const y = Math.round(c.cy - GLANCE_NODE_H / 2);
    laid[n.id] = { id: n.id, x, y };
    const status = n.status ? STATUS_META[n.status] : undefined;
    return {
      id: n.id,
      x,
      y,
      w: GLANCE_NODE_W,
      h: GLANCE_NODE_H,
      title: n.title,
      subtitle: n.subtitle,
      accentColor: n.accent,
      statusColor: status?.color,
      pulse: status?.pulse,
      drillId: n.drillId,
    };
  });

  const sceneEdges: SceneEdge[] = edges.map((e) => {
    const F = laid[e.from];
    const T = laid[e.to];
    const isCycle = cycleEdgeIds.has(e.id);
    // Cycle back-edges bow apart with a deterministic sign (desktop edgeGeom's `F.id < T.id`).
    const bow = isCycle ? (F.id < T.id ? -46 : 46) : 0;
    const geom = graphEdge(
      { x: F.x, y: F.y, w: GLANCE_NODE_W, h: GLANCE_NODE_H },
      { x: T.x, y: T.y, w: GLANCE_NODE_W, h: GLANCE_NODE_H },
      { bow, routing: 'ports' },
    );
    const meta = EDGE_META[e.kind];
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      d: geom.d,
      arrow: geom.arrow,
      color: isCycle ? '#f2555f' : meta.color,
      dash: meta.dash,
      width: meta.w,
      label: meta.label,
      labelX: geom.labelX,
      labelY: geom.labelY,
      isCycle,
    };
  });

  return { nodes: sceneNodes, edges: sceneEdges, worldW: layout.worldW, worldH: layout.worldH };
}

/** L0 — the project network. Deterministic; a project with agents carries `drillId` (its own id). */
export function buildGlanceScene(input: GlanceGraphInput): GraphScene {
  return assembleScene(
    input.projects.map((p) => ({
      id: p.id,
      title: p.slug ?? p.id,
      subtitle: `${p.role} · ${STATUS_META[p.status].label}${p.faults ? ` · ${p.faults} faults` : ''}`,
      accent: ROLE_COLOR[p.role],
      status: p.status,
      drillId: p.agents && p.agents.length > 0 ? p.id : undefined,
    })),
    input.links.map((e, i) => ({ id: e.id ?? `e${i}`, from: e.from, to: e.to, kind: e.kind })),
  );
}

/** L1 — a project's fleet subgraph (the drill target): agents as nodes coloured by their session
 *  role, `dependsOn` as api-kind dependency edges. Empty scene when the project is unknown. */
export function buildFleetScene(input: GlanceGraphInput, projectId: string): GraphScene {
  const project = input.projects.find((p) => p.id === projectId);
  const agents = project?.agents ?? [];
  const edges: { id: string; from: string; to: string; kind: GlanceEdgeKind }[] = [];
  for (const a of agents) {
    for (const dep of a.dependsOn ?? []) {
      edges.push({ id: `${a.id}->${dep}`, from: a.id, to: dep, kind: 'api' });
    }
  }
  return assembleScene(
    agents.map((a) => ({
      id: a.id,
      title: a.name ?? a.id,
      subtitle: a.status ? `${a.role} · ${STATUS_META[a.status].label}` : a.role,
      accent: ROLE_COLOR[ROLE_TO_GROLE[a.role] ?? 'service'],
      status: a.status,
    })),
    edges,
  );
}
