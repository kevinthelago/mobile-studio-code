export type CodePalette = {
  kw: string; fn: string; st: string; nm: string; cm: string;
  ty: string; op: string; pn: string; pa: string; id: string;
};

export type Theme = {
  name: string;
  bg: string;
  fg: string;
  fgMuted: string;
  fgDim: string;
  accent: string;
  accent2: string;
  surface: string;
  surfaceSolid: string;
  border: string;
  borderColor: string;
  radius: number;
  fontUI: string;
  fontMono: string;
  code: CodePalette;
  statusFg: string;
  glass?: boolean;
  orbs?: boolean;
  sharp?: boolean;
  light?: boolean;
};

export const THEMES: Record<string, Theme> = {
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
    border: '0.5px solid rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.10)',
    radius: 24,
    fontUI: 'System',
    fontMono: 'Menlo',
    code: { kw: '#c084fc', fn: '#67d3ff', st: '#f0a37e', nm: '#ffd479', cm: 'rgba(160,170,200,0.55)', ty: '#7ee2c4', op: '#cdd2e0', pn: 'rgba(220,225,240,0.5)', pa: '#ffaecf', id: '#e6e9f2' },
    statusFg: '#fff',
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
    border: '1px solid #2a241f',
    borderColor: '#2a241f',
    radius: 18,
    fontUI: 'System',
    fontMono: 'Menlo',
    code: { kw: '#e0a3ff', fn: '#9bd9ff', st: '#ffb088', nm: '#ffd479', cm: '#5a5550', ty: '#a8e6c4', op: '#a8a095', pn: '#6a655f', pa: '#ffaecf', id: '#e8e2d8' },
    statusFg: '#e8e2d8',
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
    border: '1px solid #1f2430',
    borderColor: '#1f2430',
    radius: 4,
    fontUI: 'Menlo',
    fontMono: 'Menlo',
    code: { kw: '#7dd3fc', fn: '#a3e635', st: '#fbbf77', nm: '#fcd34d', cm: '#525866', ty: '#86efac', op: '#9ca3af', pn: '#6b7280', pa: '#f0a3c0', id: '#d4d4d8' },
    statusFg: '#d4d4d8',
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
    border: '1px solid #e6dfd0',
    borderColor: '#e6dfd0',
    radius: 6,
    fontUI: 'Georgia',
    fontMono: 'Menlo',
    code: { kw: '#9b3d2e', fn: '#5a4a2a', st: '#7a6a3a', nm: '#b67d3a', cm: '#a8a095', ty: '#5a6a4a', op: '#5a4a3a', pn: '#b8aea0', pa: '#7a4a2a', id: '#3a3530' },
    statusFg: '#1a1612',
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
    border: '1px solid #d0d7de',
    borderColor: '#d0d7de',
    radius: 6,
    fontUI: 'System',
    fontMono: 'Menlo',
    code: { kw: '#0550ae', fn: '#5d3eb2', st: '#0a7d4a', nm: '#b35b00', cm: '#6a737d', ty: '#0a7d4a', op: '#24292f', pn: '#6a737d', pa: '#953800', id: '#24292f' },
    statusFg: '#000',
    light: true,
  },
};

export type ThemeId = keyof typeof THEMES;
