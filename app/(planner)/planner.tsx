import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { Surface } from '../../src/components/ui/Surface';
import { IconBtn } from '../../src/components/ui/IconBtn';
import { Tag } from '../../src/components/ui/Tag';
import { BlueprintPicker } from '../../src/components/planner/BlueprintPicker';
import { BlueprintStageBar } from '../../src/components/planner/BlueprintStageBar';
import { PlanConversation } from '../../src/components/planner/PlanConversation';
import { PublishSheet } from '../../src/components/planner/PublishSheet';
import { GradeTab } from '../../src/components/planner/GradeTab';
import { OverflowMenu } from '../../src/components/planner/OverflowMenu';
import { PLAN_COLORS } from '../../src/lib/planner/colors';
import type { Blueprint, SectionRenderStatus } from '../../src/lib/planner/core';
import { projectReadiness, type ProjectReadiness } from '../../src/lib/planner/project';
import type { Grade, GradeCategory, GradeSuggestion } from '../../src/lib/planner/types';
import { buildPublishPlan } from '../../src/lib/planner/publish';
import { usePlanner } from '../../src/lib/planner/PlannerContext';
import { usePlannerSync } from '../../src/lib/planner/PlannerSyncContext';

const STATUS_META: Record<SectionRenderStatus, { label: string; color: string }> = {
  'complete': { label: 'Complete', color: PLAN_COLORS.good },
  'in-progress': { label: 'In progress', color: PLAN_COLORS.plan },
  'locked': { label: 'Locked', color: '#8a8f9a' },
  'na': { label: 'N/A', color: '#8a8f9a' },
};

const PIPELINE_STATUS_COLOR: Record<string, string> = {
  idle: '#8a8f9a',
  running: PLAN_COLORS.info,
  ok: PLAN_COLORS.good,
  fail: PLAN_COLORS.bad,
  blocked: PLAN_COLORS.warn,
};

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Derive a live readiness "grade" from the project's section completion — feeds GradeTab.
 *  (The blueprint-driven readiness model is the source of truth; no mock data.) */
function buildGrade(readiness: ProjectReadiness): Grade {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const applicable = readiness.sections.filter((s) => s.status.status !== 'na');
  const avg = applicable.length
    ? applicable.reduce((sum, s) => sum + clamp(s.status.fraction), 0) / applicable.length
    : 0;
  const pct = Math.round(avg * 100);
  const letter = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
  const done = applicable.filter((s) => s.status.status === 'complete').length;
  const summary = readiness.complete
    ? 'Every applicable section is satisfied — ready to publish.'
    : `${done} of ${applicable.length} section${applicable.length === 1 ? '' : 's'} complete.`;
  const categories: GradeCategory[] = applicable.map((s) => ({
    name: s.section.name,
    pct: Math.round(clamp(s.status.fraction) * 100),
  }));
  const suggestions: GradeSuggestion[] = readiness.incomplete.map((inc) => ({
    severity: inc.status === 'locked' ? 'info' : 'warn',
    title: inc.name,
    detail: inc.reason,
  }));
  return { letter, pct, summary, categories, suggestions };
}

