// Org page view-model (#235) — the pure bridge to the mirrored `org` store domain
// (base-studio-code `OrgPayload`: `{ orgs: Team[]; personas: PersonaRef[] }`).
//
// `orgs` is the WHOLE team library — every built-in team plus every user-authored one — and the
// desktop builder passes it through unmodified, so each entry is already a complete, renderable
// graph. Before this module it arrived on every publish and was discarded; only `personas` was read.
//
// The wire domain + payload field are frozen as `org`/`orgs` by the mobile tunnel contract
// (base-studio-code#2700) — only the desktop's *store* read was renamed. Do not "fix" the name.
//
// Positions carry designer-authored `x`/`y` and relationships a `bow`, both deliberately dropped:
// mobile re-lays out via `layeredLayout` (see orgAdapter.ts). React-free + tolerant of missing /
// partial / undefined payloads, per the selector contract in src/lib/mirror/payload.ts.
import type { OrgGraphInput, OrgPersona, OrgPosition, OrgPositionKind, OrgRelationship } from '../graph';

// ── wire shapes (mirror the desktop interfaces) ──────────────────────────────────────────────────

/** A team position (org `Position` / blueprintTypes `Position` — the two are structurally one shape). */
export interface TeamPosition {
  nodeId: string;
  kind: OrgPositionKind;
  personaId?: string;
  label?: string;
}

/** A team relationship (org `Relationship`). */
export interface TeamRelationship {
  id: string;
  archetype: string;
  from: string;
  to: string;
}

/** The graph half of a team — shared by the `org` library and a blueprint's embedded team. */
export interface TeamGraphVM {
  positions: TeamPosition[];
  relationships: TeamRelationship[];
}

/** One entry of the mirrored team library (`Team`). */
export interface OrgTeamVM extends TeamGraphVM {
  id: string;
  name: string;
  /** Team description — the subtitle in a team picker. */
  blurb?: string;
  /** Packaged (`BUILTIN_ORGS`) vs user-authored — the grouping key in a team picker. */
  builtin?: boolean;
}

/** A pared persona ref from the `org` domain (`PersonaRef`). */
export interface PersonaRefVM {
  id: string;
  name: string;
  role?: string;
  pooled?: boolean;
  /** One-line description, rendered as the node inspector's subtitle. */
  blurb?: string;
  /** The model this position runs on (e.g. `sonnet`). */
  model?: string;
  /** Packaged vs user-authored persona. */
  builtin?: boolean;
}

export interface OrgModel {
  teams: OrgTeamVM[];
  personas: PersonaRefVM[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const optStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const optBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

const POSITION_KINDS: OrgPositionKind[] = ['agent', 'external', 'resource'];

/**
 * Parse the positions + relationships common to an `org` team and a blueprint's embedded team.
 *
 * @returns the graph, or `null` when the shape is missing / malformed / has no positions — an
 *   edges-only team is not renderable, so callers skip it rather than showing an empty canvas.
 */
export function parseTeamGraph(v: unknown): TeamGraphVM | null {
  if (!isObj(v) || !Array.isArray(v.positions)) return null;
  const positions: TeamPosition[] = [];
  for (const p of v.positions) {
    if (!isObj(p) || typeof p.nodeId !== 'string') continue;
    positions.push({
      nodeId: p.nodeId,
      kind: (typeof p.kind === 'string' && (POSITION_KINDS as string[]).includes(p.kind) ? p.kind : 'agent') as OrgPositionKind,
      personaId: optStr(p.personaId),
      label: optStr(p.label),
    });
  }
  const relationships: TeamRelationship[] = [];
  for (const r of Array.isArray(v.relationships) ? v.relationships : []) {
    if (!isObj(r) || typeof r.from !== 'string' || typeof r.to !== 'string') continue;
    relationships.push({
      id: typeof r.id === 'string' ? r.id : `${r.from}>${r.to}`,
      archetype: str(r.archetype, 'manages'),
      from: r.from,
      to: r.to,
    });
  }
  return positions.length ? { positions, relationships } : null;
}

/** Parse the mirrored `org` domain's persona refs. */
export function selectOrgPersonas(data: unknown): PersonaRefVM[] {
  if (!isObj(data) || !Array.isArray(data.personas)) return [];
  const out: PersonaRefVM[] = [];
  for (const p of data.personas) {
    if (!isObj(p) || typeof p.id !== 'string') continue;
    out.push({
      id: p.id,
      name: str(p.name, p.id),
      role: optStr(p.role),
      pooled: optBool(p.pooled),
      blurb: optStr(p.blurb),
      model: optStr(p.model),
      builtin: optBool(p.builtin),
    });
  }
  return out;
}

/** Parse the mirrored `org` domain's team library. Teams with no renderable positions are skipped. */
export function selectOrgTeams(data: unknown): OrgTeamVM[] {
  if (!isObj(data) || !Array.isArray(data.orgs)) return [];
  const out: OrgTeamVM[] = [];
  for (const o of data.orgs) {
    if (!isObj(o) || typeof o.id !== 'string') continue;
    const graph = parseTeamGraph(o);
    if (!graph) continue;
    out.push({
      id: o.id,
      name: str(o.name, o.id),
      blurb: optStr(o.blurb),
      builtin: optBool(o.builtin),
      positions: graph.positions,
      relationships: graph.relationships,
    });
  }
  return out;
}

/** Parse the whole `org` projection — the team library plus the persona refs it resolves against. */
export function selectOrg(data: unknown): OrgModel {
  return { teams: selectOrgTeams(data), personas: selectOrgPersonas(data) };
}

/**
 * Map a team graph → `OrgGraphInput` for `buildOrgScene`. Persona refs resolve labels + stacking;
 * with none, positions fall back to their id/label and pools can't collapse (the adapter tolerates
 * an empty persona list). Only personas the team actually references are carried through.
 */
export function teamToOrgInput(team: TeamGraphVM, personas: PersonaRefVM[] = []): OrgGraphInput {
  const referenced = new Set(team.positions.map((p) => p.personaId).filter((id): id is string => !!id));
  const orgPositions: OrgPosition[] = team.positions.map((p) => ({
    nodeId: p.nodeId,
    kind: p.kind,
    personaId: p.personaId,
    label: p.label,
  }));
  const orgRelationships: OrgRelationship[] = team.relationships.map((r) => ({
    id: r.id,
    archetype: r.archetype,
    from: r.from,
    to: r.to,
  }));
  const orgPersonas: OrgPersona[] = personas
    .filter((p) => referenced.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, role: p.role, pooled: p.pooled, blurb: p.blurb, model: p.model }));
  return { positions: orgPositions, relationships: orgRelationships, personas: orgPersonas };
}
