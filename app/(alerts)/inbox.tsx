import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { Surface } from '../../src/components/ui/Surface';
import { ModalHeader } from '../../src/components/shell/ModalHeader';
import { useAlerts } from '../../src/lib/alerts/AlertsContext';
import { alertMeta, alertTarget, type AlertEvent } from '../../src/lib/alerts/model';
import { openAlertTarget } from '../../src/lib/alerts/nav';

/** Compact relative time for a row ("now", "4m", "2h", "3d"). Display-only. */
function ago(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 45) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function AlertRow({ alert, unread, now }: { alert: AlertEvent; unread: boolean; now: number }) {
  const t = useTheme();
  const meta = alertMeta(alert.kind);
  return (
    <Pressable onPress={() => openAlertTarget(alertTarget(alert))}>
      <Surface style={[styles.row, unread && { borderColor: meta.color }]} radius={8}>
        <Text style={[styles.glyph, { color: meta.color }]}>{meta.glyph}</Text>
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={[styles.rowTitle, { color: t.fg }]} numberOfLines={1}>{meta.title}</Text>
            <Text style={[styles.time, { color: t.fgDim }]}>{ago(alert.at, now)}</Text>
          </View>
          <Text style={[styles.rowDetail, { color: t.fgMuted }]} numberOfLines={2}>{alert.text}</Text>
          {alert.project ? (
            <Text style={[styles.context, { color: t.fgDim, fontFamily: t.fontMono }]} numberOfLines={1}>
              {alert.project}
            </Text>
          ) : null}
        </View>
        <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
          <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      </Surface>
    </Pressable>
  );
}

/**
 * Alerts inbox (#222) — the rolling list of everything the fleet needed the
 * user for (base-studio-code#2498's alert taxonomy), merged from the `alerts`
 * mirror domain + foreground FCM pushes, newest-first. Tap a row to deep-link
 * to its target (the paused session's chat, the Planner tab awaiting a
 * confirm, or here). Viewing marks everything read; "Clear read" hides what's
 * already been seen. The one place the mobile app is a control surface is via
 * these deep-links into the chat — the inbox itself is display-only.
 */
export default function AlertsInboxScreen() {
  const t = useTheme();
  const { connectionState } = useTunnel();
  const { alerts, readAt, synced, markAllRead, clearRead } = useAlerts();
  const now = Date.now();
  const connected = connectionState === 'connected';

  // Viewing the inbox marks everything read; re-runs as alerts arrive while
  // open (markAllRead is same-ref/no-op when nothing changed).
  useEffect(() => { markAllRead(); }, [markAllRead]);

  return (
    <View style={styles.root}>
      <ModalHeader title="Alerts" subtitle="What the fleet needed you for" />
      {alerts.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: t.fgDim }]}>
            {connected
              ? synced
                ? 'No alerts.\nYou’re all caught up.'
                : 'No alerts yet.'
              : 'Not connected.\nPair with base-studio-code to receive alerts.'}
          </Text>
          {!connected && (
            <Pressable
              onPress={() => router.push('/(more)/connection')}
              style={[styles.pairBtn, { borderColor: t.accent }]}
              accessibilityRole="button"
            >
              <Text style={[styles.pairBtnText, { color: t.accent }]}>Pair with desktop</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {alerts.map((a) => (
              <AlertRow key={a.id} alert={a} unread={a.at > readAt} now={now} />
            ))}
          </ScrollView>
          <Pressable onPress={clearRead} style={styles.clearBtn} accessibilityRole="button">
            <Text style={[styles.clearText, { color: t.fgMuted }]}>Clear read</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  pairBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  pairBtnText: { fontSize: 13, fontWeight: '600' },

  list: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  glyph: { fontSize: 15, fontWeight: '700', width: 16, textAlign: 'center', marginTop: 1 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  time: { fontSize: 10.5 },
  rowDetail: { fontSize: 11.5, lineHeight: 15 },
  context: { fontSize: 10.5, marginTop: 1 },

  clearBtn: { alignItems: 'center', paddingVertical: 12 },
  clearText: { fontSize: 12, fontWeight: '600' },
});
