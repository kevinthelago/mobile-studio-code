import {
  createContext, useContext, useEffect, useMemo, useState, createElement,
  type ReactElement, type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';

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
  font: string;
  fontMono: string;
  code: CodePalette;
  statusFg: string;
  glass?: boolean;
  orbs?: boolean;
  sharp?: boolean;
  light?: boolean;
}

export type ThemeId = 'dark' | 'light';

export const THEMES: Record<ThemeId, Theme> = {
  dark: {
    name: 'Dark',
    bg: '#0d0d0d',
    fg: '#e5e5e5',
    fgMuted: '#737373',
    fgDim: '#404040',
    accent: '#f59e0b',
    accent2: '#f59e0b',
    surface: '#171717',
    surfaceSolid: '#171717',
    borderColor: '#262626',
    radius: 6,
    font: 'Inter_400Regular',
    fontMono: 'JetBrainsMono_400Regular',
    code: {
      kw: '#c084fc', fn: '#60a5fa', st: '#86efac', nm: '#fcd34d',
      cm: '#52525b', ty: '#34d399', op: '#a1a1aa',
      pn: '#52525b', pa: '#fb923c', id: '#e5e5e5', sp: '#e5e5e5',
    },
    statusFg: '#e5e5e5',
  },
  light: {
    name: 'Light',
    bg: '#ffffff',
    fg: '#171717',
    fgMuted: '#737373',
    fgDim: '#a3a3a3',
    accent: '#d97706',
    accent2: '#d97706',
    surface: '#f5f5f5',
    surfaceSolid: '#f5f5f5',
    borderColor: '#e5e5e5',
    radius: 6,
    font: 'Inter_400Regular',
    fontMono: 'JetBrainsMono_400Regular',
    code: {
      kw: '#7c3aed', fn: '#1d4ed8', st: '#15803d', nm: '#92400e',
      cm: '#6b7280', ty: '#0f766e', op: '#374151',
      pn: '#9ca3af', pa: '#b45309', id: '#171717', sp: '#171717',
    },
    statusFg: '#171717',
    light: true,
  },
};

export const DEFAULT_THEME_ID: ThemeId = 'dark';
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
