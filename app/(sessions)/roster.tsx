import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { Surface } from '../../src/components/ui/Surface';
import { ModalHeader } from '../../src/components/shell/ModalHeader';
import { buildRoster, type RosterEntry } from '../../src/lib/sessions/roster';
import { openSessionChat } from '../../src/lib/sessions/nav';
import type { PaneStatus } from '../../src/lib/types';

function statusColor(status: PaneStatus): string {
  switch (status) {
    case 'running': return '#4ade80';
    case 'awaiting_input': return '#fbbf24';
    case 'error': return '#f87171';
    default: return 'rgba(255,255,255,0.28)';
  }
}

function SessionRow({ entry }: { entry: RosterEntry }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => openSessionChat(entry.paneId)}>
      <Surface style={[styles.row, entry.awaitingInput && { borderColor: '#fbbf24' }]} radius={8}>
        <View style={[styles.dot, { backgroundColor: statusColor(entry.status) }]} />
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={[styles.rowTitle, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
              {entry.name}
            </Text>
            {entry.awaitingInput && (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>input needed</Text>
              </View>
            )}
          </View>
          {entry.cwdHint ? (
            <Text style={[styles.rowDetail, { color: t.fgMuted }]} numberOfLines={1}>
              {entry.cwdHint}
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
 * Sessions roster (#219): every desktop session from pane_list, grouped by
 * kind (console / worker / planner / designer / triage). Tap a row → its
 * SessionChat — the one place mutations happen, by talking to the agent.
 */
export default function SessionsRosterScreen() {
  const t = useTheme();
  const { panes, connectionState } = useTunnel();
  const sections = useMemo(() => buildRoster(panes), [panes]);
  const connected = connectionState === 'connected';

  return (
    <View style={styles.root}>
      <ModalHeader title="Sessions" subtitle="Every desktop session · chat to act" />
      {sections.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: t.fgDim }]}>
            {connected
              ? 'No active sessions.\nStart an agent session in base-studio-code.'
              : 'Not connected.\nPair with base-studio-code to see its sessions here.'}
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
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sections.map((section) => (
            <View key={section.kind} style={styles.section}>
              <Text style={[styles.sectionHeading, { color: t.fgDim }]}>
                {section.title.toUpperCase()}
              </Text>
              {section.entries.map((entry) => (
                <SessionRow key={entry.paneId} entry={entry} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  pairBtn: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1,
  },
  pairBtnText: { fontSize: 13, fontWeight: '600' },

  list: { padding: 16, gap: 18 },
  section: { gap: 8 },
  sectionHeading: { fontSize: 10.5, letterSpacing: 1.2, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  rowDetail: { fontSize: 11.5 },
  requestBadge: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  requestBadgeText: { fontSize: 10, color: '#fbbf24', fontWeight: '600' },
});
