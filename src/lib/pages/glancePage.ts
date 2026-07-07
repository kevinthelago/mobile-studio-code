// Glance page view-model (#221) — the pure bridge between the mirrored `glance` store domain
// (base-studio-code#2498 `GlancePayload`: the project network + the desktop's drilled fleet) and the
// #220 graph adapter (`GlanceGraphInput` → `buildGlanceScene` / `buildFleetScene`). Kept React-free so
// the payload→scene-input mapping is unit-testable from plain fixtures and tolerant of a missing /
// partial / undefined payload (a parse failure lands here as `undefined`).
import type { GlanceGraphInput, GlanceProject, GlanceAgent, GlanceRole, GlanceStatus, GlanceEdgeKind } from '../graph';

// ── Wire shapes (mirror the desktop interfaces; NEVER imported across repos) ──────────────────────
type GRole = GlanceRole; // 'infra' | 'service' | 'data' | 'client'
type GStatus = GlanceStatus; // idle | planning | building | review | blocked | done | live
type GEdgeKind = GlanceEdgeKind; // api | data | events

/** A project node as the desktop projects it (glanceData.ts `ProjectLite`). */
export interface GlanceProjectLite {
  id: string;
  name: string;
  role?: GRole;
  status?: GStatus;
  faults?: number;
}

/** A user-drawn project→project edge (projectLinks.ts `ProjectLink`). */
export interface GlanceProjectLink {
  id: string;
  from: string;
  to: string;
  kind: GEdgeKind;
}

/** One fleet stream as `PlanBoardPayload`/`FleetPlan` carries it (only the fields the graph needs). */
export interface GlanceFleetStream {
  id: string;
  name?: string;
  persona?: string;
  dependsOn?: string[];
}

export interface GlanceFleetPlan {
  streams: GlanceFleetStream[];
  director?: { enabled?: boolean };
}

/** The `glance` domain payload (base-studio-code#2498 `GlancePayload`). */
export interface GlancePayload {
  projects: GlanceProjectLite[];
  links: GlanceProjectLink[];
  drill: string | null;
  drillFleet: GlanceFleetPlan | null;
}

export type GlanceModel = GlancePayload;

// ── Selector ──────────────────────────────────────────────────────────────────────────────────────

const ROLES: GRole[] = ['infra', 'service', 'data', 'client'];

/** Stable non-negative hash (ports desktop glance `hashAbs`) — deterministic default role colour. */
function hashAbs(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return Math.abs(h | 0);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Parse the mirrored `glance` projection into a validated model, or `undefined` when the payload is
 * missing / malformed. Tolerant: unknown project entries are dropped, not thrown on.
 */
export function selectGlance(data: unknown): GlanceModel | undefined {
  if (!isObj(data) || !Array.isArray(data.projects)) return undefined;
  const projects: GlanceProjectLite[] = [];
  for (const p of data.projects) {
    if (!isObj(p) || typeof p.id !== 'string') continue;
    projects.push({
      id: p.id,
      name: typeof p.name === 'string' ? p.name : p.id,
      role: typeof p.role === 'string' && (ROLES as string[]).includes(p.role) ? (p.role as GRole) : undefined,
      status: typeof p.status === 'string' ? (p.status as GStatus) : undefined,
      faults: typeof p.faults === 'number' ? p.faults : undefined,
    });
  }
  const links: GlanceProjectLink[] = [];
  for (const l of Array.isArray(data.links) ? data.links : []) {
    if (!isObj(l) || typeof l.from !== 'string' || typeof l.to !== 'string') continue;
    links.push({
      id: typeof l.id === 'string' ? l.id : `${l.from}>${l.to}`,
      from: l.from,
      to: l.to,
      kind: (typeof l.kind === 'string' ? l.kind : 'api') as GEdgeKind,
    });
  }
  const drill = typeof data.drill === 'string' ? data.drill : null;
  const drillFleet = parseFleet(data.drillFleet);
  return { projects, links, drill, drillFleet };
}

function parseFleet(v: unknown): GlanceFleetPlan | null {
  if (!isObj(v) || !Array.isArray(v.streams)) return null;
  const streams: GlanceFleetStream[] = [];
  for (const s of v.streams) {
    if (!isObj(s) || typeof s.id !== 'string') continue;
    streams.push({
      id: s.id,
      name: typeof s.name === 'string' ? s.name : undefined,
      persona: typeof s.persona === 'string' ? s.persona : undefined,
      dependsOn: toStrArray(s.dependsOn),
    });
  }
  const director = isObj(v.director) && v.director.enabled === true ? { enabled: true } : undefined;
  return { streams, director };
}

// ── Adapter inputs ──────────────────────────────────────────────────────────────────────────────

/** Turn the drilled project's fleet into #220 `GlanceAgent`s: each stream a worker, an optional
 *  director hub every stream depends on (mirrors desktop `buildRealFleetData`). */
export function fleetToAgents(fleet: GlanceFleetPlan): GlanceAgent[] {
  const agents: GlanceAgent[] = fleet.streams.map((s) => ({
    id: s.id,
    name: s.name ?? s.id,
    role: 'worker',
    status: 'planning' as GlanceStatus,
    dependsOn: [...(s.dependsOn ?? [])],
  }));
  if (fleet.director?.enabled) {
    for (const a of agents) a.dependsOn = [...(a.dependsOn ?? []), 'director'];
    agents.push({ id: 'director', name: 'director', role: 'director', status: 'building' });
  }
  return agents;
}

/**
 * The L0 project network as `GlanceGraphInput`. The desktop only ships ONE project's fleet (the one it
 * has drilled), so only THAT project carries `agents` — i.e. only it is drillable on mobile. Every
 * other project is an isolated/leaf node with no fleet data available yet.
 */
export function glanceL0Input(model: GlanceModel): GlanceGraphInput {
  const drilledAgents = model.drill && model.drillFleet ? fleetToAgents(model.drillFleet) : [];
  const projects: GlanceProject[] = model.projects.map((p) => ({
    id: p.id,
    slug: p.name,
    role: p.role ?? ROLES[hashAbs(p.id) % ROLES.length],
    status: p.status ?? 'idle',
    faults: p.faults,
    agents: p.id === model.drill && drilledAgents.length > 0 ? drilledAgents : undefined,
  }));
  return {
    projects,
    links: model.links.map((l) => ({ id: l.id, from: l.from, to: l.to, kind: l.kind })),
  };
}

/** The desktop pane id for a fleet agent node — `<project>:<stream>` (contract v2 session identity). */
export function agentPaneId(projectId: string, nodeId: string): string {
  return `${projectId}:${nodeId}`;
}
