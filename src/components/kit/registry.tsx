// The React Native primitive registry — `PrimitiveName → RN component`, the swappable half of the
// KitRenderer (the vendored `generalNode` + `manifest` are the fixed contract; this is the native
// implementation of it). Each component consumes the SAME semantic props base-studio-code's web
// primitives do (`variant`/`tone`/`gap`/`pad`), resolving tokens to concrete values via resolve.ts.
// Web prop NAMES are the contract, so a handler arrives as `onClick` even though RN fires `onPress` —
// each component adapts internally.
//
// This is intentionally a SUBSET. Adding a primitive is: implement it here + add a `componentFor`
// row. Un-registered primitives render a visible marker (KitRenderer), never a crash. Charts, Code,
// and GraphCanvas stay native-coded outside this renderer (see memory: project_design_system_port).
import React from 'react';
import {
  View, Text as RNText, Pressable, TextInput, StyleSheet,
  type ViewStyle, type TextStyle,
} from 'react-native';
import { useTheme, type Theme } from '../../theme';
import { space, pad, align, justify, radius, color, token } from '../../lib/kit/resolve';
import { REGISTRY_PRIMITIVES, IMPLEMENTED_PRIMITIVES } from '../../lib/kit/implemented';

type Props = Record<string, unknown>;
const asNode = (v: unknown) => v as React.ReactNode;

// fontSize rungs (--fs-*): a rung name or a raw px number.
const FONT: Record<string, number> = { xxs: 10, xs: 11, sm: 12.5, md: 14, lg: 16, xl: 20 };
const fontSize = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : typeof v === 'string' && v in FONT ? FONT[v] : undefined;

// ── layout ───────────────────────────────────────────────────────────────────
function Box({ children, pad: p, bg, border, radius: r, style, ...rest }: Props) {
  const t = useTheme();
  const s: ViewStyle = { ...pad(p) };
  if (bg != null) s.backgroundColor = color(bg, t);
  if (border != null) {
    s.borderWidth = StyleSheet.hairlineWidth;
    s.borderColor = border === 'true' ? t.borderColor
      : border === 'soft' ? t.borderColor : color(border, t) ?? t.borderColor;
  }
  const rad = radius(r);
  if (rad != null) s.borderRadius = rad;
  return <View style={[s, style as ViewStyle]} {...(rest as object)}>{asNode(children)}</View>;
}

function flexBox(dir: 'row' | 'column', defaultAlign: string) {
  return function Flex({ children, gap, align: a, justify: j, wrap, pad: p, style }: Props) {
    const s: ViewStyle = { flexDirection: dir, ...pad(p) };
    const g = space(gap); if (g != null) s.gap = g;
    s.alignItems = align(a ?? defaultAlign);
    const jv = justify(j); if (jv) s.justifyContent = jv;
    if (wrap) s.flexWrap = 'wrap';
    return <View style={[s, style as ViewStyle]}>{asNode(children)}</View>;
  };
}
const Stack = flexBox('column', 'stretch');
const Row = flexBox('row', 'center');

function Spacer({ size }: Props) {
  const n = space(size);
  return <View style={n == null ? { flex: 1 } : { width: n, height: n }} />;
}

// ── typography ─────────────────────────────────────────────────────────────
function Text({ children, size, tone, mono, weight, style }: Props) {
  const t = useTheme();
  const s: TextStyle = { fontFamily: mono ? t.fontMono : t.font };
  const fs = fontSize(size); if (fs != null) s.fontSize = fs;
  const c = tone != null ? color(tone, t) : t.fg; if (c) s.color = c;
  if (weight != null) s.fontWeight = String(weight) as TextStyle['fontWeight'];
  return <RNText style={[s, style as TextStyle]}>{asNode(children)}</RNText>;
}

// ── data ─────────────────────────────────────────────────────────────────────
function Card({ children, title, header, right, tone, pad: p, onClick, style }: Props) {
  const t = useTheme();
  const s: ViewStyle = {
    backgroundColor: token('--card-bg', t) as string,
    borderColor: tone != null ? color(tone, t) ?? (token('--card-border', t) as string) : (token('--card-border', t) as string),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: token('--card-radius', t) as number ?? 10,
    padding: p === 'sm' ? 10 : 16,
    gap: 10,
  };
  const head = header != null ? asNode(header)
    : title != null ? (
      <View style={styles.headRow}>
        <RNText style={{ color: t.fg, fontSize: 14, fontWeight: '600', fontFamily: t.font }}>{asNode(title)}</RNText>
        {right != null ? asNode(right) : null}
      </View>
    ) : null;
  const body = <>{head}{asNode(children)}</>;
  if (onClick) {
    return <Pressable onPress={onClick as () => void} style={[s, style as ViewStyle]}>{body}</Pressable>;
  }
  return <View style={[s, style as ViewStyle]}>{body}</View>;
}

