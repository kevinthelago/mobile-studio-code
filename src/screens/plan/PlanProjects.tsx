import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { hexAlpha } from '../../lib/color';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Card } from '../../components/ui/Card';
import { Tag } from '../../components/ui/Tag';
import { PLAN_PROJECTS, PlanProject } from './planData';
import { ClaudeBadge, ProgressBar, DARK_ON_ACCENT } from './planShared';
import { PlanNav, TAB_BAR_HEIGHT } from './nav';

function ProjectCard({ p, dim, nav }: { p: PlanProject; dim?: boolean; nav: PlanNav }) {
  const t = useTheme();
  const completion = p.total ? (p.total - p.open) / p.total : 0;

  return (
    <Pressable
      onPress={() => (p.planning ? nav.toScoping(p.id) : nav.toBoard(p.id))}
      style={({ pressed }) => ({ opacity: dim ? 0.62 : pressed ? 0.8 : 1 })}
    >
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={[styles.id, { color: t.fgDim, fontFamily: t.fontMono }]}>{p.id}</Text>
          {p.planning
            ? <Tag variant="amber">● drafting</Tag>
            : <Tag variant="green">● active</Tag>}
          <View style={styles.flex1} />
          <Text style={[styles.id, { color: t.fgDim, fontFamily: t.fontMono }]}>{p.last}</Text>
        </View>

        <Text style={[styles.name, { color: t.fg }]}>{p.name}</Text>
        <Text style={[styles.pitch, { color: t.fgMuted }]}>{p.pitch}</Text>

        {p.planning ? (
          <>
            <ProgressBar value={p.progress ?? 0} tone="accent" />
            <View style={styles.metaRow}>
              <Text style={[styles.metaMono, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                {Math.round((p.progress ?? 0) * 100)}% planned
              </Text>
              <Text style={[styles.metaMono, { color: t.fgDim, fontFamily: t.fontMono }]}>·</Text>
              <Text style={[styles.metaMono, { color: t.accent, fontFamily: t.fontMono }]}>
                @planner asking
              </Text>
              <View style={styles.flex1} />
              <View style={[styles.pillBtn, { backgroundColor: t.accent }]}>
                <Text style={[styles.pillBtnText, { color: DARK_ON_ACCENT, fontFamily: t.fontMono }]}>
                  resume →
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Text style={[styles.metaMono, { color: t.fg, fontFamily: t.fontMono }]}>{p.iteration}</Text>
              <Text style={[styles.metaMono, { color: t.fgMuted, fontFamily: t.fontMono }]}>· {p.open}/{p.total} issues</Text>
              <Text style={[styles.metaMono, { color: t.fgMuted, fontFamily: t.fontMono }]}>· {p.prs} PRs</Text>
              <Text style={[styles.metaMono, { color: t.fgMuted, fontFamily: t.fontMono }]}>· {p.mile} milestones</Text>
            </View>
            <View style={styles.completionRow}>
              <View style={styles.flex1}><ProgressBar value={completion} tone="success" /></View>
              <Text style={[styles.metaMono, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                {Math.round(completion * 100)}%
              </Text>
              <View style={[styles.boardBtn, { backgroundColor: t.elev, borderColor: t.borderColor }]}>
                <Text style={[styles.pillBtnText, { color: t.accent, fontFamily: t.fontMono }]}>board →</Text>
              </View>
            </View>
          </>
        )}
      </Card>
    </Pressable>
  );
}

export function PlanProjects({ nav }: { nav: PlanNav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('');

  const q = filter.trim().toLowerCase();
  const match = (p: PlanProject) => !q || p.name.toLowerCase().includes(q) || p.repo.toLowerCase().includes(q);
  const onHost = PLAN_PROJECTS.filter((p) => p.host && match(p));
  const otherHosts = PLAN_PROJECTS.filter((p) => !p.host && match(p));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <PageHeader
        crumbs={['base-studio-code', 'via tunnel', 'projects']}
        title="Plan"
        meta={
          <>
            <Text style={{ color: t.success }}>● tunnel</Text> · mbp-lina · 4m
          </>
        }
      />

      <ScrollView
        style={{ backgroundColor: t.bg }}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.filterWrap}>
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Filter projects…"
            placeholderTextColor={t.fgDim}
            style={[styles.input, { color: t.fg, backgroundColor: t.elev, borderColor: t.borderColor, fontFamily: t.fontMono }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Plan-a-new-project CTA */}
        <View style={styles.ctaWrap}>
          <Card
            style={styles.ctaCard}
            background={hexAlpha(t.accent, 0.10)}
            borderColor={t.accentDim}
          >
            <View style={styles.ctaHead}>
              <ClaudeBadge size={22} radius={5} />
              <Text style={[styles.ctaTitle, { color: t.fg, fontFamily: t.fontMono }]}>Plan a new project</Text>
              <View style={styles.flex1} />
              <Text style={[styles.ctaEta, { color: t.fgDim, fontFamily: t.fontMono }]}>~8 min</Text>
            </View>
            <View style={[styles.ctaInput, { backgroundColor: t.bg, borderColor: t.borderColor }]}>
              <Text style={[styles.ctaArrow, { color: t.accent, fontFamily: t.fontMono }]}>▸ </Text>
              <Text style={[styles.ctaPlaceholder, { color: t.fgDim, fontFamily: t.fontMono }]}>
                pitch what you want to build…
              </Text>
            </View>
          </Card>
        </View>

        <SectionLabel count={onHost.length} action="↻ sync">On this host</SectionLabel>
        <View style={styles.list}>
          {onHost.map((p) => <ProjectCard key={p.id} p={p} nav={nav} />)}
        </View>

        <SectionLabel count={otherHosts.length} hint="visible · not local">Other hosts</SectionLabel>
        <View style={styles.list}>
          {otherHosts.map((p) => <ProjectCard key={p.id} p={p} dim nav={nav} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },
  filterWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  input: {
    height: 36, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, fontSize: 12.5,
  },

  ctaWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  ctaCard: { padding: 12, borderRadius: 8 },
  ctaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ctaTitle: { fontSize: 11.5 },
  ctaEta: { fontSize: 9.5 },
  ctaInput: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaArrow: { fontSize: 11 },
  ctaPlaceholder: { fontSize: 11 },

  list: { paddingHorizontal: 12, paddingBottom: 6, gap: 8 },
  card: { padding: 12, borderRadius: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  id: { fontSize: 9.5 },
  name: { fontSize: 13.5, fontWeight: '500', marginBottom: 4, lineHeight: 18 },
  pitch: { fontSize: 11.5, lineHeight: 17, marginBottom: 8 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaMono: { fontSize: 10 },
  completionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  pillBtn: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 5 },
  pillBtnText: { fontSize: 10.5, fontWeight: '600' },
  boardBtn: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
