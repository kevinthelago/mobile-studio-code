// Blueprints page view-model (#221) — the pure bridge to the mirrored `blueprints` store domain
// (base-studio-code#2498 `BlueprintsPayload`: the library cards + the ACTIVE blueprint's embedded
// team graph). The active team renders via the #220 org adapter, so this also maps a `BlueprintTeam`
// (positions + relationships) → `OrgGraphInput`, optionally resolving persona refs from the mirrored
// `org` domain so pools can collapse. React-free + tolerant of missing / partial / undefined payloads.
//
// The team-graph parsing and the persona refs live in orgPage.ts (#235): a blueprint's embedded team
// and an `org` library team are the same wire shape, so they share one parser rather than drifting
// apart. Re-exported here so the blueprint call sites keep one import.
import { parseTeamGraph, selectOrgPersonas, teamToOrgInput, type TeamGraphVM } from './orgPage';

export {
  selectOrgPersonas,
  /** @see teamToOrgInput — the blueprint-flavoured name, kept for the existing call sites. */
  teamToOrgInput as blueprintTeamToOrgInput,
};
export type { PersonaRefVM, TeamPosition, TeamRelationship } from './orgPage';

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

/** The ACTIVE blueprint's embedded team — structurally identical to an `org` library team. */
export type BlueprintTeamVM = TeamGraphVM;

export interface BlueprintsModel {
  active: string;
  library: BlueprintCardVM[];
  activeTeam: BlueprintTeamVM | null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

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
  return { active: str(data.active), library, activeTeam: parseTeamGraph(data.activeTeam) };
}