function Chip({ children, tone, color: custom, dot, size }: Props) {
  const t = useTheme();
  const fg = custom != null ? color(custom, t) : tone != null && tone !== 'neutral' ? color(tone, t) : (token('--chip-fg', t) as string);
  const fs = size === 'xs' ? 10 : size === 'md' ? 12.5 : 11;
  return (
    <View style={[styles.chip, { backgroundColor: token('--chip-bg', t) as string, borderColor: token('--chip-border', t) as string }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: fg ?? t.fgMuted }]} /> : null}
      <RNText style={{ color: fg ?? t.fgMuted, fontSize: fs, fontFamily: t.fontMono }}>{asNode(children)}</RNText>
    </View>
  );
}

function CardListRow({ title, subtitle, lead, trailing, onClick, variant, selected, off, accent }: Props) {
  const t = useTheme();
  const grouped = variant === 'grouped';
  const acc = accent != null ? color(accent, t) ?? t.accent : t.accent;
  const row = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 14, paddingHorizontal: 14, opacity: off ? 0.5 : 1,
      backgroundColor: grouped ? 'transparent' : (token('--card-bg', t) as string),
      borderRadius: grouped ? 0 : 8,
      borderWidth: grouped ? 0 : StyleSheet.hairlineWidth,
      borderColor: token('--card-border', t) as string,
      borderLeftWidth: selected ? 2 : (grouped ? 0 : StyleSheet.hairlineWidth),
      borderLeftColor: selected ? acc : (token('--card-border', t) as string),
    }}>
      {lead != null ? <View style={{ width: 18, alignItems: 'center' }}>{asNode(lead)}</View> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <RNText style={{ color: t.fg, fontSize: 14.5, fontWeight: '600', fontFamily: t.font }}>{asNode(title)}</RNText>
        {subtitle != null ? (
          <RNText numberOfLines={1} style={{ color: t.fgMuted, fontSize: 12, fontFamily: t.font }}>{asNode(subtitle)}</RNText>
        ) : null}
      </View>
      {trailing != null ? asNode(trailing) : onClick ? <RNText style={{ color: t.fgMuted, fontSize: 16 }}>{'›'}</RNText> : null}
    </View>
  );
  if (onClick) {
    return <Pressable onPress={onClick as () => void} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>{row}</Pressable>;
  }
  return row;
}

function StatTile({ k, v, sub, tone }: Props) {
  const t = useTheme();
  const valColor = tone != null ? color(tone, t) ?? t.fg : t.fg;
  return (
    <View style={{ gap: 2 }}>
      <RNText style={{ color: t.fgMuted, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: t.fontMono }}>{asNode(k)}</RNText>
      <RNText style={{ color: valColor, fontSize: 18, fontWeight: '600', fontFamily: t.font }}>{asNode(v)}</RNText>
      {sub != null ? <RNText style={{ color: t.fgDim, fontSize: 11, fontFamily: t.font }}>{asNode(sub)}</RNText> : null}
    </View>
  );
}

// ── feedback ─────────────────────────────────────────────────────────────────
function EmptyState({ title, description, icon, actions, variant, align: a }: Props) {
  const t = useTheme();
  const centered = (a ?? 'center') === 'center';
  const cross = centered ? 'center' : 'flex-start';
  const inner = (
    <View style={{ alignItems: cross, gap: 8 }}>
      {icon != null ? <View style={{ marginBottom: 4 }}>{asNode(icon)}</View> : null}
      <RNText style={{ color: t.fg, fontSize: 15, fontWeight: '600', fontFamily: t.font, textAlign: centered ? 'center' : 'left' }}>{asNode(title)}</RNText>
      {description != null ? (
        <RNText style={{ color: t.fgMuted, fontSize: 12.5, lineHeight: 18, textAlign: centered ? 'center' : 'left', fontFamily: t.font }}>{asNode(description)}</RNText>
      ) : null}
      {actions != null ? <View style={{ marginTop: 8, flexDirection: 'row', gap: 8, justifyContent: cross }}>{asNode(actions)}</View> : null}
    </View>
  );
  if (variant === 'card') {
    return (
      <View style={{
        alignSelf: 'stretch', backgroundColor: token('--card-bg', t) as string,
        borderColor: token('--card-border', t) as string, borderWidth: StyleSheet.hairlineWidth,
        borderRadius: (token('--card-radius', t) as number) ?? 10, paddingVertical: 28, paddingHorizontal: 22,
      }}>{inner}</View>
    );
  }
  return inner;
}

