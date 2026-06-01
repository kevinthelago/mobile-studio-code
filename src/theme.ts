import {
  createContext, useContext, useEffect, useMemo, useState, createElement,
  type ReactElement, type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Font from 'expo-font';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';

// The redesign's monospace vocabulary is JetBrains Mono (the design's
// `--msc-mono`). Every theme's `fontMono` points at this family. Loading is
// gated on the main tab surface (app/(tabs)/_layout.tsx) so the redesign never
// flashes a fallback; this best-effort module-level load also covers the
// pre-tabs onboarding screens. iOS synthesizes the heavier weights (500/600/700
// used across the UI) from the regular face — close enough for mono chrome.
export const MONO_FAMILY = 'JetBrains Mono';

// Fire-and-forget: register the family as early as theme.ts is imported. Guarded
// because it touches the native font module (no-op / harmless if unavailable).
try {
  void Font.loadAsync({ [MONO_FAMILY]: JetBrainsMono_400Regular }).catch(() => {});
} catch {
  /* non-RN context (e.g. a node script importing this module) */
}

export interface CodePalette {
  kw: string;
  fn: string;
  st: string;
  nm: string;
  cm: string;
  ty: string;
  op: string;
  pn: string;
  pa: string;
  id: string;
  sp: string;
}

export interface Theme {
  name: string;
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
  fontMono: string;
  code: CodePalette;
  statusFg: string;
  // msc-redesign tokens (see design/msc-redesign/.../styles.css). Each theme
  // provides a coherent set so the redesign primitives read the same regardless
  // of which theme is active.
  elev: string;          // surface tier 2 — chips, buttons, input bg
  elev2: string;         // surface tier 3 — pill tags, faint emphasis
  borderStrong: string;  // higher-contrast border (msc-border)
  accentDim: string;     // darker accent for borders / focused ring
  success: string;       // status: running / clean / green tag
  info: string;          // status: tunnel / cool tag
  warn: string;          // status: awaiting input / dirty
  danger: string;        // status: error / destructive
  pink: string;          // claude/orb pink accent
  glass?: boolean;
  orbs?: boolean;
  sharp?: boolean;
  light?: boolean;
}

export type ThemeId = 'glass' | 'dawn' | 'terminal' | 'paper' | 'basic';

export const THEMES: Record<ThemeId, Theme> = {
  glass: {
    name: 'iOS Liquid Glass',
    bg: '#0b0d14',
    fg: '#e6e9f2',
    fgMuted: 'rgba(255,255,255,0.55)',
    fgDim: 'rgba(255,255,255,0.32)',
    accent: '#ffaecf',
    accent2: '#c084fc',
    surface: 'rgba(28,32,46,0.55)',
    surfaceSolid: '#13161e',
    borderColor: 'rgba(255,255,255,0.10)',
    radius: 24,
    fontMono: MONO_FAMILY,
    code: {
      kw: '#c084fc', fn: '#67d3ff', st: '#f0a37e', nm: '#ffd479',
      cm: 'rgba(160,170,200,0.55)', ty: '#7ee2c4', op: '#cdd2e0',
      pn: 'rgba(220,225,240,0.5)', pa: '#ffaecf', id: '#e6e9f2', sp: '#e6e9f2',
    },
    statusFg: '#fff',
    elev: '#1a1f2e',
    elev2: '#222837',
    borderStrong: 'rgba(255,255,255,0.18)',
    accentDim: '#aa6a8a',
    success: '#7fc488',
    info: '#7ebbef',
    warn: '#e0b85a',
    danger: '#ef7b9a',
    pink: '#ffaecf',
    glass: true,
    orbs: true,
  },
  dawn: {
    name: 'Soft Dark',
    bg: '#1a1612',
    fg: '#e8e2d8',
    fgMuted: '#a8a095',
    fgDim: '#7a736b',
    accent: '#d97757',
    accent2: '#ffaecf',
    surface: '#13100d',
    surfaceSolid: '#13100d',
    borderColor: '#2a241f',
    radius: 18,
    fontMono: MONO_FAMILY,
    code: {
      kw: '#e0a3ff', fn: '#9bd9ff', st: '#ffb088', nm: '#ffd479',
      cm: '#5a5550', ty: '#a8e6c4', op: '#a8a095',
      pn: '#6a655f', pa: '#ffaecf', id: '#e8e2d8', sp: '#e8e2d8',
    },
    statusFg: '#e8e2d8',
    // Canonical msc-redesign tokens — the redesign styles.css explicitly
    // "marries dawn palette". These match design/msc-redesign/.../styles.css :root.
    elev: '#221c17',
    elev2: '#2c2520',
    borderStrong: '#3a322b',
    accentDim: '#8a4a32',
    success: '#6fb777',
    info: '#7dabd9',
    warn: '#d9a04a',
    danger: '#d97757',
    pink: '#ffaecf',
  },
  terminal: {
    name: 'Terminal',
    bg: '#08090d',
    fg: '#d4d4d8',
    fgMuted: '#6b7280',
    fgDim: '#3f4651',
    accent: '#a3e635',
    accent2: '#7dd3fc',
    surface: '#0a0c11',
    surfaceSolid: '#0d0f15',
    borderColor: '#1f2430',
    radius: 4,
    fontMono: MONO_FAMILY,
    code: {
      kw: '#7dd3fc', fn: '#a3e635', st: '#fbbf77', nm: '#fcd34d',
      cm: '#525866', ty: '#86efac', op: '#9ca3af',
      pn: '#6b7280', pa: '#f0a3c0', id: '#d4d4d8', sp: '#d4d4d8',
    },
    statusFg: '#d4d4d8',
    elev: '#11141a',
    elev2: '#1a1e26',
    borderStrong: '#2b3242',
    accentDim: '#5a8a1a',
    success: '#a3e635',
    info: '#7dd3fc',
    warn: '#fcd34d',
    danger: '#ef4444',
    pink: '#f0a3c0',
    sharp: true,
  },
  paper: {
    name: 'Paper',
    bg: '#f6f3ec',
    fg: '#1a1612',
    fgMuted: '#a8a095',
    fgDim: '#cdc4b6',
    accent: '#c96442',
    accent2: '#9b3d2e',
    surface: '#fbf8f1',
    surfaceSolid: '#fbf8f1',
    borderColor: '#e6dfd0',
    radius: 6,
    fontMono: MONO_FAMILY,
    code: {
      kw: '#9b3d2e', fn: '#5a4a2a', st: '#7a6a3a', nm: '#b67d3a',
      cm: '#a8a095', ty: '#5a6a4a', op: '#5a4a3a',
      pn: '#b8aea0', pa: '#7a4a2a', id: '#3a3530', sp: '#3a3530',
    },
    statusFg: '#1a1612',
    elev: '#fbf8f1',
    elev2: '#f0ebde',
    borderStrong: '#d6cdb8',
    accentDim: '#9b5532',
    success: '#3f7a3f',
    info: '#4a73a3',
    warn: '#a37a30',
    danger: '#9b3d2e',
    pink: '#c96442',
    light: true,
  },
  basic: {
    name: 'Basic',
    bg: '#fff',
    fg: '#24292f',
    fgMuted: '#57606a',
    fgDim: '#8c959f',
    accent: '#0969da',
    accent2: '#1a7f37',
    surface: '#f6f8fa',
    surfaceSolid: '#f6f8fa',
    borderColor: '#d0d7de',
    radius: 6,
    fontMono: MONO_FAMILY,
    code: {
      kw: '#0550ae', fn: '#5d3eb2', st: '#0a7d4a', nm: '#b35b00',
      cm: '#6a737d', ty: '#0a7d4a', op: '#24292f',
      pn: '#6a737d', pa: '#953800', id: '#24292f', sp: '#24292f',
    },
    statusFg: '#000',
    elev: '#f6f8fa',
    elev2: '#eef0f3',
    borderStrong: '#afb8c1',
    accentDim: '#054f9c',
    success: '#1a7f37',
    info: '#0969da',
    warn: '#9a6700',
    danger: '#cf222e',
    pink: '#bf3989',
    light: true,
  },
};

export const DEFAULT_THEME_ID: ThemeId = 'glass';
export const DEFAULT_THEME = THEMES[DEFAULT_THEME_ID];

const THEME_KEY = 'ui_theme_id';

type ThemeContextValue = {
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      if (cancelled) return;
      if (stored && stored in THEMES) setThemeIdState(stored as ThemeId);
    });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: THEMES[themeId],
    themeId,
    setThemeId: (id) => {
      setThemeIdState(id);
      SecureStore.setItemAsync(THEME_KEY, id).catch(() => {});
    },
  }), [themeId]);

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeId(): ThemeId {
  return useContext(ThemeContext).themeId;
}

export function useSetThemeId(): (id: ThemeId) => void {
  return useContext(ThemeContext).setThemeId;
}

// Static export retained as a fallback for code that runs at module-load time
// (e.g. StyleSheet.create at the top of a file). These styles will not react to
// runtime theme changes — migrate hot paths to useTheme() inside the component.
export const theme = DEFAULT_THEME;
