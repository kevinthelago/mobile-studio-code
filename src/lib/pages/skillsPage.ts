// Skills page view-model (#221) — the pure bridge to the mirrored `skills` store domain
// (base-studio-code#2498 `SkillsPayload`: the library cards + task groups + the active project's
// pending lessons). Read-only (no analytics, no CRUD). Tolerant of a missing / partial / undefined
// payload; React-free so it is unit-testable.

export interface SkillCardVM {
  id: string;
  name: string;
  kind: string;
  source: string;
  desc: string;
  projects: string[];
  enabled: boolean;
  pinned: boolean;
  packaged?: boolean;
}

export interface SkillGroupVM {
  id: string;
  name: string;
  hue: string;
  skillIds: string[];
}

export interface LessonVM {
  id: string;
  mistake: string;
  cause: string;
  rule: string;
  status: string;
  seen: number;
}

export interface SkillsModel {
  skills: SkillCardVM[];
  groups: SkillGroupVM[];
  lessons: { project: string; pending: LessonVM[] } | null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function parseSkills(v: unknown): SkillCardVM[] {
  if (!Array.isArray(v)) return [];
  const out: SkillCardVM[] = [];
  for (const s of v) {
    if (!isObj(s) || typeof s.id !== 'string') continue;
    out.push({
      id: s.id,
      name: str(s.name, s.id),
      kind: str(s.kind),
      source: str(s.source),
      desc: str(s.desc),
      projects: strArr(s.projects),
      enabled: s.enabled !== false,
      pinned: s.pinned === true,
      packaged: s.packaged === true || undefined,
    });
  }
  return out;
}

function parseGroups(v: unknown): SkillGroupVM[] {
  if (!Array.isArray(v)) return [];
  const out: SkillGroupVM[] = [];
  for (const g of v) {
    if (!isObj(g) || typeof g.id !== 'string') continue;
    out.push({ id: g.id, name: str(g.name, g.id), hue: str(g.hue), skillIds: strArr(g.skillIds) });
  }
  return out;
}

function parseLessons(v: unknown): { project: string; pending: LessonVM[] } | null {
  if (!isObj(v) || typeof v.project !== 'string') return null;
  const pending: LessonVM[] = [];
  for (const l of Array.isArray(v.pending) ? v.pending : []) {
    if (!isObj(l) || typeof l.id !== 'string') continue;
    pending.push({
      id: l.id,
      mistake: str(l.mistake),
      cause: str(l.cause),
      rule: str(l.rule),
      status: str(l.status, 'pending'),
      seen: num(l.seen),
    });
  }
  return { project: v.project, pending };
}

/** Parse the mirrored `skills` projection, or `undefined` when the payload is missing / malformed. */
export function selectSkills(data: unknown): SkillsModel | undefined {
  if (!isObj(data) || !Array.isArray(data.skills)) return undefined;
  return {
    skills: parseSkills(data.skills),
    groups: parseGroups(data.groups),
    lessons: parseLessons(data.lessons),
  };
}

/** Resolve the skill names for a group's member ids (dropping ids no longer in the library). */
export function groupSkillNames(group: SkillGroupVM, skills: SkillCardVM[]): string[] {
  const byId = new Map(skills.map((s) => [s.id, s.name]));
  return group.skillIds.map((id) => byId.get(id)).filter((n): n is string => !!n);
}
