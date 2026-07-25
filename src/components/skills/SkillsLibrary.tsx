import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { SpecHost } from '../kit/SpecHost';
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
        // Each card is the `mobile.skillItem` GeneralNode spec, fed this skill's data through binds —
        // the host iterates the mirrored list, the design system renders each item.
        model.skills.map((s) => (
          <SpecHost
            key={s.id}
            id="mobile.skillItem"
            values={{
              name: s.name,
              status: s.enabled ? 'On' : 'Off',
              desc: s.desc || '',
              kind: s.kind || '',
              source: s.source || '',
              scope: s.projects.length ? `${s.projects.length} project${s.projects.length === 1 ? '' : 's'}` : '',
            }}
          />
        ))
      )}

      {model.groups.length > 0 && (
        <>
          <Text style={[styles.heading, { color: t.fgDim }]}>GROUPS · {model.groups.length}</Text>
          {model.groups.map((g) => (
            <SpecHost
              key={g.id}
              id="mobile.skillGroup"
              values={{
                name: `⬡ ${g.name}`,
                members: groupSkillNames(g, model.skills).join(' · ') || 'No members',
              }}
            />
          ))}
        </>
      )}

      {model.lessons && model.lessons.pending.length > 0 && (
        <>
          <Text style={[styles.heading, { color: t.fgDim }]}>PENDING LESSONS · {model.lessons.project}</Text>
          {model.lessons.pending.map((l) => (
            <SpecHost
              key={l.id}
              id="mobile.lessonItem"
              values={{
                title: l.rule || l.mistake,
                sub: l.mistake && l.rule ? l.mistake : '',
                seen: l.seen > 1 ? `seen ${l.seen}×` : '',
              }}
            />
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
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
