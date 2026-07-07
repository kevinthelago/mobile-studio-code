// Design (UI) page view-model (#221) — the pure bridge to TWO mirrored store domains: `components`
// (base-studio-code#2498 `ComponentsPayload`: kits + component summaries + kit-usage) and `themes`
// (`ThemesPayload`: the theme registry + the active id). Read-only. React-free + tolerant of a
// missing / partial / undefined payload so both selectors are unit-testable from plain fixtures.
//
// COMPOSITION GRAPH DECISION: `ComponentCard.composes` carries the names a component composes, so the
// payload DOES ship composition edges. When any resolve to another component we build a graph via the
// #220 glance layout pipeline (`compositionInput` → `buildGlanceScene`); otherwise the page groups by
// kit (`groupByKit`) and says so.
import type { GlanceGraphInput, GlanceRole } from '../graph';

// ── components ────────────────────────────────────────────────────────────────────────────────────

export interface KitVM {
  id: string;
  name: string;
  tech?: string;
  style?: string;
  stack: string;
  dot: string;
  builtin?: boolean;
}

export interface ComponentCardVM {
  id: string;
  name: string;
  kitId: string;
  role: string;
  version: string;
  used: number;
  tags: string[];
  variants: string[];
  composes: string[];
  builtin?: boolean;
}

export interface KitConsumerVM {
  projectKey: string;
  kitId: string;
  live?: boolean;
  auto?: boolean;
}

export interface ComponentsModel {
  kits: KitVM[];
  components: ComponentCardVM[];
  usage: KitConsumerVM[];
}

// ── themes ──────────────────────────────────────────────────────────────────────────────────────

export interface ThemeVM {
  id: string;
  label: string;
  description: string;
  varCount: number;
  builtin?: boolean;
  active: boolean;
}

export interface ThemesModel {
  themes: ThemeVM[];
  active: string;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function parseKits(v: unknown): KitVM[] {
  if (!Array.isArray(v)) return [];
  const out: KitVM[] = [];
  for (const k of v) {
    if (!isObj(k) || typeof k.id !== 'string') continue;
    out.push({
      id: k.id,
      name: str(k.name, k.id),
      tech: typeof k.tech === 'string' ? k.tech : undefined,
      style: typeof k.style === 'string' ? k.style : undefined,
      stack: str(k.stack),
      dot: str(k.dot, '#8b94a7'),
      builtin: k.builtin === true || undefined,
    });
  }
  return out;
}

function parseComponents(v: unknown): ComponentCardVM[] {
  if (!Array.isArray(v)) return [];
  const out: ComponentCardVM[] = [];
  for (const c of v) {
    if (!isObj(c) || typeof c.id !== 'string') continue;
    out.push({
      id: c.id,
      name: str(c.name, c.id),
      kitId: str(c.kitId),
      role: str(c.role),
      version: str(c.version),
      used: num(c.used),
      tags: strArr(c.tags),
      variants: strArr(c.variants),
      composes: strArr(c.composes),
      builtin: c.builtin === true || undefined,
    });
  }
  return out;
}

function parseUsage(v: unknown): KitConsumerVM[] {
  if (!Array.isArray(v)) return [];
  const out: KitConsumerVM[] = [];
  for (const u of v) {
    if (!isObj(u) || typeof u.projectKey !== 'string' || typeof u.kitId !== 'string') continue;
    out.push({ projectKey: u.projectKey, kitId: u.kitId, live: u.live === true || undefined, auto: u.auto === true || undefined });
  }
  return out;
}

/** Parse the mirrored `components` projection, or `undefined` when missing / malformed. */
export function selectComponents(data: unknown): ComponentsModel | undefined {
  if (!isObj(data) || !Array.isArray(data.components)) return undefined;
  return { kits: parseKits(data.kits), components: parseComponents(data.components), usage: parseUsage(data.usage) };
}

/** Parse the mirrored `themes` projection, or `undefined` when missing / malformed. */
export function selectThemes(data: unknown): ThemesModel | undefined {
  if (!isObj(data) || !Array.isArray(data.themes)) return undefined;
  const active = str(data.active, 'default');
  const themes: ThemeVM[] = [];
  for (const th of data.themes) {
    if (!isObj(th) || typeof th.id !== 'string') continue;
    themes.push({
      id: th.id,
      label: str(th.label, th.id),
      description: str(th.description),
      varCount: isObj(th.vars) ? Object.keys(th.vars).length : 0,
      builtin: th.builtin === true || undefined,
      active: th.id === active,
    });
  }
  return { themes, active };
}

// ── grouping + composition graph ──────────────────────────────────────────────────────────────────

export interface KitGroup {
  kit: KitVM;
  components: ComponentCardVM[];
  /** Projects consuming this kit (usage index). */
  consumers: KitConsumerVM[];
}

/** Group components under their kit (kits with no components still listed; orphan components collect
 *  under a synthetic "other" kit so nothing is dropped). */
export function groupByKit(model: ComponentsModel): KitGroup[] {
  const byKit = new Map<string, ComponentCardVM[]>();
  for (const c of model.components) {
    const list = byKit.get(c.kitId) ?? [];
    list.push(c);
    byKit.set(c.kitId, list);
  }
  const usageByKit = new Map<string, KitConsumerVM[]>();
  for (const u of model.usage) {
    const list = usageByKit.get(u.kitId) ?? [];
    list.push(u);
    usageByKit.set(u.kitId, list);
  }
  const groups: KitGroup[] = model.kits.map((kit) => ({
    kit,
    components: byKit.get(kit.id) ?? [],
    consumers: usageByKit.get(kit.id) ?? [],
  }));
  // Orphan components (kit not in the kits list) → a trailing "other" bucket.
  const known = new Set(model.kits.map((k) => k.id));
  const orphans = model.components.filter((c) => !known.has(c.kitId));
  if (orphans.length) {
    groups.push({
      kit: { id: '__other__', name: 'Other', stack: '', dot: '#8b94a7' },
      components: orphans,
      consumers: [],
    });
  }
  return groups;
}

/** Component role → glance colour category (cosmetic; mirrors the desktop role palette intent). */
const ROLE_TO_GROLE: Record<string, GlanceRole> = {
  primitive: 'data',
  composite: 'service',
  layout: 'infra',
  page: 'client',
  service: 'data',
};

/** True when at least one component composes another present component (⇒ a graph is worth drawing). */
export function hasComposition(model: ComponentsModel): boolean {
  const byName = new Map(model.components.map((c) => [c.name, c.id]));
  return model.components.some((c) => c.composes.some((n) => byName.has(n) && byName.get(n) !== c.id));
}

/**
 * The component composition graph as a `GlanceGraphInput` (each component a node, each resolved
 * `composes` name an edge component→composed). Feed to `buildGlanceScene` for the same laid-out scene
 * the glance/fleet graphs use. Deterministic.
 */
export function compositionInput(model: ComponentsModel): GlanceGraphInput {
  const byName = new Map(model.components.map((c) => [c.name, c.id]));
  const links: GlanceGraphInput['links'] = [];
  for (const c of model.components) {
    for (const name of c.composes) {
      const to = byName.get(name);
      if (to && to !== c.id) links.push({ id: `${c.id}>${to}`, from: c.id, to, kind: 'api' });
    }
  }
  return {
    projects: model.components.map((c) => ({
      id: c.id,
      slug: c.name,
      role: ROLE_TO_GROLE[c.role] ?? 'service',
      status: 'idle',
    })),
    links,
  };
}
