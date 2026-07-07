import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { selectSkills, groupSkillNames } from '../../lib/pages/skillsPage';

/**
 * Skills library mirror (#221) — read-only cards for the desktop's `skills` domain: each skill's
 * name/kind/scope with pinned + enabled badges, the task groups, and the active project's pending
 * lessons. No analytics, no CRUD.
 */
export function SkillsLibrary({ data }: { data: unknown }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const model = useMemo(() => selectSkills(data), [data]);

  if (!model) {
    return (
      <View style={styles.fallback}>
        <Text style={[styles.fallbackText, { color: t.fgMuted }]}>Couldn’t read the desktop’s Skills projection.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.inner, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: t.fgDim }]}>LIBRARY · {model.skills.length}</Text>
      {model.skills.length === 0 ? (
        <Text style={[styles.empty, { color: t.fgMuted }]}>No skills in the library yet.</Text>
      ) : (
        model.skills.map((s) => (
          <Surface key={s.id} style={styles.card} radius={8}>
            <View style={styles.cardTop}>
              <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{s.name}</Text>
              <View style={styles.badges}>
                {s.pinned ? <Tag color={t.accent} bg={`${t.accent}22`} border={false}>Pinned</Tag> : null}
                <Tag color={s.enabled ? t.fg : t.fgDim} bg={t.surface} border={false}>{s.enabled ? 'On' : 'Off'}</Tag>
              </View>
            </View>
            {s.desc ? <Text style={[styles.desc, { color: t.fgMuted }]} numberOfLines={3}>{s.desc}</Text> : null}
            <View style={styles.meta}>
              {s.kind ? <Tag border={false} bg={t.surface}>{s.kind}</Tag> : null}
              {s.source ? <Tag border={false} bg={t.surface}>{s.source}</Tag> : null}
              {s.packaged ? <Tag border={false} bg={t.surface}>packaged</Tag> : null}
              {s.projects.length ? <Text style={[styles.scope, { color: t.fgDim }]}>{s.projects.length} project{s.projects.length === 1 ? '' : 's'}</Text> : null}
            </View>
          </Surface>
        ))
      )}

      {model.groups.length > 0 && (
        <>
          <Text style={[styles.heading, { color: t.fgDim }]}>GROUPS · {model.groups.length}</Text>
          {model.groups.map((g) => (
            <Surface key={g.id} style={styles.card} radius={8}>
              <Text style={[styles.name, { color: t.fg }]}>⬡ {g.name}</Text>
              <Text style={[styles.desc, { color: t.fgMuted }]} numberOfLines={2}>
                {groupSkillNames(g, model.skills).join(' · ') || 'No members'}
              </Text>
            </Surface>
          ))}
        </>
      )}

      {model.lessons && model.lessons.pending.length > 0 && (
        <>
          <Text style={[styles.heading, { color: t.fgDim }]}>PENDING LESSONS · {model.lessons.project}</Text>
          {model.lessons.pending.map((l) => (
            <Surface key={l.id} style={styles.card} radius={8}>
              <Text style={[styles.name, { color: t.fg }]} numberOfLines={2}>{l.rule || l.mistake}</Text>
              {l.mistake && l.rule ? <Text style={[styles.desc, { color: t.fgMuted }]} numberOfLines={2}>{l.mistake}</Text> : null}
              {l.seen > 1 ? <Text style={[styles.scope, { color: t.fgDim }]}>seen {l.seen}×</Text> : null}
            </Surface>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { paddingHorizontal: 14, paddingTop: 12, gap: 8 },
  heading: { fontSize: 10.5, letterSpacing: 1.1, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  empty: { fontSize: 12.5, paddingVertical: 6 },
  card: { padding: 12, gap: 7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 6 },
  desc: { fontSize: 12, lineHeight: 17 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  scope: { fontSize: 11 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
