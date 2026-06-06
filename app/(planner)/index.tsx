import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import {
  PlannerHeader, PlannerTabBar, Composer, PlannerTabItem,
} from '../../src/components/planner/PlannerChrome';
import { QuickReplies } from '../../src/components/planner/atoms';
import { ChatMessages, ChatEmptyBody } from '../../src/components/planner/ChatTab';
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

export default function PlannerScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<PlannerTab>('chat');
  const [pitch] = useState('');
  const [blueprint, setBlueprint] = useState('full');

  const isEmpty = plan === null;

  function startPlanning() {
    setPlan(seedPlan(pitch, blueprint));
    setTab('chat');
  }

  function confirmSection(index: number) {
    setPlan((p) => {
      if (!p) return p;
      const messages = p.messages.map((m, i) =>
        i === index && m.kind === 'section'
          ? { ...m, section: { ...m.section, confirmed: true } }
          : m,
      );
      const stageStates: Record<StageId, StageState> = {
        ...p.stageStates,
        ui: 'done',
        structure: 'current',
      };
      return { ...p, messages, stageStates };
    });
  }

  function pickQuick(label: string) {
    if (label.startsWith('Looks good')) return;
    setPlan((p) => p ? { ...p, messages: [...p.messages, { kind: 'user', text: label }] } : p);
  }

  function leave() {
    router.back();
  }

  const tabs: PlannerTabItem[] = isEmpty
    ? [{ id: 'chat', label: 'Chat' }, { id: 'plan', label: 'Plan' }]
    : [
        { id: 'chat', label: 'Chat' },
        { id: 'plan', label: 'Plan' },
        { id: 'preview', label: 'Preview', badge: true },
        { id: 'grade', label: 'Grade' },
      ];

  return (
    <View style={styles.root}>
      <PlannerHeader
        title={plan?.title ?? 'New project'}
        repo={plan?.repo}
        status={plan?.status ?? 'setup'}
        statusColor={STATUS_COLOR[plan?.status ?? 'setup']}
        confirmedLabel={plan ? confirmedLabel(plan) : '0/7'}
        stageStates={plan?.stageStates}
        onBack={leave}
        onMenu={() => {}}
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
          <ChatMessages plan={plan} onConfirmSection={confirmSection} />
        )}
        {tab !== 'chat' && (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderText, { color: t.fgDim }]}>
              The {tab} view lands in the next slice of #78.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer — varies by state */}
      {isEmpty ? (
        <View style={styles.footer}>
          <PrimaryButton label="Start planning" onPress={startPlanning} />
        </View>
      ) : tab === 'chat' ? (
        <View style={styles.footer}>
          <QuickReplies items={DRAFT_QUICK} onPick={pickQuick} style={styles.quick} />
          <Composer onSend={() => {}} />
        </View>
      ) : null}

      <PlannerTabBar tabs={tabs} active={tab} onChange={setTab} bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16 },
  placeholder: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 32 },
  placeholderText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  footer: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  quick: { marginHorizontal: -12 },
});
