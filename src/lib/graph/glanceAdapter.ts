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
import { rollUpHealth } from './health';
import { gridLayout, layeredLayout } from './layout';
import {
  ACTIVITY_META, CATEGORY_COLOR, EDGE_META, HEALTH_META,
  ROLE_COLOR, type GraphScene, type SceneEdge, type SceneNode,
} from './scene';
import type { GraphEdge } from './types';

export type GlanceRole = 'infra' | 'service' | 'data' | 'client';
/** Axis 1 (#2541) — the attention signal and the only colour-bearing axis. */
export type GlanceHealth = 'idle' | 'healthy' | 'warning' | 'error' | 'off';
/** Axis 2 (#2541) — the lifecycle word. Carries no colour by design. */
export type GlanceActivity = 'idle' | 'planning' | 'building' | 'waiting' | 'review' | 'live';
/** A project's lifecycle category (#2583) — the L0 accent channel. */
export type GlanceCategory = 'greenfield' | 'transform' | 'harden' | 'maintain' | 'data' | 'script';
export type GlanceEdgeKind = 'api' | 'data' | 'events' | 'uses-kit' | 'requires';

/** An agent in a project's fleet (the L1 drill subgraph). */
export interface GlanceAgent {
  id: string;
  name?: string;
  /** Session role (director / worker / reviewer / …) — mapped to a glance colour bucket. */
  role: string;
  /** Lifecycle word, when known. Fleet streams carry no live activity over the wire today. */
  activity?: GlanceActivity;
  /** Agent ids this agent depends on (planning-time sequencing — drawn, never blocking). */
  dependsOn?: string[];
}

/** A project node, shaped like the desktop's GRawNode (+ its fleet for drill-in). */
export interface GlanceProject {
  id: string;
  slug?: string;
  role: GlanceRole;
  /** Lifecycle category — drives the L0 accent, replacing `role` (#2591). */
  category?: GlanceCategory;
  /** The node's OWN health, before the dependency rollup. */
  health: GlanceHealth;
  activity: GlanceActivity;
  /** Why health is degraded (the fault title) — shown in place of the activity word. */
  reason?: string;
  /** Unresolved runtime-fault count. Kept for the inspector; no longer in the subtitle. */
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

/**
 * Session role → glance colour bucket, grouped by agent FUNCTION (desktop
 * `glanceFleet.ts:18-23`, #2561): ORCHESTRATE (planner · director · debugger) = infra,
 * BUILD (worker) = service, VERIFY (reviewer · tester · juror) = data, FLOW
 * (issuer · triage · documentor · designer) = client.
 *
 * Must match the desktop map entry-for-entry — a role missing here falls through to
 * `service` and silently mis-colours the node.
 */
const ROLE_TO_GROLE: Record<string, GlanceRole> = {
  planner: 'infra', director: 'infra', debugger: 'infra',
  worker: 'service',
  reviewer: 'data', tester: 'data', juror: 'data',
  issuer: 'client', triage: 'client', documentor: 'client', designer: 'client',
};

interface LaidNode {
  id: string;
  x: number;
  y: number;
}

/** Shared scene assembly: layer a depends-on DAG (reversed edges, cycle-break set = mutual-pair
 *  edges), place with glance spacing (grid fallback when there are no edges), route side-port
 *  beziers with cycle bows. */
interface AssembleNode {
  id: string;
  title: string;
  subtitle?: string;
  accent: string;
  /** Post-rollup health. Absent ⇒ no status dot (fleet nodes carry no health on the wire). */
  health?: GlanceHealth;
  /** The health came from a dependency, not this node — muted dot, no pulse. */
  healthInherited?: boolean;
  drillId?: string;
}

function assembleScene(
  nodes: AssembleNode[],
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
    const health = n.health ? HEALTH_META[n.health] : undefined;
    return {
      id: n.id,
      x,
      y,
      w: GLANCE_NODE_W,
      h: GLANCE_NODE_H,
      title: n.title,
      subtitle: n.subtitle,
      accentColor: n.accent,
      statusColor: health?.color,
      // An inherited health is somebody else's problem surfacing here — it must
      // not compete for attention with the node that actually failed.
      pulse: health?.pulse && !n.healthInherited,
      statusMuted: n.healthInherited,
      dimmed: n.health === 'off',
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

/**
 * The card's bottom line, mirroring the desktop's activity slot
 * (`GlanceCanvas.tsx:268-269`): normally the activity word, but replaced by the
 * `reason` when the node's OWN health is degraded — a red dot with no "why" is
 * the thing the desktop went out of its way to avoid. A deactivated node reads
 * literally "off".
 *
 * Deliberately keyed on the node's own health, not the rolled-up value: a node
 * lit only by a dependency has no reason of its own to show.
 */
export function projectSubtitle(p: GlanceProject): string {
  const lead = p.category ?? p.role;
  if (p.health === 'off') return `${lead} · off`;
  const degraded = p.health === 'warning' || p.health === 'error';
  const word = degraded && p.reason ? p.reason : ACTIVITY_META[p.activity].label;
  return `${lead} · ${word}`;
}

/**
 * L0 — the project network. Deterministic; a project with agents carries `drillId` (its own id).
 *
 * Health is rolled up the dependency chain first (desktop `rollUpHealth`), so a node shows the
 * worst of itself and everything it depends on. The accent is the lifecycle CATEGORY where the
 * desktop resolves one, falling back to `role` — never a hash of the id, which is the tier the
 * desktop deleted in #2591 for colliding with the health palette.
 */
export function buildGlanceScene(input: GlanceGraphInput): GraphScene {
  const rolled = rollUpHealth(
    input.projects.map((p) => ({ id: p.id, health: p.health })),
    input.links,
  );
  return assembleScene(
    input.projects.map((p) => {
      const eff = rolled.get(p.id);
      return {
        id: p.id,
        title: p.slug ?? p.id,
        subtitle: projectSubtitle(p),
        accent: (p.category && CATEGORY_COLOR[p.category]) ?? ROLE_COLOR[p.role],
        health: eff?.health ?? p.health,
        healthInherited: eff?.inherited,
        drillId: p.agents && p.agents.length > 0 ? p.id : undefined,
      };
    }),
    input.links.map((e, i) => ({ id: e.id ?? `e${i}`, from: e.from, to: e.to, kind: e.kind })),
  );
}

/**
 * L1 — a project's fleet subgraph (the drill target): agents as nodes coloured by their session
 * role, `dependsOn` as api-kind dependency edges. Empty scene when the project is unknown.
 *
 * Fleet nodes carry NO status dot: the wire ships no per-stream health, and colouring them from
 * the activity axis would reintroduce exactly the invented signal #238 removed. The role bucket
 * is the colour; the activity word, when known, rides in the subtitle.
 */
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
      subtitle: a.activity ? `${a.role} · ${ACTIVITY_META[a.activity].label}` : a.role,
      accent: ROLE_COLOR[ROLE_TO_GROLE[a.role] ?? 'service'],
    })),
    edges,
  );
}
