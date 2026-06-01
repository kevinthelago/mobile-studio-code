import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, useTheme } from '../../theme';
import { hexAlpha } from '../../lib/color';
import { PLAN_PEOPLE, PersonId, PlanLabel, labelOf } from './planData';

// Dark ink used for text/icons sitting on the accent fill (matches the
// design's `#1a120a` and the Btn primary foreground).
export const DARK_ON_ACCENT = '#1a120a';

/** A single round person avatar (mono initial on the person's hue). */
export function PersonAvatar({
  id, size = 20, border,
}: { id: PersonId; size?: number; border?: string }) {
  const t = useTheme();
  const p = PLAN_PEOPLE[id];
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: p.color,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: border ? 1.5 : 0,
        borderColor: border,
      }}
    >
      <Text style={{
        color: DARK_ON_ACCENT, fontFamily: t.fontMono, fontWeight: '700',
        fontSize: size * 0.5,
      }}>
        {p.initial}
      </Text>
    </View>
  );
}

/** Overlapping stack of person avatars (the design's -7px overlap). */
export function AvatarStack({
  who, size = 20, border,
}: { who: PersonId[]; size?: number; border?: string }) {
  const t = useTheme();
  return (
    <View style={styles.stack}>
      {who.map((w, i) => (
        <View key={w} style={{ marginLeft: i === 0 ? 0 : -7 }}>
          <PersonAvatar id={w} size={size} border={border ?? t.surfaceSolid} />
        </View>
      ))}
    </View>
  );
}

/** Pill label tinted with the label's hue (port of the inline `.msc-tag`s). */
export function LabelChip({ id, fontSize = 9 }: { id: string; fontSize?: number }) {
  const t = useTheme();
  const L: PlanLabel = labelOf(id);
  return (
    <View style={[styles.labelChip, {
      backgroundColor: hexAlpha(L.c, 0.16),
      borderColor: hexAlpha(L.c, 0.30),
    }]}>
      <View style={[styles.labelDot, { backgroundColor: L.c }]} />
      <Text style={{ color: L.c, fontFamily: t.fontMono, fontSize }}>{L.t}</Text>
    </View>
  );
}

/** Thin progress bar. `tone` picks the fill color token. */
export function ProgressBar({
  value, tone = 'accent', height = 4,
}: { value: number; tone?: 'accent' | 'success'; height?: number }) {
  const t = useTheme();
  const fill = tone === 'success' ? t.success : t.accent;
  return (
    <View style={[styles.track, { backgroundColor: t.elev2, height, borderRadius: height / 2 }]}>
      <View style={{
        width: `${Math.max(0, Math.min(1, value)) * 100}%`,
        height: '100%', backgroundColor: fill,
      }} />
    </View>
  );
}

/** The little gradient "C" badge that marks Claude-authored surfaces. */
export function ClaudeBadge({ size = 16, radius = 4 }: { size?: number; radius?: number }) {
  const t = useTheme();
  return (
    <LinearGradient
      colors={[t.accent, '#b8703f']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: DARK_ON_ACCENT, fontFamily: t.fontMono, fontWeight: '700', fontSize: size * 0.55 }}>
        C
      </Text>
    </LinearGradient>
  );
}

/** Status dot colored by the design's running/idle/warn/err convention. */
export function StatusDot({
  state, size = 7,
}: { state: 'running' | 'idle' | 'warn' | 'err'; size?: number }) {
  const t = useTheme();
  const color =
    state === 'warn' ? t.warn :
    state === 'err' ? t.danger :
    state === 'idle' ? t.fgDim :
    t.success;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function tokenColor(t: Theme, key: string): string {
  return (t as unknown as Record<string, string>)[key] ?? t.fgMuted;
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row' },
  labelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 99, borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  labelDot: { width: 5, height: 5, borderRadius: 2.5 },
  track: { width: '100%', overflow: 'hidden' },
});
