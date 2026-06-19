import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import type { PaneStatus } from '../../lib/types';

function WorkerTag({
  children, color, dot,
}: { children: React.ReactNode; color: string; dot?: string }) {
  const t = useTheme();
  return (
    <View style={[tagStyles.tag, { borderColor: t.borderColor }]}>
      {dot ? <View style={[tagStyles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[tagStyles.text, { color, fontFamily: t.fontMono }]}>{children}</Text>
    </View>
  );
}

const tagStyles = StyleSheet.create({
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    height: 20, paddingHorizontal: 7, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },
});

/** Fleet worker data shape — derived from PaneState until F2 (desktop-emit) lands. */
export type FleetWorkerData = {
  paneId: string;
  stream: string;
  status: PaneStatus;
  currentTask: string;
  lastActivityAt: number | null;
  hasUserRequest: boolean;
  userRequestPrompt: string | null;
  /** Populated once tunnel-base F2 lands; null until then. */
  repo: string | null;
  branch: string | null;
  prNumber: number | null;
  ciStatus: 'pending' | 'passing' | 'failing' | null;
};

type Props = {
  worker: FleetWorkerData;
  onPress: () => void;
  onWake?: () => void;
};

function dotColor(status: PaneStatus): string {
  switch (status) {
    case 'running': return '#4ade80';
    case 'idle': return 'rgba(255,255,255,0.25)';
    case 'awaiting_input': return '#fbbf24';
    case 'error': return '#f87171';
  }
}

function ciColor(ci: FleetWorkerData['ciStatus']): string {
  switch (ci) {
    case 'passing': return '#4ade80';
    case 'failing': return '#f87171';
    default: return '#fbbf24';
  }
}

function relativeTime(ts: number | null): string {
  if (ts === null) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function WorkerCard({ worker, onPress, onWake }: Props) {
  const t = useTheme();
  const dot = dotColor(worker.status);
  const isIdle = worker.status === 'idle';
  const isAwaiting = worker.status === 'awaiting_input' || worker.hasUserRequest;
  const elapsed = relativeTime(worker.lastActivityAt);

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <Surface style={[styles.card, isAwaiting && { borderColor: '#fbbf24' }]}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={[styles.stream, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
              {worker.stream}
            </Text>
            {worker.prNumber !== null && (
              <WorkerTag color={t.fgMuted}>#{worker.prNumber}</WorkerTag>
            )}
            {worker.ciStatus !== null && (
              <WorkerTag dot={ciColor(worker.ciStatus)} color={ciColor(worker.ciStatus)}>
                {worker.ciStatus}
              </WorkerTag>
            )}
            {worker.hasUserRequest && (
              <WorkerTag dot="#fbbf24" color="#fbbf24">input needed</WorkerTag>
            )}
          </View>
          {worker.branch !== null ? (
            <Text style={[styles.meta, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
              {worker.branch}
            </Text>
          ) : worker.currentTask ? (
            <Text style={[styles.meta, { color: t.fgMuted }]} numberOfLines={1}>
              {worker.currentTask}
            </Text>
          ) : null}
        </View>
        <View style={styles.aside}>
          {elapsed ? (
            <Text style={[styles.time, { color: t.fgDim }]}>{elapsed}</Text>
          ) : null}
          {isIdle && onWake ? (
            <Pressable onPress={onWake} hitSlop={6} style={[styles.wakeBtn, { borderColor: t.accent }]}>
              <Text style={[styles.wakeBtnText, { color: t.accent }]}>Wake</Text>
            </Pressable>
          ) : (
            <Svg width={13} height={13} viewBox="0 0 14 14" fill="none">
              <Path d="M5 3l4 4-4 4" stroke={t.fgDim} strokeWidth={1.4} strokeLinecap="round" />
            </Svg>
          )}
        </View>
      </Surface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  stream: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  meta: { fontSize: 11.5 },
  aside: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  time: { fontSize: 10.5 },
  wakeBtn: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  wakeBtnText: { fontSize: 11.5, fontWeight: '600' },
});
