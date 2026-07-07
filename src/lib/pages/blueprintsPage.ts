// Blueprints page view-model (#221) — the pure bridge to the mirrored `blueprints` store domain
// (base-studio-code#2498 `BlueprintsPayload`: the library cards + the ACTIVE blueprint's embedded
// team graph). The active team renders via the #220 org adapter, so this also maps a `BlueprintTeam`
// (positions + relationships) → `OrgGraphInput`, optionally resolving persona refs from the mirrored
// `org` domain so pools can collapse. React-free + tolerant of missing / partial / undefined payloads.
import type { OrgGraphInput, OrgPosition, OrgRelationship, OrgPersona, OrgPositionKind } from '../graph';

// ── wire shapes (mirror the desktop interfaces) ──────────────────────────────────────────────────

export interface BlueprintCardVM {
  id: string;
  name: string;
  desc: string;
  icon?: string;
  category?: string;
  mode?: string;
  tags: string[];
  uses?: number;
  stageCount: number;
  hasTeam: boolean;
  uiKit?: { id: string; version: string; themeId?: string };
}

/** A team position (blueprintTypes `Position` / org `Position`). */
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

export interface BlueprintTeamVM {
  positions: TeamPosition[];
  relationships: TeamRelationship[];
}

export interface BlueprintsModel {
  active: string;
  library: BlueprintCardVM[];
  activeTeam: BlueprintTeamVM | null;
}

/** A pared persona ref from the mirrored `org` domain (`PersonaRef`), used only to resolve team
 *  labels + stacking so pools collapse. */
export interface PersonaRefVM {
  id: string;
  name: string;
  role?: string;
  pooled?: boolean;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const POSITION_KINDS: OrgPositionKind[] = ['agent', 'external', 'resource'];

function parseTeam(v: unknown): BlueprintTeamVM | null {
  if (!isObj(v) || !Array.isArray(v.positions)) return null;
  const positions: TeamPosition[] = [];
  for (const p of v.positions) {
    if (!isObj(p) || typeof p.nodeId !== 'string') continue;
    positions.push({
      nodeId: p.nodeId,
      kind: (typeof p.kind === 'string' && (POSITION_KINDS as string[]).includes(p.kind) ? p.kind : 'agent') as OrgPositionKind,
      personaId: typeof p.personaId === 'string' ? p.personaId : undefined,
      label: typeof p.label === 'string' ? p.label : undefined,
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

/** Parse the mirrored `blueprints` projection, or `undefined` when missing / malformed. */
export function selectBlueprints(data: unknown): BlueprintsModel | undefined {
  if (!isObj(data) || !Array.isArray(data.library)) return undefined;
  const library: BlueprintCardVM[] = [];
  for (const b of data.library) {
    if (!isObj(b) || typeof b.id !== 'string') continue;
    library.push({
      id: b.id,
      name: str(b.name, b.id),
      desc: str(b.desc),
      icon: typeof b.icon === 'string' ? b.icon : undefined,
      category: typeof b.category === 'string' ? b.category : undefined,
      mode: typeof b.mode === 'string' ? b.mode : undefined,
      tags: strArr(b.tags),
      uses: num(b.uses),
      stageCount: num(b.stageCount) ?? 0,
      hasTeam: b.hasTeam === true,
      uiKit: isObj(b.uiKit) && typeof b.uiKit.id === 'string'
        ? { id: b.uiKit.id, version: str(b.uiKit.version), themeId: typeof b.uiKit.themeId === 'string' ? b.uiKit.themeId : undefined }
        : undefined,
    });
  }
  return { active: str(data.active), library, activeTeam: parseTeam(data.activeTeam) };
}

/** Parse the mirrored `org` domain's persona refs (used only to enrich the team graph). */
export function selectOrgPersonas(data: unknown): PersonaRefVM[] {
  if (!isObj(data) || !Array.isArray(data.personas)) return [];
  const out: PersonaRefVM[] = [];
  for (const p of data.personas) {
    if (!isObj(p) || typeof p.id !== 'string') continue;
    out.push({
      id: p.id,
      name: str(p.name, p.id),
      role: typeof p.role === 'string' ? p.role : undefined,
      pooled: typeof p.pooled === 'boolean' ? p.pooled : undefined,
    });
  }
  return out;
}

/**
 * Map the active blueprint's team → `OrgGraphInput` for `buildOrgScene`. Persona refs (from the `org`
 * domain) resolve labels + stacking; with none, positions fall back to their id/label and pools can't
 * collapse (the adapter tolerates an empty persona list).
 */
export function blueprintTeamToOrgInput(team: BlueprintTeamVM, personas: PersonaRefVM[] = []): OrgGraphInput {
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
    .map((p) => ({ id: p.id, name: p.name, role: p.role, pooled: p.pooled }));
  return { positions: orgPositions, relationships: orgRelationships, personas: orgPersonas };
}
