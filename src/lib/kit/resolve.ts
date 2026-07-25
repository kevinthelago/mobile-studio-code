// The token/layout resolver — the ONE piece the RN port adds that the web renderer gets free from
// the CSS cascade. base-studio-code components reference semantic tokens as strings (`var(--card-bg)`,
// `tone:"dim"`) and let CSS resolve them; React Native has no cascade, so we resolve each reference to
// a concrete value at render time against the active theme.
//
// The bridge is deliberate: the contract's base palette tokens map onto our existing `theme.ts` values
// (which are already the app's resolved hex), so adopting the design-system token vocabulary is also
// the theme-reconciliation step — one app palette, addressed by the shared token names. The desktop's
// base contract is authored in oklch + var() chains (tokens-contract.css); RN can't evaluate those, so
// the chains are flattened here to `theme.ts` fields once.
import type { FlexAlignType } from 'react-native';
import type { Theme } from '../../theme';

// ── spacing ──────────────────────────────────────────────────────────────────
/** A spacing value: a named scale rung (mirrors --sp-*), or a raw px number. */
export type Space = number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const SCALE: Record<Exclude<Space, number>, number> = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** Resolve a `Space` to a px number (rung → scale, number → itself). */
export function space(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v in SCALE) return SCALE[v as Exclude<Space, number>];
  return undefined;
}

/** Padding shorthand: a single Space (all sides) or [block, inline]. Returns RN-shaped values. */
export function pad(v: unknown): { paddingVertical?: number; paddingHorizontal?: number } | undefined {
  if (Array.isArray(v)) return { paddingVertical: space(v[0]), paddingHorizontal: space(v[1]) };
  const n = space(v);
  return n == null ? undefined : { paddingVertical: n, paddingHorizontal: n };
}

// ── flex alignment (values are identical to RN's) ────────────────────────────
const ALIGN: Record<string, FlexAlignType> = {
  start: 'flex-start', center: 'center', end: 'flex-end', baseline: 'baseline', stretch: 'stretch',
};
const JUSTIFY: Record<string, 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  between: 'space-between', around: 'space-around', evenly: 'space-evenly',
};
export function align(a: unknown): FlexAlignType | undefined {
  return typeof a === 'string' ? ALIGN[a] : undefined;
}
export function justify(j: unknown) {
  return typeof j === 'string' ? JUSTIFY[j] : undefined;
}

// ── radius ───────────────────────────────────────────────────────────────────
const RADIUS: Record<string, number> = { sm: 4, md: 6, lg: 10 };
/** Box/Card radius: an enum rung (sm/md/lg → --r-*) or a raw px number. */
export function radius(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v in RADIUS) return RADIUS[v];
  return undefined;
}

// ── the token contract (tokens-contract.css, flattened to theme.ts) ──────────
// Each token resolves to a theme field, a literal, or a reference to another token — mirroring the
// var() chains in tokens-contract.css. `token()` follows refs to a concrete value.
type TokenVal = { field: keyof Theme } | { lit: string | number } | { ref: string };

const TOKENS: Record<string, TokenVal> = {
  // base palette → our resolved theme.ts values (the reconciliation bridge)
  '--bg-canvas': { field: 'bg' },
  '--bg-panel': { field: 'surface' },
  '--bg-elev': { field: 'surface' },
  '--bg-elev2': { field: 'surfaceSolid' },
  '--border': { field: 'borderColor' },
  '--border-soft': { field: 'borderColor' },
  '--fg': { field: 'fg' },
  '--fg-muted': { field: 'fgMuted' },
  '--fg-dim': { field: 'fgDim' },
  '--accent': { field: 'accent' },
  '--accent-dim': { field: 'accent2' },
  '--success': { lit: '#4fd6a0' },
  '--info': { lit: '#5b9dff' },
  '--danger': { lit: '#f87171' },
  // semantic component tokens (var() chains flattened)
  '--card-bg': { ref: '--bg-panel' },
  '--card-border': { ref: '--border-soft' },
  '--btn-bg': { ref: '--bg-elev' },
  '--btn-border': { ref: '--border-soft' },
  '--btn-fg': { ref: '--fg' },
  '--btn-primary-bg': { ref: '--accent' },
  '--btn-primary-fg': { lit: '#1a120a' },
  '--btn-ghost-bg': { lit: 'transparent' },
  '--chip-bg': { ref: '--bg-elev2' },
  '--chip-fg': { ref: '--fg-muted' },
  '--chip-border': { ref: '--border-soft' },
  '--field-bg': { ref: '--bg-canvas' },
  '--field-border': { ref: '--border-soft' },
  '--field-fg': { ref: '--fg' },
};

/** Resolve a token name (`--card-bg`) to a concrete value, following ref chains. */
export function token(name: string, theme: Theme): string | number | undefined {
  const seen = new Set<string>();
  let cur: string | undefined = name;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const entry: TokenVal | undefined = TOKENS[cur];
    if (!entry) return undefined;
    if ('field' in entry) return theme[entry.field] as string;
    if ('lit' in entry) return entry.lit;
    cur = entry.ref;
  }
  return undefined;
}

// semantic `tone` enum (Text/Chip/Code) → a base token
const TONE: Record<string, string> = {
  dim: '--fg-dim', muted: '--fg-muted', accent: '--accent',
  danger: '--danger', success: '--success', info: '--info', neutral: '--chip-fg',
};

/**
 * Resolve a `color`-typed prop value to a concrete color string.
 * Accepts a semantic tone name (`dim`), a token reference (`var(--accent)` or `--accent`),
 * or a raw CSS color (`#fff`, `rgb(...)`) which passes through.
 */
export function color(value: unknown, theme: Theme): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  if (value in TONE) return token(TONE[value], theme) as string | undefined;
  const varMatch = value.match(/^var\((--[\w-]+)\)$/);
  const name = varMatch ? varMatch[1] : value.startsWith('--') ? value : null;
  if (name) return token(name, theme) as string | undefined;
  return value; // a raw color (#hex/rgb/named) — pass through
}
