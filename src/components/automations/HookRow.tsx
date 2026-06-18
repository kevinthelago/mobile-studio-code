import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';

/** Hook analytics entry — populated from A1 frames once that stream lands. */
export type HookAnalyticsEntry = {
  name: string;
  triggerCount: number;
  lastTriggered: string | null;
  recentSuccess: number;
  recentFailed: number;
};

type Props = { entry: HookAnalyticsEntry };

function formatLast(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function HookRow({ entry }: Props) {
  const t = useTheme();
  const total = entry.recentSuccess + entry.recentFailed;
  const rate = total > 0 ? Math.round((entry.recentSuccess / total) * 100) : null;

  return (
    <Surface style={styles.row} soft>
      <View style={styles.left}>
        <Text style={[styles.name, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={[styles.sub, { color: t.fgDim }]}>
          {entry.triggerCount} triggers · last {formatLast(entry.lastTriggered)}
        </Text>
      </View>
      {rate !== null ? (
        <View style={styles.rateWrap}>
          <Text style={[styles.rate, { color: rate >= 80 ? '#4ade80' : rate >= 50 ? '#fbbf24' : '#f87171' }]}>
            {rate}%
          </Text>
          <Text style={[styles.rateLabel, { color: t.fgDim }]}>success</Text>
        </View>
      ) : (
        <Text style={[styles.rateLabel, { color: t.fgDim }]}>no runs</Text>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, marginBottom: 8,
  },
  left: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 12.5, fontWeight: '600' },
  sub: { fontSize: 11 },
  rateWrap: { alignItems: 'flex-end' },
  rate: { fontSize: 16, fontWeight: '700' },
  rateLabel: { fontSize: 10, letterSpacing: 0.5 },
});
