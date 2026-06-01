import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { hexAlpha } from '../../lib/color';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { PLAN_COLUMNS, PLAN_DOING, PLAN_PROJECTS, PlanCard } from './planData';
import { AvatarStack, LabelChip, tokenColor } from './planShared';
import { PlanNav, TAB_BAR_HEIGHT } from './nav';

function IssueCard({ c, nav, projectId }: { c: PlanCard; nav: PlanNav; projectId: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => nav.toIssue(projectId, c.n)}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Card
        style={styles.card}
        background={c.focused ? hexAlpha(t.accent, 0.08) : t.surface}
        borderColor={c.focused ? t.accentDim : t.borderColor}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.num, { color: t.fgDim, fontFamily: t.fontMono }]}>#{c.n}</Text>
          {c.m && <Text style={[styles.mile, { color: t.accent, fontFamily: t.fontMono }]}>{c.m}</Text>}
          <View style={styles.flex1} />
          {c.pr && (
            <View style={[styles.prTag, { backgroundColor: hexAlpha(t.info, 0.12), borderColor: hexAlpha(t.info, 0.30) }]}>
              <Text style={{ color: t.info, fontFamily: t.fontMono, fontSize: 9 }}>⊕ {c.pr}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: t.fg }]}>{c.t}</Text>

        {c.labels.length > 0 && (
          <View style={styles.labels}>
            {c.labels.map((l) => <LabelChip key={l} id={l} />)}
          </View>
        )}

        <View style={styles.footer}>
          <AvatarStack who={c.who} />
          <View style={styles.flex1} />
          {c.ai > 0 && (
            <Text style={[styles.metaMono, { color: t.accent, fontFamily: t.fontMono }]}>✦ {c.ai}</Text>
          )}
          {c.comments > 0 && (
            <Text style={[styles.metaMono, { color: t.fgDim, fontFamily: t.fontMono }]}>💬 {c.comments}</Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export function PlanBoard({ nav, projectId }: { nav: PlanNav; projectId: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const project = PLAN_PROJECTS.find((p) => p.id === projectId);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <PageHeader
        crumbs={[
          <Text key="back" onPress={nav.toProjects} style={{ color: t.accent }}>plan</Text>,
          projectId,
        ]}
        title={project?.name ?? 'Board'}
        meta={
          <>
            {project?.iteration ?? 'Iter'} · <Text style={{ color: t.accent }}>{project?.open ?? 0} open</Text>
          </>
        }
        right={
          <View style={[styles.syncTag, { backgroundColor: hexAlpha(t.success, 0.12), borderColor: hexAlpha(t.success, 0.30) }]}>
            <View style={[styles.dot, { backgroundColor: t.success }]} />
            <Text style={{ color: t.success, fontFamily: t.fontMono, fontSize: 9.5 }}>⎇ sync</Text>
          </View>
        }
      />

      {/* Column pager */}
      <View style={[styles.pager, { backgroundColor: t.bg, borderBottomColor: t.borderColor }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pagerContent}>
          {PLAN_COLUMNS.map((col) => (
            <View
              key={col.k}
              style={[styles.colChip, {
                backgroundColor: col.on ? hexAlpha(t.accent, 0.16) : t.elev,
                borderColor: col.on ? t.accentDim : t.borderColor,
              }]}
            >
              <View style={[styles.colDot, { backgroundColor: tokenColor(t, col.c) }]} />
              <Text style={{ color: col.on ? t.accent : t.fgMuted, fontFamily: t.fontMono, fontSize: 10.5 }}>
                {col.t} <Text style={{ color: t.fgDim }}>{col.n}</Text>
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ backgroundColor: t.bg }}
        contentContainerStyle={{ padding: 12, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>
            IN PROGRESS · {PLAN_DOING.length}
          </Text>
          <View style={styles.flex1} />
          <Text style={[styles.swipeHint, { color: t.fgDim, fontFamily: t.fontMono }]}>← swipe columns →</Text>
        </View>

        <View style={styles.list}>
          {PLAN_DOING.map((c) => <IssueCard key={c.n} c={c} nav={nav} projectId={projectId} />)}
          <View style={[styles.newCard, { borderColor: t.borderStrong }]}>
            <Text style={[styles.newCardText, { color: t.fgDim, fontFamily: t.fontMono }]}>+ new card</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },

  syncTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  pager: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  pagerContent: { gap: 6, alignItems: 'center' },
  colChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
  },
  colDot: { width: 6, height: 6, borderRadius: 3 },

  sectionRow: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 4, paddingBottom: 8 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.8 },
  swipeHint: { fontSize: 10 },

  list: { gap: 8 },
  card: { padding: 12, borderRadius: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  num: { fontSize: 10 },
  mile: { fontSize: 9.5 },
  prTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaMono: { fontSize: 10 },

  newCard: {
    marginTop: 2, paddingVertical: 10, borderRadius: 6,
    borderWidth: 1, borderStyle: 'dashed', alignItems: 'center',
  },
  newCardText: { fontSize: 10.5 },
});
