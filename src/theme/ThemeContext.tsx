import React, { createContext, useContext, useState } from 'react';
import { Theme, THEMES, DEFAULT_THEME } from './tokens';

interface ThemeContextValue {
  theme: Theme;
  setThemeName: (name: string) => void;
  themeNames: string[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setThemeName: () => {},
  themeNames: Object.keys(THEMES),
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState('glass');
  const theme = THEMES[themeName] ?? DEFAULT_THEME;

  return (
    <ThemeContext.Provider value={{ theme, setThemeName, themeNames: Object.keys(THEMES) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
