import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { PlannerProvider } from '../../src/lib/planner/PlannerContext';
import PlannerScreen from '../(planner)/planner';
import { useMirrorDomain } from '../../src/lib/mirror/MirrorContext';
import { LivePlanBoard } from '../../src/components/planner/LivePlanBoard';
import { BlueprintsSection } from '../../src/components/planner/BlueprintsSection';
import { selectPlanBoard } from '../../src/lib/pages/plannerBoard';
import { selectBlueprints } from '../../src/lib/pages/blueprintsPage';

type Segment = 'live' | 'blueprints' | 'planner';

/**
 * Planner tab (#221) — composes the mirror-driven views ALONGSIDE the existing local planner suite.
 * When the desktop shares a live plan (`plan` domain) or blueprints (`blueprints` domain), a slim
 * segment strip lets the user switch between the Live plan board, the Blueprints/Team mirror, and the
 * local Planner. When there is NO tunnel plan, the local suite renders unchanged (no strip).
 */
export default function PlannerTab() {
  return (
    <PlannerProvider>
      <PlanTabInner />
    </PlannerProvider>
  );
}

function PlanTabInner() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const plan = useMirrorDomain('plan');
  const blueprints = useMirrorDomain('blueprints');
  const org = useMirrorDomain('org');

  const planModel = useMemo(() => (plan.synced ? selectPlanBoard(plan.data) : undefined), [plan.synced, plan.data]);
  const blueprintsModel = useMemo(
    () => (blueprints.synced ? selectBlueprints(blueprints.data) : undefined),
    [blueprints.synced, blueprints.data],
  );
  const hasPlan = !!planModel;
  const hasBlueprints = !!blueprintsModel;
  const hasMirror = hasPlan || hasBlueprints;

  const [segment, setSegment] = useState<Segment>('live');
  // The effective segment: fall back off any segment whose mirror content isn't available.
  let effective: Segment = segment;
  if (effective === 'live' && !hasPlan) effective = hasBlueprints ? 'blueprints' : 'planner';
  if (effective === 'blueprints' && !hasBlueprints) effective = hasPlan ? 'live' : 'planner';

  // No tunnel plan / blueprints → the local suite, byte-unchanged (no extra chrome).
  if (!hasMirror) return <PlannerScreen />;

  const segments: { key: Segment; label: string; on: boolean }[] = [
    { key: 'live', label: 'Live plan', on: hasPlan },
    { key: 'blueprints', label: 'Blueprints', on: hasBlueprints },
    { key: 'planner', label: 'Planner', on: true },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.strip, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
        {segments.filter((s) => s.on).map((s) => {
          const active = effective === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              style={[styles.seg, { borderColor: active ? t.accent : t.borderColor }, active && { backgroundColor: t.surface }]}
            >
              <Text style={[styles.segText, { color: active ? t.fg : t.fgMuted }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {effective === 'live' ? (
          <LivePlanBoard data={plan.data} />
        ) : effective === 'blueprints' ? (
          <BlueprintsSection data={blueprints.data} orgData={org.data} />
        ) : (
          // The local suite already owns the safe-area top; the strip consumed it, so zero it here.
          <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
            <PlannerScreen />
          </SafeAreaInsetsContext.Provider>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  strip: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  seg: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth },
  segText: { fontSize: 12.5, fontWeight: '600' },
  body: { flex: 1 },
});
