import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { Surface } from '../../src/components/ui/Surface';
import { IconBtn } from '../../src/components/ui/IconBtn';
import { Tag } from '../../src/components/ui/Tag';
import { PLAN_COLORS } from '../../src/lib/planner/colors';
import { useLivePlan } from '../../src/lib/tunnel/LivePlanContext';
import { useTunnel } from '../../src/lib/TunnelContext';
import { deriveSections, type PlanSection } from '../../src/lib/tunnel/livePlan';
import type { LivePlanState, PlanMessage, PlanPipelineRun } from '../../src/lib/types';

const PLAN = PLAN_COLORS.plan;

// ── Header (matches the (sync) screen's chrome) ──────────────────────────────
function Header({ title, sub, onBack, right }: {
  title: string; sub?: string; onBack: () => void; right?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
      <IconBtn onPress={onBack}>
        <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
          <Path d="M9 3L5 7l4 4" stroke={t.fg} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </IconBtn>
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: t.fg }]} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[styles.headerSub, { color: t.fgDim, fontFamily: t.fontMono }]} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

// ── Stepper chip — tap to jump the desktop planner to that stage ─────────────
function StepChip({ step, onAdvance }: { step: PlanSection; onAdvance: () => void }) {
  const t = useTheme();
  const color = step.isCurrent ? PLAN : step.confirmed ? PLAN_COLORS.good : t.fgDim;
  const bg = step.isCurrent ? 'rgba(192,132,252,0.16)' : step.confirmed ? 'rgba(126,226,196,0.12)' : 'transparent';
  return (
    <Pressable onPress={onAdvance} style={[styles.chip, { borderColor: color, backgroundColor: bg }]}>
      <View style={[styles.chipDot, { borderColor: color, backgroundColor: step.confirmed ? color : 'transparent' }]}>
        {step.confirmed && (
          <Svg width={7} height={7} viewBox="0 0 10 10" fill="none">
            <Path d="M2 5l2 2 4-5" stroke="#16121d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <Text style={[styles.chipText, { color, fontFamily: t.fontMono }]} numberOfLines={1}>{step.label}</Text>
    </Pressable>
  );
}

// ── A section card: file content + confirm action ────────────────────────────
function SectionCard({ step, onConfirm }: { step: PlanSection; onConfirm: () => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(step.isCurrent);
  return (
    <Surface style={styles.sectionCard} radius={6}>
      <Pressable style={styles.sectionHead} onPress={() => setOpen((o) => !o)}>
        <Text style={[styles.sectionName, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>{step.label}</Text>
        {step.confirmed
          ? <Tag color={PLAN_COLORS.good} bg="rgba(126,226,196,0.14)" border={false}>confirmed</Tag>
          : step.isCurrent
            ? <Tag color={PLAN} bg="rgba(192,132,252,0.16)" border={false}>current</Tag>
            : <Tag color={t.fgDim} border={false}>pending</Tag>}
      </Pressable>
      {open && (
        step.file
          ? <Text style={[styles.sectionBody, { color: t.fgMuted, fontFamily: t.fontMono }]}>{step.file.content || '(empty)'}</Text>
          : <Text style={[styles.sectionEmpty, { color: t.fgDim }]}>No file content for this stage yet.</Text>
      )}
      {!step.confirmed && (
        <Pressable onPress={onConfirm} style={[styles.confirmBtn, { borderColor: PLAN_COLORS.good, backgroundColor: 'rgba(126,226,196,0.1)' }]}>
          <Text style={[styles.confirmText, { color: PLAN_COLORS.good }]}>Confirm section</Text>
        </Pressable>
      )}
    </Surface>
  );
}

function PipelineRow({ run }: { run: PlanPipelineRun }) {
  const t = useTheme();
  const color = /fail|error/i.test(run.status) ? PLAN_COLORS.bad
    : /pass|done|ok|success/i.test(run.status) ? PLAN_COLORS.good
    : /run/i.test(run.status) ? PLAN_COLORS.info : t.fgMuted;
  return (
    <View style={styles.runRow}>
      <Text style={[styles.runId, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>{run.id}</Text>
      <Text style={[styles.runStage, { color: t.fgDim, fontFamily: t.fontMono }]} numberOfLines={1}>{run.stage}</Text>
      <Tag color={color} dot={color} border={false}>{run.status}</Tag>
    </View>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: PlanMessage }) {
  const t = useTheme();
  const mine = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.bubble, {
        backgroundColor: mine ? `${t.accent}22` : t.surface,
        borderColor: mine ? `${t.accent}55` : t.borderColor,
      }]}>
        <Text style={[styles.bubbleRole, { color: mine ? t.accent : PLAN }]}>{mine ? 'You' : 'Claude'}</Text>
        <Text style={[styles.bubbleText, { color: t.fg }]}>{msg.text}</Text>
      </View>
    </View>
  );
}

// ── The screen ────────────────────────────────────────────────────────────────
export default function LivePlanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { projects, getProject, advance, confirm, chat } = useLivePlan();
  const { connectionState } = useTunnel();

  // Resolve the project to mirror: the requested one, else the most-recently-updated.
  const plan: LivePlanState | undefined = projectId ? getProject(projectId) : projects[0];
  const [tab, setTab] = useState<'plan' | 'chat'>('plan');
  const [draft, setDraft] = useState('');
  const chatRef = useRef<ScrollView | null>(null);

  const sections = useMemo(() => (plan ? deriveSections(plan) : []), [plan]);

  // Keep the transcript pinned to the newest message as deltas arrive.
  useEffect(() => {
    if (tab === 'chat') requestAnimationFrame(() => chatRef.current?.scrollToEnd({ animated: true }));
  }, [plan?.messages.length, tab]);

  const connected = connectionState === 'connected';
  const connLabel = connected ? 'live' : connectionState;
  const connColor = connected ? PLAN_COLORS.good : connectionState === 'error' ? PLAN_COLORS.bad : t.fgDim;

  function exit() { router.back(); }

  if (!plan) {
    return (
      <View style={styles.flex}>
        <Header title="Live planning" sub="base-studio-code" onBack={exit} />
        <View style={styles.center}>
          <Text style={[styles.bigBody, { color: t.fgDim }]}>
            {connected
              ? 'No live planning session on the desktop yet.\nOpen a project in base-studio-code\'s planner.'
              : 'Not connected.\nPair with base-studio-code to mirror its live planning session.'}
          </Text>
        </View>
      </View>
    );
  }

  function send() {
    const text = draft.trim();
    if (!text || !plan) return;
    chat(plan.projectId, text);   // optimistic-free: the desktop echoes via plan_event/plan_state
    setDraft('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <Header
        title={plan.currentStage ? `Stage · ${plan.currentStage}` : 'Live planning'}
        sub={`${plan.projectId}${plan.status ? ` · ${plan.status}` : ''}`}
        onBack={exit}
        right={<Tag color={connColor} dot={connColor} border={false}>{connLabel}</Tag>}
      />

      {/* Stepper — tap a stage to jump the desktop planner there. */}
      {sections.length > 0 && (
        <View style={[styles.stepper, { borderBottomColor: t.borderColor }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepperRow}>
            {sections.map((s) => (
              <StepChip key={s.key} step={s} onAdvance={() => advance(plan.projectId, s.key)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Segmented control */}
      <View style={styles.segment}>
        {(['plan', 'chat'] as const).map((seg) => (
          <Pressable
            key={seg}
            onPress={() => setTab(seg)}
            style={[styles.segBtn, { borderColor: tab === seg ? PLAN : t.borderColor, backgroundColor: tab === seg ? 'rgba(192,132,252,0.14)' : 'transparent' }]}
          >
            <Text style={[styles.segText, { color: tab === seg ? PLAN : t.fgMuted }]}>
              {seg === 'plan' ? 'Plan' : `Chat${plan.messages.length ? ` · ${plan.messages.length}` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'plan' ? (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {sections.map((s) => (
            <SectionCard key={s.key} step={s} onConfirm={() => confirm(plan.projectId, s.key)} />
          ))}

          <Text style={[styles.section, { color: t.fgDim }]}>PIPELINE RUNS</Text>
          {plan.pipelineRuns.length === 0 ? (
            <Text style={[styles.note, { color: t.fgDim }]}>No pipeline runs.</Text>
          ) : (
            <Surface style={styles.listCard} radius={6}>
              {plan.pipelineRuns.map((r, i) => (
                <View key={r.id} style={i > 0 ? { borderTopColor: t.borderColor, borderTopWidth: StyleSheet.hairlineWidth } : undefined}>
                  <PipelineRow run={r} />
                </View>
              ))}
            </Surface>
          )}

          <Text style={[styles.note, { color: t.fgDim }]}>
            Read-only mirror — the desktop owns this session. Tapping a stage or “Confirm” steers the
            desktop; changes reflect back on the next update.
          </Text>
        </ScrollView>
      ) : (
        <View style={styles.flex}>
          <ScrollView
            ref={chatRef}
            contentContainerStyle={[styles.chatBody, { paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
          >
            {plan.messages.length === 0
              ? <Text style={[styles.note, { color: t.fgDim, textAlign: 'center', marginTop: 24 }]}>No messages yet.</Text>
              : plan.messages.map((m, i) => <Bubble key={`${m.at}-${i}`} msg={m} />)}
          </ScrollView>
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8, borderTopColor: t.borderColor }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={connected ? 'Message the planner…' : 'Connect to chat'}
              placeholderTextColor={t.fgDim}
              editable={connected}
              multiline
              style={[styles.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.borderColor }]}
              onSubmitEditing={send}
            />
            <Pressable
              onPress={send}
              disabled={!connected || !draft.trim()}
              style={[styles.sendBtn, { backgroundColor: PLAN, opacity: !connected || !draft.trim() ? 0.4 : 1 }]}
            >
              <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
                <Path d="M3 10l14-6-6 14-2-6-6-2z" stroke="#16121d" strokeWidth={1.6} strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSub: { fontSize: 9.5, letterSpacing: 0.3, marginTop: 1 },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },

  stepper: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  stepperRow: { paddingHorizontal: 12, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, height: 30 },
  chipDot: { width: 14, height: 14, borderRadius: 8, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 11.5, fontWeight: '600' },

  segment: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  segBtn: { flex: 1, height: 34, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 12.5, fontWeight: '600' },

  body: { paddingHorizontal: 14, paddingTop: 10, gap: 12 },
  section: { fontSize: 10.5, letterSpacing: 1, fontWeight: '700', marginTop: 4 },
  note: { fontSize: 11.5, lineHeight: 16, marginTop: 4 },

  sectionCard: { padding: 13, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionName: { fontSize: 14, fontWeight: '600', flex: 1 },
  sectionBody: { fontSize: 11.5, lineHeight: 18 },
  sectionEmpty: { fontSize: 12, fontStyle: 'italic' },
  confirmBtn: { height: 34, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 12.5, fontWeight: '600' },

  listCard: { padding: 0, overflow: 'hidden' },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  runId: { fontSize: 13, fontWeight: '600', flex: 1 },
  runStage: { fontSize: 11.5 },

  chatBody: { paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '86%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 3 },
  bubbleRole: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  bubbleText: { fontSize: 13.5, lineHeight: 19 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, fontSize: 14,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  bigBody: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
});
