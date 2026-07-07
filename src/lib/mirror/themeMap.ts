/**
 * Theme parity scaffold (#218): map desktop-shaped theme data (the kit theme
 * registry — `themes.json`, mirror domain "themes") onto the app's native
 * theme fields.
 *
 * Desktop shape (src-tauri/data/ui/themes.json): `{ themes: [{ id, label,
 * description, vars }] }` where `vars` overrides semantic CSS custom
 * properties (`--card-bg`, `--accent`, …). Values may be raw colors, `var()`
 * references, or `color-mix()` expressions; only RESOLVED literal colors are
 * mappable on native, everything else falls back to the current look.
 *
 * Deliberately pure and dependency-free (no React, no src/theme.ts import) so
 * it runs under `tsx --test`. `ThemeTokenTarget` is a structural subset of the
 * app's `Theme` — any `Theme` satisfies it.
 */

/** The native theme fields kit tokens can drive (structural subset of Theme). */
export interface ThemeTokenTarget {
  bg: string;
  fg: string;
  fgMuted: string;
  fgDim: string;
  accent: string;
  accent2: string;
  surface: string;
  surfaceSolid: string;
  borderColor: string;
  radius: number;
}

export interface KitTheme {
  id: string;
  label: string;
  description?: string;
  vars: Record<string, string>;
}

/** Kit token aliases → native theme field, first present + resolvable wins. */
const COLOR_TOKEN_MAP: ReadonlyArray<{
  field: keyof Pick<
    ThemeTokenTarget,
    'bg' | 'fg' | 'fgMuted' | 'fgDim' | 'accent' | 'surface' | 'borderColor'
  >;
  tokens: readonly string[];
}> = [
  { field: 'bg', tokens: ['--bg', '--bg-canvas', 'bg'] },
  { field: 'fg', tokens: ['--fg', '--text', 'fg'] },
  { field: 'fgMuted', tokens: ['--fg-muted', 'fgMuted'] },
  { field: 'fgDim', tokens: ['--fg-dim', 'fgDim'] },
  { field: 'accent', tokens: ['--accent', 'accent'] },
  { field: 'surface', tokens: ['--card-bg', '--bg-panel', '--surface', 'surface'] },
  { field: 'borderColor', tokens: ['--border', '--card-border', 'border'] },
];

const RADIUS_TOKENS = ['--card-radius', '--radius', 'radius'] as const;

/**
 * A value the native renderer can use directly: hex / rgb(a) / hsl(a).
 * `var(...)` references and `color-mix(...)` expressions are NOT resolvable
 * without the desktop's base token table, so they are skipped.
 */
export function isResolvedColor(value: string): boolean {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return true;
  return /^(rgb|rgba|hsl|hsla)\(/.test(v) && !v.includes('var(');
}

/** Parse a kit radius value ("14px" or "14") to a number; null if not usable. */
export function parseRadius(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(value.trim());
  return m ? Number(m[1]) : null;
}

/**
 * Apply a kit theme's `vars` onto a base theme, returning a new theme object.
 * Unmappable / unresolvable / missing tokens keep the base value — with no
 * sync (or an all-`var()` theme like the desktop's "warm") the result IS the
 * base, so the app defaults to its current look.
 */
export function mapKitTokens<T extends ThemeTokenTarget>(
  base: T,
  vars: Record<string, string> | null | undefined,
): T {
  if (!vars || typeof vars !== 'object') return base;
  const out: T = { ...base };
  let changed = false;

  for (const { field, tokens } of COLOR_TOKEN_MAP) {
    for (const token of tokens) {
      const value = vars[token];
      if (typeof value === 'string' && isResolvedColor(value)) {
        out[field] = value.trim() as T[typeof field];
        changed = true;
        break;
      }
    }
  }
  // The accent pair moves together (mobile has no independent accent2 token).
  if (out.accent !== base.accent) out.accent2 = out.accent;

  for (const token of RADIUS_TOKENS) {
    const value = vars[token];
    if (typeof value === 'string') {
      const r = parseRadius(value);
      if (r !== null) {
        out.radius = r;
        changed = true;
        break;
      }
    }
  }
  // Surface pair: the solid variant tracks the mapped surface.
  if (out.surface !== base.surface) out.surfaceSolid = out.surface;

  return changed ? out : base;
}

/**
 * Parse the synced `themes` mirror payload into a list of kit themes.
 * Accepts the registry object (`{ themes: [...] }`) or a bare array; anything
 * malformed yields [] so callers safely render "no synced themes".
 */
export function parseKitThemes(json: unknown): KitTheme[] {
  const list = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as { themes?: unknown }).themes)
      ? (json as { themes: unknown[] }).themes
      : [];

  const out: KitTheme[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || e.id.length === 0) continue;
    const vars: Record<string, string> = {};
    if (e.vars && typeof e.vars === 'object' && !Array.isArray(e.vars)) {
      for (const [k, v] of Object.entries(e.vars as Record<string, unknown>)) {
        if (typeof v === 'string') vars[k] = v;
      }
    }
    out.push({
      id: e.id,
      label: typeof e.label === 'string' && e.label ? e.label : e.id,
      description: typeof e.description === 'string' ? e.description : undefined,
      vars,
    });
  }
  return out;
}
