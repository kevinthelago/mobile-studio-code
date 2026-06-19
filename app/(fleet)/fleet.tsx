import React, { useMemo } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { WorkerCard, type FleetWorkerData } from '../../src/components/fleet/WorkerCard';
import { CoordInboxCard } from '../../src/components/fleet/CoordInboxCard';
import type { PaneState } from '../../src/lib/types';

function SectionLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  const t = useTheme();
  return (
    <Text style={[{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' as const, fontWeight: '600' as const, color: t.fgDim }, style]}>
      {children}
    </Text>
  );
}

const TAB_BAR_HEIGHT = 60;

// ── Data derivation ───────────────────────────────────────────────────────────

/** Build a FleetWorkerData from the pane's runtime state. Fields that F2
 *  (tunnel-base desktop-emit) will eventually populate remain null until
 *  that stream lands. */
function paneToWorker(pane: PaneState): FleetWorkerData {
  return {
    paneId: pane.descriptor.id,
    stream: pane.descriptor.name || pane.descriptor.id,
    status: pane.sessionState?.status ?? pane.descriptor.status,
    currentTask: pane.sessionState?.currentTask ?? pane.descriptor.cwd ?? '',
    lastActivityAt: pane.lastActivityAt,
    hasUserRequest: pane.hasUserRequest,
    userRequestPrompt: pane.sessionState?.prompt ?? null,
    repo: null,
    branch: null,
    prNumber: null,
    ciStatus: null,
  };
}

// ── Empty / not-connected states ──────────────────────────────────────────────

function DisconnectedView() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.centered, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}>
      <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" style={styles.emptyIcon}>
        <Path
          d="M8 3H5a2 2 0 00-2 2v3M3 16v3a2 2 0 002 2h3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3"
          stroke={t.fgDim} strokeWidth={1.5} strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.emptyTitle, { color: t.fg }]}>Not connected</Text>
      <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
        Connect to base-studio-code on the Sessions tab to monitor your fleet.
      </Text>
    </View>
  );
}

function NoWorkersView() {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <Text style={[styles.emptyTitle, { color: t.fg }]}>No active workers</Text>
      <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
        Start a Claude Code session in base-studio-code to see it here.
      </Text>
    </View>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function FleetHeader({ workerCount }: { workerCount: number }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: t.borderColor }]}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
        <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
          <Path d="M9 3L5 7l4 4" stroke={t.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={[styles.backLabel, { color: t.accent }]}>Back</Text>
      </Pressable>
      <Text style={[styles.title, { color: t.fg }]}>Fleet</Text>
      {workerCount > 0 ? (
        <Text style={[styles.count, { color: t.fgDim }]}>{workerCount}</Text>
      ) : (
        <View style={styles.countPlaceholder} />
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FleetScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { connectionState, panes, orderedPaneIds, sendInput, focusPane } = useTunnel();

  const workers = useMemo(
    () => orderedPaneIds.map((id) => panes[id]).filter(Boolean).map(paneToWorker),
    [panes, orderedPaneIds],
  );

  const inbox = useMemo(
    () => workers.filter((w) => w.hasUserRequest || w.status === 'awaiting_input'),
    [workers],
  );

  const isDisconnected = connectionState === 'disconnected' || connectionState === 'error';

  function handleWorkerPress(worker: FleetWorkerData) {
    focusPane(worker.paneId);
    router.navigate('/(tabs)/run' as never);
  }

  function handleWake(worker: FleetWorkerData) {
    sendInput(worker.paneId, '\r');
  }

  function handleApprove(worker: FleetWorkerData, response: string) {
    sendInput(worker.paneId, `${response}\r`);
  }

  function handleDismiss(worker: FleetWorkerData) {
    // Dismiss clears the user-request highlight by sending a no-op — the pane
    // state will update once the desktop acknowledges. Until F1/A1 add a
    // dedicated dismiss frame, we send a blank line to move the agent forward.
    sendInput(worker.paneId, '\r');
  }

  if (isDisconnected) {
    return (
      <View style={[styles.root, { backgroundColor: 'transparent' }]}>
        <FleetHeader workerCount={0} />
        <DisconnectedView />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: 'transparent' }]}>
      <FleetHeader workerCount={workers.length} />

      {workers.length === 0 ? (
        <NoWorkersView />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Coordination inbox — visible only when workers need attention */}
          {inbox.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel style={styles.sectionLabel}>
                Inbox — {inbox.length} waiting
              </SectionLabel>
              {inbox.map((worker) => (
                <CoordInboxCard
                  key={worker.paneId}
                  worker={worker}
                  onApprove={(resp) => handleApprove(worker, resp)}
                  onDismiss={() => handleDismiss(worker)}
                />
              ))}
            </View>
          ) : null}

          {/* Full fleet roster */}
          <View style={styles.section}>
            <SectionLabel style={styles.sectionLabel}>
              Workers
            </SectionLabel>
            {workers.map((worker) => (
              <WorkerCard
                key={worker.paneId}
                worker={worker}
                onPress={() => handleWorkerPress(worker)}
                onWake={worker.status === 'idle' ? () => handleWake(worker) : undefined}
              />
            ))}
          </View>

          {/* Stale warning — shown when the most recently active worker hasn't
              been heard from in over 30 minutes (possible stall). */}
          {workers.length > 0 && allStale(workers) ? (
            <View style={[styles.staleNotice, { borderColor: t.borderColor }]}>
              <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
                <Path
                  d="M8 3a5 5 0 100 10A5 5 0 008 3zM8 6v3M8 10.5v.5"
                  stroke={t.fgDim} strokeWidth={1.5} strokeLinecap="round"
                />
              </Svg>
              <Text style={[styles.staleText, { color: t.fgDim }]}>
                No worker activity in 30+ min — sessions may have stalled.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

/** True when ALL workers have been inactive for 30+ minutes (or have no timestamp). */
function allStale(workers: FleetWorkerData[]): boolean {
  const STALE_MS = 30 * 60 * 1000;
  return workers.every(
    (w) => w.lastActivityAt === null || Date.now() - w.lastActivityAt > STALE_MS,
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 60 },
  backLabel: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700' },
  count: { fontSize: 13, minWidth: 60, textAlign: 'right' },
  countPlaceholder: { minWidth: 60 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionLabel: { marginBottom: 10 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  emptyIcon: { marginBottom: 16, opacity: 0.4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  staleNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 4,
  },
  staleText: { fontSize: 12, flex: 1, lineHeight: 17 },
});
