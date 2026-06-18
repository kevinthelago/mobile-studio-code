import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';

function AutoTag({
  children, color, dot,
}: { children: React.ReactNode; color: string; dot?: string }) {
  const t = useTheme();
  return (
    <View style={[autoTagStyles.tag, { borderColor: t.borderColor }]}>
      {dot ? <View style={[autoTagStyles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[autoTagStyles.text, { color, fontFamily: t.fontMono }]}>{children}</Text>
    </View>
  );
}

const autoTagStyles = StyleSheet.create({
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    height: 20, paddingHorizontal: 7, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },
});

/**
 * Automation entry — populated from A1/A2 tunnel frames once those streams land.
 * Until then, the screen will show an empty / stub state.
 */
export type AutomationEntry = {
  id: string;
  name: string;
  schedule: string;
  armed: boolean;
  nextRun: string | null;
  lastRun: {
    runId: string;
    startedAt: string;
    status: 'running' | 'success' | 'failed' | 'cancelled';
  } | null;
};

type Props = {
  entry: AutomationEntry;
  onArm: () => void;
  onDisarm: () => void;
  onRunNow: () => void;
};

type RunStatus = NonNullable<AutomationEntry['lastRun']>['status'];

function runStatusColor(status: RunStatus): string {
  switch (status) {
    case 'running': return '#fbbf24';
    case 'success': return '#4ade80';
    case 'failed': return '#f87171';
    case 'cancelled': return 'rgba(255,255,255,0.35)';
  }
}

function formatNextRun(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'overdue';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

export function AutomationCard({ entry, onArm, onDisarm, onRunNow }: Props) {
  const t = useTheme();
  const lastStatus = entry.lastRun?.status ?? null;

  return (
    <Surface style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{entry.name}</Text>
          <AutoTag
            dot={entry.armed ? '#4ade80' : 'rgba(255,255,255,0.25)'}
            color={entry.armed ? '#4ade80' : t.fgDim}
          >
            {entry.armed ? 'armed' : 'disarmed'}
          </AutoTag>
        </View>
        <Text style={[styles.schedule, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
          {entry.schedule}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: t.borderColor }]} />

      <View style={styles.row}>
        <View style={styles.metaCol}>
          <Text style={[styles.metaLabel, { color: t.fgDim }]}>Next run</Text>
          <Text style={[styles.metaValue, { color: t.fg }]}>{formatNextRun(entry.nextRun)}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={[styles.metaLabel, { color: t.fgDim }]}>Last run</Text>
          {lastStatus !== null ? (
            <AutoTag dot={runStatusColor(lastStatus)} color={runStatusColor(lastStatus)}>
              {lastStatus}
            </AutoTag>
          ) : (
            <Text style={[styles.metaValue, { color: t.fgDim }]}>never</Text>
          )}
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={onRunNow}
            hitSlop={6}
            style={[styles.actionBtn, { borderColor: t.accent }]}
          >
            <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
              <Path d="M3 2l7 4-7 4V2z" fill={t.accent} />
            </Svg>
            <Text style={[styles.actionText, { color: t.accent }]}>Run</Text>
          </Pressable>
          <Pressable
            onPress={entry.armed ? onDisarm : onArm}
            hitSlop={6}
            style={[styles.actionBtn, { borderColor: t.borderColor }]}
          >
            <Text style={[styles.actionText, { color: t.fgMuted }]}>
              {entry.armed ? 'Disarm' : 'Arm'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, marginBottom: 10 },
  top: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  schedule: { fontSize: 11.5 },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaCol: { gap: 3, minWidth: 64 },
  metaLabel: { fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
  metaValue: { fontSize: 13 },
  actions: { flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  actionText: { fontSize: 12, fontWeight: '600' },
});