export default function PlannerScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    loading, summaries, active, sending,
    createProject, openProject, closeProject, deleteProject, sendMessage, runSectionPipeline,
  } = usePlanner();

  const { conflicts: syncConflicts } = usePlannerSync();
  const [view, setView] = useState<'chat' | 'plan' | 'grade'>('chat');
  const [showPublish, setShowPublish] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  // Section the user jumped to from the stage stepper — highlighted + expanded in the plan pane.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const planScrollRef = useRef<ScrollView>(null);
  const sectionListY = useRef(0);                         // plan section list's y within the scroll content
  const sectionOffsets = useRef<Record<string, number>>({}); // each card's y within the section list
  const pendingScrollKey = useRef<string | null>(null);
  const readiness = useMemo(() => (active ? projectReadiness(active) : null), [active]);
  const grade = useMemo(() => (readiness ? buildGrade(readiness) : null), [readiness]);
  const publishPlan = useMemo(() => (active ? buildPublishPlan(active) : null), [active]);

  // Tapping a stage node jumps the project pane to that section. Switch to the plan
  // view, then scroll once layout has settled (offsets are populated via onLayout).
  useEffect(() => {
    if (view !== 'plan' || !pendingScrollKey.current) return;
    const key = pendingScrollKey.current;
    const id = requestAnimationFrame(() => {
      const y = sectionListY.current + (sectionOffsets.current[key] ?? 0);
      planScrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      pendingScrollKey.current = null;
    });
    return () => cancelAnimationFrame(id);
  }, [view, activeKey]);

  function jumpToSection(key: string) {
    setActiveKey(key);
    pendingScrollKey.current = key;
    setView('plan');
  }

  function startBlueprint(bp: Blueprint) {
    setView('chat');
    void createProject(bp);
  }
  function back() {
    if (active) closeProject();
    else router.back();
  }
  function confirmDelete(id: string, title: string) {
    Alert.alert('Delete plan?', `"${title}" will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void deleteProject(id); } },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
        <IconBtn onPress={back}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M9 3L5 7l4 4" stroke={t.fg} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </IconBtn>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: t.fg }]} numberOfLines={1}>
            {active ? active.title : 'Plan a project'}
          </Text>
          <Text style={[styles.subtitle, { color: t.fgDim }]} numberOfLines={1}>
            {active ? 'Local plan · on this device' : 'Pick up a plan or start a new one'}
          </Text>
        </View>
        {readiness && (
          <View style={[styles.readyPill, {
            borderColor: readiness.complete ? PLAN_COLORS.good : t.borderColor,
            backgroundColor: readiness.complete ? 'rgba(126,226,196,0.12)' : 'transparent',
          }]}>
            <Text style={[styles.readyText, {
              color: readiness.complete ? PLAN_COLORS.good : t.fgMuted, fontFamily: t.fontMono,
            }]}>
              {readiness.complete
                ? 'Ready'
                : `${readiness.sections.filter((s) => s.status.status === 'complete').length}`
                  + `/${readiness.sections.filter((s) => s.status.status !== 'na').length}`}
            </Text>
          </View>
        )}
        {active && (
          <IconBtn onPress={() => setShowOverflow(true)}>
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Circle cx={8} cy={3.2} r={1.3} fill={t.fg} />
              <Circle cx={8} cy={8} r={1.3} fill={t.fg} />
              <Circle cx={8} cy={12.8} r={1.3} fill={t.fg} />
            </Svg>
          </IconBtn>
        )}
      </View>

      {/* ── Home: recent projects + new from a blueprint ── */}
      {!active && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={t.accent} /></View>
          ) : (
            <>
              {syncConflicts.length > 0 && (
                <Pressable onPress={() => router.push(`/(sync)/sync?projectId=${syncConflicts[0].projectId}`)}>
                  <Surface style={[styles.syncBanner, { borderColor: PLAN_COLORS.warn }]} radius={6}>
                    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
                      <Path d="M8 5v3.5M8 11h.01M8 1.5l6.5 11h-13z" stroke={PLAN_COLORS.warn} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <View style={styles.syncBannerText}>
                      <Text style={[styles.syncBannerTitle, { color: t.fg }]}>
                        {syncConflicts.length} plan{syncConflicts.length === 1 ? '' : 's'} need conflict resolution
                      </Text>
                      <Text style={[styles.syncBannerSub, { color: t.fgMuted }]} numberOfLines={1}>
                        “{syncConflicts[0].local.title}” diverged from base-studio-code
                      </Text>
                    </View>
                    <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                      <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
                    </Svg>
                  </Surface>
                </Pressable>
              )}
              {summaries.length > 0 && (
                <View style={styles.recent}>
                  <Text style={[styles.sectionHeading, { color: t.fgDim }]}>RECENT PLANS</Text>
                  {summaries.map((s) => (
                    <Pressable key={s.id} onPress={() => { void openProject(s.id); }}>
                      <Surface style={styles.recentCard} radius={6}>
                        <View style={styles.recentMain}>
                          <Text style={[styles.recentTitle, { color: t.fg }]} numberOfLines={1}>{s.title}</Text>
                          <Text style={[styles.recentMeta, { color: t.fgDim }]} numberOfLines={1}>
                            {s.blueprintName} · {s.complete ? 'ready' : `${s.done}/${s.total}`} · {relativeTime(s.updatedAt)}
                          </Text>
                        </View>
                        <Pressable onPress={() => confirmDelete(s.id, s.title)} hitSlop={10} style={styles.trash}>
                          <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
                            <Path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8h5l.5-8" stroke={t.fgMuted} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </Pressable>
                      </Surface>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={[styles.sectionHeading, { color: t.fgDim, marginTop: summaries.length ? 6 : 0 }]}>
                NEW FROM A BLUEPRINT
              </Text>
              <BlueprintPicker onPick={startBlueprint} />
            </>
          )}
        </ScrollView>
      )}

      {/* ── Active plan: stage bar + Chat / Plan ── */}
      {active && readiness && (
        <View style={styles.activeRoot}>
          <View style={styles.activeTop}>
            <BlueprintStageBar
              readiness={readiness}
              activeKey={activeKey}
              onSelectSection={jumpToSection}
            />
            <View style={[styles.segment, { borderColor: t.borderColor }]}>
              {(['chat', 'plan', 'grade'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  style={[styles.segBtn, view === v && { backgroundColor: t.surface }]}
                >
                  <Text style={[styles.segText, { color: view === v ? t.fg : t.fgMuted }]}>
                    {{ chat: 'Chat', plan: 'Plan', grade: 'Grade' }[v]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {view === 'chat' ? (
            <PlanConversation
              messages={active.messages}
              sending={sending}
              onSend={sendMessage}
              bottomInset={insets.bottom}
            />
          ) : view === 'grade' ? (
            <ScrollView
              style={styles.content}
              contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              {grade && <GradeTab grade={grade} />}
            </ScrollView>
          ) : (
            <ScrollView
              ref={planScrollRef}
              style={styles.content}
              contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              {readiness.complete ? (
                <Surface style={[styles.banner, { borderColor: PLAN_COLORS.good }]} radius={6}>
                  <Text style={[styles.bannerTitle, { color: PLAN_COLORS.good }]}>Plan complete</Text>
                  <Text style={[styles.bannerBody, { color: t.fgMuted }]}>
                    Every applicable section is satisfied. Transfer to base-studio-code is coming soon.
                  </Text>
                </Surface>
              ) : readiness.current ? (
                <Surface style={styles.banner} radius={6}>
                  <Text style={[styles.bannerLabel, { color: t.fgDim }]}>UP NEXT</Text>
                  <Text style={[styles.bannerTitle, { color: t.fg }]}>
                    {readiness.current.glyph}  {readiness.current.name}
                  </Text>
                  <Text style={[styles.bannerBody, { color: t.fgMuted }]}>{readiness.current.blurb}</Text>
                </Surface>
              ) : null}

              {publishPlan && publishPlan.issues.length > 0 && (
                <Pressable onPress={() => setShowPublish(true)}>
                  <Surface style={styles.publishBtn} radius={6}>
                    <View style={[styles.publishIcon, { backgroundColor: 'rgba(126,226,196,0.1)' }]}>
                      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                        <Path d="M8 11V4M5 7l3-3 3 3M3 12.5h10" stroke={PLAN_COLORS.good} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <View style={styles.publishText}>
                      <Text style={[styles.publishTitle, { color: t.fg }]}>Publish to GitHub</Text>
                      <Text style={[styles.publishMeta, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                        {publishPlan.milestones.length} milestones · {publishPlan.issues.length} issues
                      </Text>
                    </View>
                    <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                      <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
                    </Svg>
                  </Surface>
                </Pressable>
              )}

              <View
                style={styles.sectionList}
                onLayout={(e) => { sectionListY.current = e.nativeEvent.layout.y; }}
              >
                {readiness.sections.map(({ section, status }) => {
                  const meta = status.blocked
                    ? { label: 'Blocked', color: PLAN_COLORS.warn }
                    : STATUS_META[status.status];
                  const content = active.sections[section.key]?.content;
                  const isActive = section.key === activeKey;
                  return (
                    <View
                      key={section.key}
                      onLayout={(e) => { sectionOffsets.current[section.key] = e.nativeEvent.layout.y; }}
                    >
                    <Surface
                      style={[styles.sectionCard, isActive && { borderColor: t.accent, borderWidth: 1 }]}
                      radius={6}
                    >
                      <View style={styles.sectionRow}>
                        <Text style={[styles.sectionGlyph, { color: meta.color }]}>{section.glyph}</Text>
                        <View style={styles.sectionMain}>
                          <Text style={[styles.sectionName, { color: t.fg }]}>{section.name}</Text>
                          <Text style={[styles.sectionGate, { color: t.fgDim }]} numberOfLines={1}>
                            Gate: {section.gate}
                          </Text>
                        </View>
                        <Tag color={meta.color} bg={`${meta.color}22`} border={false}>{meta.label}</Tag>
                      </View>
                      {content ? (
                        <Text style={[styles.sectionContent, { color: t.fgMuted }]} numberOfLines={isActive ? undefined : 6}>{content}</Text>
                      ) : null}
                      {section.pipelines.length > 0 && (
                        <View style={[styles.pipelineList, { borderTopColor: t.borderColor }]}>
                          {section.pipelines.map((pl) => {
                            const run = active.pipelineRuns[pl.uid];
                            const rs = run?.status ?? 'idle';
                            const pc = PIPELINE_STATUS_COLOR[rs] ?? '#8a8f9a';
                            return (
                              <View key={pl.uid} style={styles.pipelineRow}>
                                <View style={[styles.pipelineDot, { backgroundColor: pc }]} />
                                <View style={styles.pipelineMain}>
                                  <Text style={[styles.pipelineName, { color: t.fgMuted }]} numberOfLines={1}>
                                    {pl.name}{pl.gate ? ' · gate' : ''}
                                  </Text>
                                  <Text style={[styles.pipelineMeta, { color: t.fgDim }]} numberOfLines={1}>
                                    {run?.message ?? pl.trigger}
                                  </Text>
                                </View>
                                <Pressable
                                  onPress={() => { void runSectionPipeline(section.key, pl.uid); }}
                                  disabled={rs === 'running' || !pl.enabled}
                                  style={[styles.runBtn, { borderColor: t.borderColor, opacity: pl.enabled ? 1 : 0.4 }]}
                                  hitSlop={6}
                                >
                                  {rs === 'running'
                                    ? <ActivityIndicator color={t.fgMuted} size="small" />
                                    : <Text style={[styles.runText, { color: t.accent }]}>Run</Text>}
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </Surface>
                    </View>
                  );
                })}
              </View>

              {!readiness.complete && readiness.incomplete.length > 0 && (
                <Surface style={styles.incompleteCard} radius={6}>
                  <Text style={[styles.incompleteTitle, { color: t.fg }]}>What's left</Text>
                  {readiness.incomplete.map((s) => (
                    <View key={s.key} style={styles.incompleteRow}>
                      <View style={[styles.incDot, {
                        backgroundColor: s.status === 'locked' ? '#8a8f9a' : PLAN_COLORS.plan,
                      }]} />
                      <Text style={[styles.incName, { color: t.fgMuted }]}>{s.name}</Text>
                      <Text style={[styles.incReason, { color: t.fgDim }]} numberOfLines={1}>{s.reason}</Text>
                    </View>
                  ))}
                </Surface>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {active && showPublish && (
        <PublishSheet project={active} onClose={() => setShowPublish(false)} />
      )}

      {active && showOverflow && (
        <OverflowMenu
          onClose={() => setShowOverflow(false)}
          onPublish={() => { setShowOverflow(false); setShowPublish(true); }}
          onSaveExit={() => { setShowOverflow(false); closeProject(); router.back(); }}
          onSwitchBlueprint={() => { setShowOverflow(false); closeProject(); }}
          onClear={() => { setShowOverflow(false); void deleteProject(active.id); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 11.5, marginTop: 1 },
  readyPill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 4 },
  readyText: { fontSize: 11, fontWeight: '600' },

  content: { flex: 1 },
  contentInner: { paddingHorizontal: 14, paddingTop: 12, gap: 14 },

  loading: { paddingVertical: 40, alignItems: 'center' },
  sectionHeading: { fontSize: 10.5, letterSpacing: 1.2, fontWeight: '700' },

  syncBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, marginBottom: 4 },
  syncBannerText: { flex: 1, minWidth: 0 },
  syncBannerTitle: { fontSize: 13.5, fontWeight: '600' },
  syncBannerSub: { fontSize: 11.5, marginTop: 1 },

  recent: { gap: 8 },
  recentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  recentMain: { flex: 1, minWidth: 0, gap: 2 },
  recentTitle: { fontSize: 14, fontWeight: '600' },
  recentMeta: { fontSize: 11.5 },
  trash: { padding: 4 },

  activeRoot: { flex: 1 },
  activeTop: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, padding: 2 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 4 },
  segText: { fontSize: 13, fontWeight: '600' },

  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  publishIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  publishText: { flex: 1, minWidth: 0 },
  publishTitle: { fontSize: 14, fontWeight: '600' },
  publishMeta: { fontSize: 11, marginTop: 1 },

  banner: { padding: 14, gap: 4 },
  bannerLabel: { fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerBody: { fontSize: 12.5, lineHeight: 18 },

  sectionList: { gap: 8 },
  sectionCard: { padding: 13, gap: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionGlyph: { fontSize: 17, width: 22, textAlign: 'center' },
  sectionMain: { flex: 1, minWidth: 0, gap: 2 },
  sectionName: { fontSize: 14, fontWeight: '600' },
  sectionGate: { fontSize: 11.5 },
  sectionContent: { fontSize: 12, lineHeight: 17 },

  pipelineList: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pipelineDot: { width: 7, height: 7, borderRadius: 4 },
  pipelineMain: { flex: 1, minWidth: 0 },
  pipelineName: { fontSize: 12.5, fontWeight: '500' },
  pipelineMeta: { fontSize: 11, marginTop: 1 },
  runBtn: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 5, minWidth: 50, alignItems: 'center' },
  runText: { fontSize: 12.5, fontWeight: '600' },

  incompleteCard: { padding: 14, gap: 8 },
  incompleteTitle: { fontSize: 13.5, fontWeight: '700' },
  incompleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incDot: { width: 7, height: 7, borderRadius: 4 },
  incName: { fontSize: 12.5, fontWeight: '500' },
  incReason: { fontSize: 11.5, flex: 1 },
});
