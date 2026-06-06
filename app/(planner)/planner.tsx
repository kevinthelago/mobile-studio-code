import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { Surface } from '../../src/components/ui/Surface';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import {
  PlannerHeader, PlannerTabBar, Composer, PlannerTabItem,
} from '../../src/components/planner/PlannerChrome';
import { QuickReplies } from '../../src/components/planner/atoms';
import {
  ChatMessages, ChatEmptyBody, GateCard, ReadySummary,
} from '../../src/components/planner/ChatTab';
import { PlanTab } from '../../src/components/planner/PlanTab';
import { PreviewTab } from '../../src/components/planner/PreviewTab';
import { GradeTab } from '../../src/components/planner/GradeTab';
import { OverflowMenu } from '../../src/components/planner/OverflowMenu';
import {
  Plan, PlannerTab, StageId, StageState, confirmedLabel,
} from '../../src/lib/planner/types';
import { seedPlan } from '../../src/lib/planner/seed';
import { PLAN_COLORS } from '../../src/lib/planner/colors';

const STATUS_COLOR: Record<string, string> = {
  setup: PLAN_COLORS.info,
  drafting: '#ffaecf',
  blocked: PLAN_COLORS.warn,
  ready: PLAN_COLORS.good,
};

const DRAFT_QUICK = [
  { label: 'Looks good →', primary: true },
  { label: 'Add a settings screen' },
  { label: 'Use tabs, not a drawer' },
  { label: 'Explain the flows' },
];

const GATE_QUICK = [
  { label: 'Yes, fix all →', primary: true },
  { label: 'Assign milestone only' },
  { label: 'Show the 3 issues' },
];

const ALL_DONE: Record<StageId, StageState> = {
  context: 'done', repos: 'done', ui: 'done', structure: 'done',
  perms: 'done', auto: 'done', skills: 'done',
};

export default function PlannerScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<PlannerTab>('chat');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pitch] = useState('');
  const [blueprint, setBlueprint] = useState('full');

  const isEmpty = plan === null;

  function startPlanning() {
    setPlan(seedPlan(pitch, blueprint));
    setTab('chat');
  }

  // Confirm the UI section → advance, then surface the Structure→Perms gate.
  function confirmSection(index: number) {
    setPlan((p) => {
      if (!p) return p;
      const messages = p.messages.map((m, i) =>
        i === index && m.kind === 'section'
          ? { ...m, section: { ...m.section, confirmed: true } }
          : m,
      );
      return {
        ...p,
        status: 'blocked',
        stageStates: { ...p.stageStates, ui: 'done', structure: 'current' },
        messages: [
          ...messages,
          {
            kind: 'assistant',
            text: 'Permissions is gated until Structure passes its readiness gate. Two things are blocking it:',
          },
        ],
      };
    });
  }

  // Resolve the gate → plan is ready to publish.
  function fixGate() {
    setPlan((p) => p ? {
      ...p,
      status: 'ready',
      stageStates: { ...ALL_DONE },
      gate: p.gate.map((g) => ({ ...g, ok: true })),
      messages: [
        ...p.messages,
        {
          kind: 'assistant',
          text: "All seven sections are confirmed and the plan grades A- (91%). Here's what publishing will create on GitHub:",
        },
      ],
    } : p);
  }

  function pickQuick(label: string) {
    if (label.startsWith('Looks good') || label.startsWith('Explain')) return;
    if (label.startsWith('Yes, fix')) { fixGate(); return; }
    setPlan((p) => p ? { ...p, messages: [...p.messages, { kind: 'user', text: label }] } : p);
  }

  function clearPlan() {
    setPlan(null);
    setTab('chat');
    setMenuOpen(false);
  }

  const status = plan?.status ?? 'setup';

  const tabs: PlannerTabItem[] = isEmpty
    ? [{ id: 'chat', label: 'Chat' }, { id: 'plan', label: 'Plan' }]
    : [
        { id: 'chat', label: 'Chat' },
        { id: 'plan', label: 'Plan' },
        { id: 'preview', label: 'Preview', badge: status === 'drafting' },
        { id: 'grade', label: 'Grade', badge: status === 'blocked' },
      ];

  return (
    <View style={styles.root}>
      <PlannerHeader
        title={plan?.title ?? 'New project'}
        repo={plan?.repo}
        status={status}
        statusColor={STATUS_COLOR[status]}
        confirmedLabel={plan ? confirmedLabel(plan) : '0/7'}
        stageStates={plan?.stageStates}
        onBack={() => router.back()}
        onMenu={() => setMenuOpen(true)}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'chat' && isEmpty && (
          <ChatEmptyBody pitch={pitch} blueprint={blueprint} onSelectBlueprint={setBlueprint} />
        )}
        {tab === 'chat' && plan && (
          <>
            <ChatMessages plan={plan} onConfirmSection={confirmSection} />
            {status === 'blocked' && (
              <GateCard checks={plan.gate} onViewGrade={() => setTab('grade')} onFix={fixGate} />
            )}
            {status === 'ready' && <ReadySummary plan={plan} />}
          </>
        )}
        {tab === 'plan' && plan && <PlanTab plan={plan} onGrade={() => setTab('grade')} />}
        {tab === 'preview' && <PreviewTab />}
        {tab === 'grade' && plan && <GradeTab grade={plan.grade} />}
      </ScrollView>

      {/* Footer — varies by state */}
      {tab === 'chat' && isEmpty && (
        <View style={styles.footer}>
          <PrimaryButton label="Start planning" onPress={startPlanning} />
        </View>
      )}
      {tab === 'chat' && plan && status === 'ready' && (
        <View style={styles.footer}>
          <Surface style={styles.publishBar} radius={16}>
            <View style={[styles.gradeBadge, { backgroundColor: 'rgba(126,226,196,0.14)' }]}>
              <Text style={[styles.gradeBadgeText, { color: PLAN_COLORS.good, fontFamily: t.fontMono }]}>
                {plan.grade.letter}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.publishTitle, { color: t.fg }]}>Ready to publish</Text>
              <Text style={[styles.publishMeta, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                {plan.milestones.reduce((n, m) => n + m.issues, 0)} issues · {plan.milestones.reduce((n, m) => n + m.agents, 0)} agents
              </Text>
            </View>
            <PrimaryButton onPress={() => {}} style={styles.syncBtn}>
              <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
                <Path d="M2 7.5h11M9 3.5l4 4-4 4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.syncText}>Sync to GitHub</Text>
            </PrimaryButton>
          </Surface>
        </View>
      )}
      {tab === 'chat' && plan && status !== 'ready' && (
        <View style={styles.footer}>
          <QuickReplies items={status === 'blocked' ? GATE_QUICK : DRAFT_QUICK} onPick={pickQuick} style={styles.quick} />
          <Composer onSend={() => {}} />
        </View>
      )}

      <PlannerTabBar tabs={tabs} active={tab} onChange={setTab} bottomInset={insets.bottom} />

      {menuOpen && <OverflowMenu onClose={() => setMenuOpen(false)} onPublish={clearPlan} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16 },
  footer: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  quick: { marginHorizontal: -12 },

  publishBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  gradeBadge: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gradeBadgeText: { fontSize: 14, fontWeight: '700' },
  publishTitle: { fontSize: 13.5, fontWeight: '600' },
  publishMeta: { fontSize: 10.5, marginTop: 1 },
  syncBtn: { paddingHorizontal: 14, minHeight: 40 },
  syncText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
