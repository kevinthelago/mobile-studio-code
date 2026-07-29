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
  skillIds: string[];
}
// `hue` is deliberately NOT carried (#245 S2). Desktop hues are CSS: `parseSkillGroupsFile` defaults
// to `var(--accent)` and authored values may be `oklch(...)` literals — React Native can parse
// neither, so a hue bound to a `color` prop is a crash or a silently ignored style. Anyone adding
// group colour must normalise first (reject `var()`/`oklch()`, fall back to the theme accent); the
// payload decoder documents the same thing at the wire.

export interface LessonVM {
  id: string;
  mistake: string;
  cause: string;
  rule: string;
  status: string;
  seen: number;
  /** Where the lesson was captured (pane / repo). Epoch ms, NOT ISO — no string-vs-number trap. */
  provenance: string;
  createdAt: number;
  updatedAt: number;
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
    out.push({ id: g.id, name: str(g.name, g.id), skillIds: strArr(g.skillIds) });
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
      provenance: str(l.provenance),
      createdAt: num(l.createdAt),
      updatedAt: num(l.updatedAt),
    });
  }
  // Newest first. The wire order is the desktop's storage order, which is not recency — a stable
  // sort keeps equal timestamps (and the 0 fallback) in payload order rather than shuffling them.
  pending.sort((a, b) => b.createdAt - a.createdAt);
  return { project: v.project, pending };
}

/**
 * Relative age of an epoch-ms timestamp, e.g. `3d ago`. Empty string for a missing (0) timestamp, so
 * a lesson from a desktop that predates the field renders without a bogus "56y ago".
 *
 * @param at epoch milliseconds
 * @param now epoch milliseconds to measure against — injected so this stays pure and testable
 */
export function relativeAge(at: number, now: number): string {
  if (!at || !Number.isFinite(at) || at > now) return '';
  const secs = Math.floor((now - at) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
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