const STATUS_COLORS: Record<string, string> = { run: '#4fd6a0', wait: '#f2b155', idle: '#737373', stopped: '#f87171' };
function StatusDot({ state, color: custom, size, style }: Props) {
  const t = useTheme();
  const c = custom != null ? color(custom, t) : typeof state === 'string' ? STATUS_COLORS[state] : undefined;
  const d = typeof size === 'number' ? size : 6;
  return <View style={[{ width: d, height: d, borderRadius: d / 2, backgroundColor: c ?? t.fgMuted }, style as ViewStyle]} />;
}

const BANNER_TONES = (t: Theme): Record<string, string> => ({
  neutral: t.fgMuted, info: '#5b9dff', success: '#4fd6a0', warn: '#f2b155', danger: '#f87171', accent: t.accent,
});
function Banner({ children, tone, variant, lead, dot, right }: Props) {
  const t = useTheme();
  const c = BANNER_TONES(t)[(tone as string) ?? 'neutral'] ?? t.fgMuted;
  const bar = variant === 'bar';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: bar ? 10 : 6, paddingHorizontal: 12, borderRadius: bar ? 8 : 12,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c, backgroundColor: t.surface,
      alignSelf: bar ? 'stretch' : 'flex-start',
    }}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} /> : null}
      {lead != null ? asNode(lead) : null}
      <RNText style={{ color: c, fontSize: 12.5, flexShrink: 1, fontFamily: t.font }}>{asNode(children)}</RNText>
      {right != null ? asNode(right) : null}
    </View>
  );
}

function SectionHeader({ title, hint, meta, right }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <RNText style={{ color: t.fg, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600', fontFamily: t.fontMono }}>{asNode(title)}</RNText>
      {hint != null ? <RNText style={{ color: t.fgDim, fontSize: 11, fontFamily: t.font }}>{asNode(hint)}</RNText> : null}
      <View style={{ flex: 1 }} />
      {right != null ? asNode(right) : meta != null ? <RNText style={{ color: t.fgDim, fontSize: 11, fontFamily: t.fontMono }}>{asNode(meta)}</RNText> : null}
    </View>
  );
}

// ── controls ─────────────────────────────────────────────────────────────────
function Button({ children, variant, size, danger, onClick, disabled }: Props) {
  const t = useTheme();
  const primary = variant === 'primary';
  const ghost = variant === 'ghost';
  const bg = primary ? (token('--btn-primary-bg', t) as string) : ghost ? 'transparent' : (token('--btn-bg', t) as string);
  const fg = danger ? (token('--danger', t) as string) : primary ? (token('--btn-primary-fg', t) as string) : (token('--btn-fg', t) as string);
  const height = size === 'sm' ? 24 : 28;
  return (
    <Pressable
      onPress={onClick as () => void}
      disabled={disabled as boolean}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, height, opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          borderWidth: ghost || primary ? 0 : StyleSheet.hairlineWidth, borderColor: t.borderColor },
      ]}
    >
      <RNText style={{ color: fg, fontSize: size === 'sm' ? 10.5 : 11, fontWeight: primary ? '600' : '400', fontFamily: t.fontMono }}>
        {asNode(children)}
      </RNText>
    </Pressable>
  );
}

function Toggle({ on, onClick, size, tone }: Props) {
  const t = useTheme();
  const d = size === 'sm' ? { w: 34, h: 20, k: 14 } : size === 'xs' ? { w: 28, h: 16, k: 11 } : { w: 40, h: 24, k: 18 };
  const onColor = tone === 'success' ? '#4fd6a0' : t.accent;
  const isOn = !!on;
  return (
    <Pressable
      onPress={onClick as () => void}
      accessibilityRole="switch"
      accessibilityState={{ checked: isOn }}
      style={{
        width: d.w, height: d.h, borderRadius: d.h / 2, justifyContent: 'center', paddingHorizontal: 2,
        backgroundColor: isOn ? onColor : t.surfaceSolid,
        borderWidth: StyleSheet.hairlineWidth, borderColor: isOn ? onColor : t.borderColor,
      }}
    >
      <View style={{ width: d.k, height: d.k, borderRadius: d.k / 2, backgroundColor: isOn ? '#fff' : t.fgMuted, alignSelf: isOn ? 'flex-end' : 'flex-start' }} />
    </Pressable>
  );
}

