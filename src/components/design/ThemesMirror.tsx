import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { selectThemes } from '../../lib/pages/designPage';

/**
 * Themes mirror (#221) — read-only list of the desktop's `themes` domain, the active theme
 * highlighted. Each theme shows its label/description + semantic-token count. No editing.
 */
export function ThemesMirror({ data }: { data: unknown }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const model = useMemo(() => selectThemes(data), [data]);

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
      {model.themes.map((th) => (
        <Surface
          key={th.id}
          style={[styles.card, th.active && { borderColor: t.accent, borderWidth: 1 }]}
          radius={8}
        >
          <View style={styles.head}>
            <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{th.label}</Text>
            {th.active ? <Tag color={t.accent} bg={`${t.accent}22`} border={false}>Active</Tag> : null}
            {th.builtin ? <Tag border={false} bg={t.surface}>built-in</Tag> : null}
          </View>
          {th.description ? <Text style={[styles.desc, { color: t.fgMuted }]} numberOfLines={2}>{th.description}</Text> : null}
          <Text style={[styles.meta, { color: t.fgDim }]}>
            {th.varCount ? `${th.varCount} token override${th.varCount === 1 ? '' : 's'}` : 'base look'}
          </Text>
        </Surface>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  card: { padding: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700' },
  desc: { fontSize: 12, lineHeight: 17 },
  meta: { fontSize: 11 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
