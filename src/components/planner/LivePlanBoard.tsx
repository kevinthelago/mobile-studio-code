import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { useTunnel } from '../../lib/TunnelContext';
import { selectPlanBoard, type PlanBoardStageVM } from '../../lib/pages/plannerBoard';
import { PLAN_COLORS } from '../../lib/planner/colors';

const STAGE_STATUS_COLOR: Record<string, string> = {
  complete: PLAN_COLORS.good,
  active: PLAN_COLORS.plan,
  locked: '#8a8f9a',
  upcoming: '#8a8f9a',
  skipped: '#8a8f9a',
};

/**
 * Live plan board (#221) — the read-only mirror of the desktop's focused plan (the `plan` store
 * domain): a stage stepper (glyph + name + status + gate fraction + unmet reasons), the fleet streams,
 * and deploy/market summaries. The ONE sanctioned non-chat mutation lives here: when the active gate
 * is ready, the two native buttons drive the desktop's live planner — Confirm (`planConfirm`) and
 * Advance (`planAdvance`), the user-only stage acts.
 */
export function LivePlanBoard({ data }: { data: unknown }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { planConfirm, planAdvance } = useTunnel();
  const model = useMemo(() => selectPlanBoard(data), [data]);

  if (!model) {
    return (
      <View style={styles.fallback}>
        <Text style={[styles.fallbackText, { color: t.fgMuted }]}>No live plan on the desktop right now.</Text>
      </View>
    );
  }

  const activeStage = model.stages.find((s) => s.key === model.currentStage);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.inner, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.fg }]} numberOfLines={1}>{model.title}</Text>
        <Tag border={false} bg={t.surface}>{model.planComplete ? 'complete' : model.statusLabel || 'in progress'}</Tag>
      </View>

      {/* Stage stepper */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepper}>
        {model.stages.map((s) => (
          <StageChip key={s.key} stage={s} current={s.key === model.currentStage} />
        ))}
      </ScrollView>

      {/* Active stage + gate */}
      {activeStage && (
        <Surface style={styles.card} radius={8}>
          <Text style={[styles.cardLabel, { color: t.fgDim }]}>CURRENT STAGE</Text>
          <Text style={[styles.cardTitle, { color: t.fg }]}>{activeStage.glyph} {activeStage.name}</Text>
          {model.gateReady ? (
            <Text style={[styles.gateOk, { color: PLAN_COLORS.good }]}>Gate ready</Text>
          ) : activeStage.unmet.length ? (
            <View style={styles.unmetList}>
              {activeStage.unmet.map((u, i) => (
                <View key={i} style={styles.unmetRow}>
                  <View style={[styles.unmetDot, { backgroundColor: PLAN_COLORS.warn }]} />
                  <Text style={[styles.unmetText, { color: t.fgMuted }]} numberOfLines={2}>
                    {u.label}{u.detail ? ` — ${u.detail}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.gateOk, { color: t.fgMuted }]}>Gate {Math.round(activeStage.fraction * 100)}%</Text>
          )}

          {/* The two user-only stage acts — only when the gate is ready. */}
          {model.canAct && (
            <View style={styles.actions}>
              <ActionButton label="Confirm" onPress={() => planConfirm(model.projectId, model.currentStage)} color={PLAN_COLORS.good} />
              <ActionButton label="Advance ›" onPress={() => planAdvance(model.projectId, model.currentStage)} color={t.accent} />
            </View>
          )}
        </Surface>
      )}

      {/* Streams */}
      {model.streams.length > 0 && (
        <>
          <Text style={[styles.heading, { color: t.fgDim }]}>STREAMS · {model.streams.length}{model.directorEnabled ? ' · director' : ''}</Text>
          {model.streams.map((s) => (
            <Surface key={s.id} style={styles.streamCard} radius={8}>
              <View style={styles.streamTop}>
                <Text style={[styles.streamName, { color: t.fg }]} numberOfLines={1}>{s.name}</Text>
                {s.repo ? <Tag border={false} bg={t.surface}>{s.repo}</Tag> : null}
              </View>
              <Text style={[styles.streamMeta, { color: t.fgMuted }]}>
                {s.issues} issue{s.issues === 1 ? '' : 's'}
                {s.persona ? ` · ${s.persona}` : ''}
                {s.dependsOn.length ? ` · depends on ${s.dependsOn.join(', ')}` : ''}
              </Text>
            </Surface>
          ))}
        </>
      )}

      {/* Deploy + market */}
      {model.deploy.defined && (
        <Surface style={styles.card} radius={8}>
          <Text style={[styles.cardLabel, { color: t.fgDim }]}>DEPLOYMENT</Text>
          {model.deploy.services.length ? (
            model.deploy.services.map((sv) => (
              <Text key={sv.id} style={[styles.line, { color: t.fgMuted }]}>
                {sv.repo || sv.id} → {sv.platform || '—'}{sv.workload ? ` · ${sv.workload}` : ''}
              </Text>
            ))
          ) : (
            <Text style={[styles.line, { color: t.fgMuted }]}>Deployment defined.</Text>
          )}
        </Surface>
      )}
      {model.market.defined && (
        <Surface style={styles.card} radius={8}>
          <Text style={[styles.cardLabel, { color: t.fgDim }]}>MARKET</Text>
          {model.market.summary ? <Text style={[styles.line, { color: t.fgMuted }]} numberOfLines={4}>{model.market.summary}</Text> : null}
          {model.market.recommendation ? <Tag border={false} bg={t.surface}>{model.market.recommendation}</Tag> : null}
        </Surface>
      )}
    </ScrollView>
  );
}

function StageChip({ stage, current }: { stage: PlanBoardStageVM; current: boolean }) {
  const t = useTheme();
  const color = STAGE_STATUS_COLOR[stage.status] ?? '#8a8f9a';
  return (
    <View style={[styles.chip, { borderColor: current ? t.accent : t.borderColor }]}>
      <Text style={[styles.chipGlyph, { color }]}>{stage.glyph}</Text>
      <Text style={[styles.chipName, { color: current ? t.fg : t.fgMuted }]} numberOfLines={1}>{stage.name}</Text>
      {stage.optional ? <Text style={[styles.chipOpt, { color: t.fgDim }]}>optional</Text> : null}
    </View>
  );
}

function ActionButton({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.actionBtn, { borderColor: color }]}
    >
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { paddingHorizontal: 14, paddingTop: 12, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  stepper: { gap: 8, paddingVertical: 2 },
  chip: { minWidth: 84, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  chipGlyph: { fontSize: 15 },
  chipName: { fontSize: 12, fontWeight: '600' },
  chipOpt: { fontSize: 9.5 },
  heading: { fontSize: 10.5, letterSpacing: 1.1, fontWeight: '700', marginTop: 4 },
  card: { padding: 13, gap: 6 },
  cardLabel: { fontSize: 10, letterSpacing: 1.1, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  gateOk: { fontSize: 12.5, fontWeight: '600' },
  unmetList: { gap: 6, marginTop: 2 },
  unmetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unmetDot: { width: 6, height: 6, borderRadius: 3 },
  unmetText: { flex: 1, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1,
  },
  actionText: { fontSize: 13.5, fontWeight: '700' },
  streamCard: { padding: 12, gap: 5 },
  streamTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streamName: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  streamMeta: { fontSize: 11.5 },
  line: { fontSize: 12.5, lineHeight: 18 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
