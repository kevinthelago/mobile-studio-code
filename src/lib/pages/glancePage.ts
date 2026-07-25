// Glance page view-model (#221, resynced #238) — the pure bridge between the mirrored `glance` store
// domain (base-studio-code `GlancePayload`) and the #220 graph adapter (`GlanceGraphInput` →
// `buildGlanceScene` / `buildFleetScene`). Kept React-free so the payload→scene-input mapping is
// unit-testable from plain fixtures and tolerant of a missing / partial / undefined payload (a parse
// failure lands here as `undefined`).
//
// #238: the desktop split `ProjectLite.status` into `health` + `activity` in #2541 and mobile went
// on reading `status`, which no longer exists — so every node rendered idle for ~12 days with no
// parse error and no empty state. That is the failure this module now defends against: every union
// is VALIDATED against its literal members rather than cast, so a value the desktop adds tomorrow
// degrades to a safe default instead of indexing a palette with `undefined` and throwing.
import type {
  GlanceGraphInput, GlanceProject, GlanceAgent, GlanceRole,
  GlanceHealth, GlanceActivity, GlanceCategory, GlanceEdgeKind,
} from '../graph';

// ── Wire shapes (mirror the desktop interfaces; NEVER imported across repos) ──────────────────────

/** A project node as the desktop projects it (glanceData.ts `ProjectLite`). */
export interface GlanceProjectLite {
  id: string;
  name: string;
  role?: GlanceRole;
  category?: GlanceCategory;
  health?: GlanceHealth;
  activity?: GlanceActivity;
  /** The fault title that set a degraded health (`buildGlancePayload` overlay). */
  reason?: string;
  faults?: number;
}

/** A user-drawn project→project edge (projectLinks.ts `ProjectLink`). */
export interface GlanceProjectLink {
  id: string;
  from: string;
  to: string;
  kind: GlanceEdgeKind;
}

/** One fleet stream as `FleetPlan` carries it (only the fields the graph needs). */
export interface GlanceFleetStream {
  id: string;
  name?: string;
  persona?: string;
  dependsOn?: string[];
}

export interface GlanceFleetPlan {
  streams: GlanceFleetStream[];
  director?: { enabled?: boolean; role?: string };
}

/** The `glance` domain payload (base-studio-code `GlancePayload`). */
export interface GlancePayload {
  projects: GlanceProjectLite[];
  links: GlanceProjectLink[];
  drill: string | null;
  /** The desktop's currently-drilled fleet. Superseded by `fleets`; kept as a fallback. */
  drillFleet: GlanceFleetPlan | null;
  /** Every loaded fleet, keyed by project id (#2530) — what makes ALL projects drillable. */
  fleets: Record<string, GlanceFleetPlan>;
  /** Persona id → session role (#2530) — what gives L1 nodes their real colours. */
  personaRoles: Record<string, string>;
}

export type GlanceModel = GlancePayload;

// ── Union validation ──────────────────────────────────────────────────────────────────────────────

const ROLES: readonly GlanceRole[] = ['infra', 'service', 'data', 'client'];
const HEALTHS: readonly GlanceHealth[] = ['idle', 'healthy', 'warning', 'error', 'off'];
const ACTIVITIES: readonly GlanceActivity[] = ['idle', 'planning', 'building', 'waiting', 'review', 'live'];
const CATEGORIES: readonly GlanceCategory[] = ['greenfield', 'transform', 'harden', 'maintain', 'data', 'script'];
const EDGE_KINDS: readonly GlanceEdgeKind[] = ['api', 'data', 'events', 'uses-kit', 'requires'];

/**
 * A wire string, but only if it is a member of `allowed`. Anything else — a value from a newer
 * desktop, a typo, a wrong type — comes back `undefined` so the caller applies its own default.
 * This is the guard whose absence caused #238: `p.status as GStatus` accepted whatever arrived.
 */
function readUnion<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** A `Record<string, string>` wire field, non-string values dropped. */
function toStrRecord(v: unknown): Record<string, string> {
  if (!isObj(v) || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === 'string') out[k] = val;
  return out;
}

// ── Selector ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Parse the mirrored `glance` projection into a validated model, or `undefined` when the payload is
 * missing / malformed. Tolerant: unknown project entries are dropped, not thrown on, and an
 * unrecognised health/activity/category/edge-kind degrades to a default rather than propagating an
 * unindexable value into a palette lookup.
 */
