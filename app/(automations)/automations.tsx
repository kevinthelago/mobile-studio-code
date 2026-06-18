import React, { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { AutomationCard, type AutomationEntry } from '../../src/components/automations/AutomationCard';
import { HookRow, type HookAnalyticsEntry } from '../../src/components/automations/HookRow';

function SectionLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  const t = useTheme();
  return (
    <Text style={[{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' as const, fontWeight: '600' as const, color: t.fgDim }, style]}>
      {children}
    </Text>
  );
}

const TAB_BAR_HEIGHT = 60;
type TabId = 'schedules' | 'hooks';

// ── Stub data hook ─────────────────────────────────────────────────────────────

/**
 * Data hook for the automations screen. Returns empty until A1/A2 frames from
 * tunnel-mobile and tunnel-base land and populate this state via TunnelContext.
 *
 * Wire-up path: when A1 adds `automation_list` / `hook_analytics` to
 * TunnelServerMessage and TunnelContext exposes them, replace the empty arrays
 * below with the real data.
 */
function useAutomations(): {
  automations: AutomationEntry[];
  hookAnalytics: HookAnalyticsEntry[];
  hasData: boolean;
} {
  // A1/A2 not yet landed — always returns empty.
  return { automations: [], hookAnalytics: [], hasData: false };
}

// ── Empty / disconnected views ─────────────────────────────────────────────────

function DisconnectedView() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.centered, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}>
      <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" style={styles.emptyIcon}>
        <Path
          d="M12 3v1M12 20v1M4.22 4.22l.7.7M19.08 19.08l.7.7M3 12h1M20 12h1M4.22 19.78l.7-.7M19.08 4.92l.7-.7"
          stroke={t.fgDim} strokeWidth={1.5} strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.emptyTitle, { color: t.fg }]}>Not connected</Text>
      <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
        Connect to base-studio-code on the Sessions tab to monitor automations.
      </Text>
    </View>
  );
}

function NoDataView() {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <Text style={[styles.emptyTitle, { color: t.fg }]}>Automation data unavailable</Text>
      <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
        Requires base-studio-code with automation support.{'\n'}
        Check that your desktop is running a compatible version.
      </Text>
    </View>
  );
}

function NoAutomationsView() {
  const t = useTheme();
  return (
    <View style={styles.centeredInner}>
      <Text style={[styles.emptyBody, { color: t.fgDim }]}>
        No automations configured.{'\n'}
        Create schedules in base-studio-code.
      </Text>
    </View>
  );
}

function NoHooksView() {
  const t = useTheme();
  return (
    <View style={styles.centeredInner}>
      <Text style={[styles.emptyBody, { color: t.fgDim }]}>
        No hook activity recorded.
      </Text>
    </View>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  const t = useTheme();
  const tabs: { id: TabId; label: string }[] = [
    { id: 'schedules', label: 'Schedules' },
    { id: 'hooks', label: 'Hook Analytics' },
  ];
  return (
    <View style={[styles.tabBar, { borderBottomColor: t.borderColor }]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          onPress={() => onChange(tab.id)}
          style={[styles.tab, active === tab.id && [styles.activeTab, { borderBottomColor: t.accent }]]}
        >
          <Text style={[
            styles.tabLabel,
            { color: active === tab.id ? t.fg : t.fgMuted },
          ]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function AutomationsHeader() {
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
      <Text style={[styles.title, { color: t.fg }]}>Automations</Text>
      <View style={styles.headerRight} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AutomationsScreen() {
  const insets = useSafeAreaInsets();
  const { connectionState, sendInput, panes } = useTunnel();
  const { automations, hookAnalytics, hasData } = useAutomations();
  const [activeTab, setActiveTab] = useState<TabId>('schedules');

  const isDisconnected = connectionState === 'disconnected' || connectionState === 'error';

  if (isDisconnected) {
    return (
      <View style={styles.root}>
        <AutomationsHeader />
        <DisconnectedView />
      </View>
    );
  }

  if (!hasData) {
    return (
      <View style={styles.root}>
        <AutomationsHeader />
        <NoDataView />
      </View>
    );
  }

  // Automation actions send commands through the first available pane.
  // When A1 lands this will use a dedicated automation-runner pane ID instead.
  const controlPaneId = Object.keys(panes)[0] ?? null;

  function handleArm(id: string) {
    if (controlPaneId) sendInput(controlPaneId, `bsc-automation arm ${id}\r`);
  }

  function handleDisarm(id: string) {
    if (controlPaneId) sendInput(controlPaneId, `bsc-automation disarm ${id}\r`);
  }

  function handleRunNow(id: string) {
    if (controlPaneId) sendInput(controlPaneId, `bsc-automation run ${id}\r`);
  }

  return (
    <View style={styles.root}>
      <AutomationsHeader />
      <TabBar active={activeTab} onChange={setActiveTab} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'schedules' ? (
          <>
            <SectionLabel style={styles.sectionLabel}>
              Schedules — {automations.length}
            </SectionLabel>
            {automations.length === 0 ? (
              <NoAutomationsView />
            ) : (
              automations.map((entry) => (
                <AutomationCard
                  key={entry.id}
                  entry={entry}
                  onArm={() => handleArm(entry.id)}
                  onDisarm={() => handleDisarm(entry.id)}
                  onRunNow={() => handleRunNow(entry.id)}
                />
              ))
            )}
          </>
        ) : (
          <>
            <SectionLabel style={styles.sectionLabel}>
              Hook Analytics — {hookAnalytics.length}
            </SectionLabel>
            {hookAnalytics.length === 0 ? (
              <NoHooksView />
            ) : (
              hookAnalytics.map((entry) => (
                <HookRow key={entry.name} entry={entry} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 60 },
  backLabel: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700' },
  headerRight: { minWidth: 60 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12, paddingHorizontal: 4,
    marginRight: 20, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTab: {},
  tabLabel: { fontSize: 13.5, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: { marginBottom: 12 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  centeredInner: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  emptyIcon: { marginBottom: 16, opacity: 0.4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
});