function TextField({ value, onChange, label, hint, trailing, ...rest }: Props) {
  const t = useTheme();
  const r = rest as Record<string, unknown>;
  return (
    <View style={{ gap: 6 }}>
      {(label != null || trailing != null) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {label != null ? <RNText style={{ color: t.fgMuted, fontSize: 12, fontFamily: t.font }}>{asNode(label)}</RNText> : null}
          {hint != null ? <RNText style={{ color: t.fgDim, fontSize: 11, fontFamily: t.font }}>{asNode(hint)}</RNText> : null}
          <View style={{ flex: 1 }} />
          {trailing != null ? asNode(trailing) : null}
        </View>
      ) : null}
      <TextInput
        value={typeof value === 'string' ? value : ''}
        onChangeText={onChange as (v: string) => void}
        secureTextEntry={r.type === 'password'}
        placeholder={typeof r.placeholder === 'string' ? r.placeholder : undefined}
        placeholderTextColor={t.fgDim}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          color: token('--field-fg', t) as string, backgroundColor: token('--field-bg', t) as string,
          borderColor: token('--field-border', t) as string, borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontFamily: t.font,
        }}
      />
    </View>
  );
}

interface SegOption { label?: string; on?: boolean; onClick?: () => void }
function SegmentedControl({ options, size, variant }: Props) {
  const t = useTheme();
  const opts: SegOption[] = Array.isArray(options) ? (options as SegOption[]) : [];
  const joined = variant === 'joined';
  const h = size === 'md' ? 30 : 26;
  return (
    <View style={{ flexDirection: 'row', gap: joined ? 0 : 6 }}>
      {opts.map((o, i) => (
        <Pressable
          key={i}
          onPress={o.onClick}
          style={{
            height: h, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center',
            borderRadius: joined ? 0 : 6,
            backgroundColor: o.on ? t.surface : 'transparent',
            borderWidth: StyleSheet.hairlineWidth, borderColor: o.on ? t.accent : t.borderColor,
          }}
        >
          <RNText style={{ color: o.on ? t.fg : t.fgMuted, fontSize: 12, fontFamily: t.fontMono }}>{o.label ?? ''}</RNText>
        </Pressable>
      ))}
    </View>
  );
}

function SectionLabel({ children, size, tone, right }: Props) {
  const t = useTheme();
  const c = tone === 'muted' ? t.fgMuted : t.fgDim;
  const label = (
    <RNText style={{ color: c, fontSize: size === 'sm' ? 9 : 10, letterSpacing: size === 'sm' ? 0.8 : 0.6, textTransform: 'uppercase', fontWeight: '600', fontFamily: t.fontMono }}>
      {asNode(children)}
    </RNText>
  );
  if (right != null) {
    return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{label}<View style={{ flex: 1 }} />{asNode(right)}</View>;
  }
  return label;
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start',
  },
});

const REGISTRY: Record<string, React.ComponentType<Props>> = {
  Box, Stack, Row, Spacer, Text, Card, Chip, StatTile, Button,
  EmptyState, StatusDot, Banner, SectionHeader, CardListRow,
  Toggle, TextField, SegmentedControl, SectionLabel,
};

// Guard: REGISTRY keys must match the node-safe REGISTRY_PRIMITIVES list (the test's source of truth;
// Slot is renderer-native and intentionally has no registry entry). A mismatch means a primitive was
// added to one and not the other — fail loud in dev.
if (__DEV__) {
  const keys = Object.keys(REGISTRY).sort().join(',');
  const names = [...REGISTRY_PRIMITIVES].sort().join(',');
  if (keys !== names) {
    console.warn(`[kit] registry keys (${keys}) drifted from REGISTRY_PRIMITIVES (${names})`);
  }
}

/** Resolve a primitive name to its native component, or undefined if not yet implemented. */
export function componentFor(name: string): React.ComponentType<Props> | undefined {
  return REGISTRY[name];
}

/** The primitive names this native kit currently implements (for coverage tests + diagnostics). */
export const IMPLEMENTED: readonly string[] = IMPLEMENTED_PRIMITIVES;

export type { Theme };