export function selectGlance(data: unknown): GlanceModel | undefined {
  if (!isObj(data) || !Array.isArray(data.projects)) return undefined;

  const projects: GlanceProjectLite[] = [];
  for (const p of data.projects) {
    if (!isObj(p) || typeof p.id !== 'string') continue;
    projects.push({
      id: p.id,
      name: typeof p.name === 'string' ? p.name : p.id,
      role: readUnion(p.role, ROLES),
      category: readUnion(p.category, CATEGORIES),
      health: readUnion(p.health, HEALTHS),
      activity: readUnion(p.activity, ACTIVITIES),
      reason: typeof p.reason === 'string' && p.reason.trim() ? p.reason.trim() : undefined,
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
      // An unknown kind draws as a plain dependency rather than crashing the tab on
      // `EDGE_META[kind].color`. The desktop widened this union once already (#3119).
      kind: readUnion(l.kind, EDGE_KINDS) ?? 'api',
    });
  }

  const fleets: Record<string, GlanceFleetPlan> = {};
  if (isObj(data.fleets) && !Array.isArray(data.fleets)) {
    for (const [key, raw] of Object.entries(data.fleets)) {
      const fleet = parseFleet(raw);
      if (fleet) fleets[key] = fleet;
    }
  }

  return {
    projects,
    links,
    drill: typeof data.drill === 'string' ? data.drill : null,
    drillFleet: parseFleet(data.drillFleet),
    fleets,
    personaRoles: toStrRecord(data.personaRoles),
  };
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
  if (!isObj(v.director) || v.director.enabled !== true) return { streams, director: undefined };
  return {
    streams,
    director: {
      enabled: true,
      // Retained (#238): the director's session role drives its L1 colour bucket.
      role: typeof v.director.role === 'string' ? v.director.role : undefined,
    },
  };
}

// ── Adapter inputs ──────────────────────────────────────────────────────────────────────────────

/**
 * Turn a project's fleet into #220 `GlanceAgent`s: each stream a node, an optional director hub
 * every stream depends on (mirrors desktop `buildRealFleetData`).
 *
 * Each stream's colour comes from its persona's session role via `personaRoles` (#2530, added to
 * the payload specifically for this) — previously every agent was hardcoded `worker`, so every L1
 * node rendered the same colour. Streams carry no live activity on the wire, so none is invented.
 */
export function fleetToAgents(fleet: GlanceFleetPlan, personaRoles: Record<string, string> = {}): GlanceAgent[] {
  const agents: GlanceAgent[] = fleet.streams.map((s) => ({
    id: s.id,
    name: s.name ?? s.id,
    role: (s.persona && personaRoles[s.persona]) || 'worker',
    dependsOn: [...(s.dependsOn ?? [])],
  }));
  if (fleet.director?.enabled) {
    for (const a of agents) a.dependsOn = [...(a.dependsOn ?? []), 'director'];
    agents.push({ id: 'director', name: 'director', role: fleet.director.role ?? 'director' });
  }
  return agents;
}

/**
 * The L0 project network as `GlanceGraphInput`.
 *
 * Every project present in `fleets` is drillable (#2530). Before that field existed the payload
 * shipped only the desktop's own drilled fleet, so exactly one project on the phone could be
 * drilled; `drillFleet` is still honoured for that project as a fallback against an older desktop
 * build that sends no `fleets`.
 *
 * `health` and `activity` default to `idle` only when genuinely absent — the fallback is not doing
 * the work it used to, when a renamed field made EVERY node take it.
 */
export function glanceL0Input(model: GlanceModel): GlanceGraphInput {
  const agentsFor = (projectId: string): GlanceAgent[] | undefined => {
    const fleet = model.fleets[projectId]
      ?? (projectId === model.drill ? model.drillFleet ?? undefined : undefined);
    if (!fleet) return undefined;
    const agents = fleetToAgents(fleet, model.personaRoles);
    return agents.length > 0 ? agents : undefined;
  };

  const projects: GlanceProject[] = model.projects.map((p) => ({
    id: p.id,
    slug: p.name,
    role: p.role ?? 'service',
    category: p.category,
    health: p.health ?? 'idle',
    activity: p.activity ?? 'idle',
    reason: p.reason,
    faults: p.faults,
    agents: agentsFor(p.id),
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
