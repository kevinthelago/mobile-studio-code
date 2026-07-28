import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEMES, useTheme } from '../../theme';
import { Tag } from '../ui/Tag';
import { groupThemes, selectThemes, type ThemeVM } from '../../lib/pages/designPage';

/**
 * Themes mirror (#221) — read-only list of the desktop's `themes` domain, the active theme
 * highlighted. Grouped by design group (`tech`, #2749) and each card previewed on its OWN `base`
 * surface (#2545), because light/dark is theme data: rendering every card on the app's surface made
 * a light theme indistinguishable from a dark one (#242). No editing.
 */
export function ThemesMirror({ data }: { data: unknown }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const model = useMemo(() => selectThemes(data), [data]);
  const groups = useMemo(() => (model ? groupThemes(model) : []), [model]);

  if (!model) {
    return (
      <View style={styles.fallback}>
        <Text style={[styles.fallbackText, { color: t.fgMuted }]}>Couldn’t read the desktop’s Themes projection.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.inner, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {groups.map((g) => (
        <View key={g.tech} style={styles.group}>
          <Text style={[styles.groupHead, { color: t.fgDim }]}>{g.label.toUpperCase()}</Text>
          {g.themes.map((th) => (
            <ThemeCard key={th.id} theme={th} accent={t.accent} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * One theme card, painted with the palette of the surface the theme declares. Deliberately does NOT
 * use `Surface`/`useTheme` colours for its body: the point is to show the theme's own light/dark
 * surface, not the app's.
 */
function ThemeCard({ theme: th, accent }: { theme: ThemeVM; accent: string }) {
  const p = THEMES[th.base];
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.surfaceSolid, borderColor: th.active ? accent : p.borderColor },
        th.active && styles.cardActive,
      ]}
    >
      <View style={styles.head}>
        <Text style={[styles.name, { color: p.fg }]} numberOfLines={1}>{th.label}</Text>
        {th.active ? <Tag color={accent} bg={`${accent}22`} border={false}>Active</Tag> : null}
        {th.builtin ? <Tag color={p.fgMuted} bg={p.bg} border={false}>built-in</Tag> : null}
      </View>
      {th.description ? (
        <Text style={[styles.desc, { color: p.fgMuted }]} numberOfLines={2}>{th.description}</Text>
      ) : null}
      <Text style={[styles.meta, { color: p.fgMuted }]}>
        {th.base}
        {th.varCount ? ` · ${th.varCount} token override${th.varCount === 1 ? '' : 's'}` : ' · base look'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { paddingHorizontal: 14, paddingTop: 12, gap: 16 },
  group: { gap: 10 },
  groupHead: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.1 },
  card: { padding: 12, gap: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  cardActive: { borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700' },
  desc: { fontSize: 12, lineHeight: 17 },
  meta: { fontSize: 11 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
