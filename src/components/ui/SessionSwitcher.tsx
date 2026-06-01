import React, { useMemo } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTunnel } from '../../lib/TunnelContext';
import { PaneState, PaneStatus } from '../../lib/types';
import { useTheme } from '../../theme';
import { hexAlpha } from '../../lib/color';
import { Tag } from './Tag';
import { Btn } from './Btn';

// Session-switcher drawer — the redesign's hub for the multi-session model
// (design/msc-redesign/.../screen-session-switcher.jsx). Opened from the
// SessionStrip's ▦ button. Drops from the top as a sheet, groups the live PTY
// panes by project (cwd basename), and focuses a pane on tap. Settings lives in
// the header so it stays reachable even when no sessions are connected.

function statusKey(s: PaneStatus): 'running' | 'idle' | 'warn' | 'err' {
  if (s === 'awaiting_input') return 'warn';
  if (s === 'error') return 'err';
  if (s === 'idle') return 'idle';
  return 'running';
}

function projectOf(pane: PaneState): string {
  const cwd = pane.descriptor.cwd || '';
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'workspace';
}

function relativeTime(ts: number | null): string {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function SessionRow({
  pane, active, onPress,
}: { pane: PaneState; active: boolean; onPress: () => void }) {
  const t = useTheme();
  const status = pane.sessionState?.status ?? pane.descriptor.status;
  const key = statusKey(status);
  const dotColor = key === 'warn' ? t.warn : key === 'err' ? t.danger : key === 'idle' ? t.fgDim : t.success;
  const task = pane.sessionState?.currentTask?.trim();
  const name = pane.descriptor.name || pane.descriptor.id;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: t.borderColor,
          borderLeftColor: active ? t.accent : 'transparent',
          backgroundColor: active ? hexAlpha(t.accent, 0.08) : pressed ? t.elev : 'transparent',
          paddingLeft: active ? 14 : 16,
        },
      ]}
    >
      <View style={[styles.rowDot, { backgroundColor: dotColor }]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text
            style={[styles.rowName, { color: active ? t.accent : t.fg, fontFamily: t.fontMono }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {pane.hasUserRequest && <Tag variant="warn" fontSize={8.5}>input</Tag>}
        </View>
        {task ? (
          <Text style={[styles.rowTask, { color: t.fgMuted }]} numberOfLines={1}>{task}</Text>
        ) : (
          <Text style={[styles.rowNoTask, { color: t.fgDim, fontFamily: t.fontMono }]}>no current task</Text>
        )}
      </View>
      <Text style={[styles.rowTime, { color: t.fgDim, fontFamily: t.fontMono }]}>
        {relativeTime(pane.lastActivityAt)}
      </Text>
      <Text style={[styles.chev, { color: t.fgDim, fontFamily: t.fontMono }]}>›</Text>
    </Pressable>
  );
}

export function SessionSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connectionState, panes, orderedPaneIds, activePaneId, focusPane, disconnect } = useTunnel();

  const ordered = useMemo(
    () => orderedPaneIds.map((id) => panes[id]).filter(Boolean) as PaneState[],
    [orderedPaneIds, panes],
  );

  const groups = useMemo(() => {
    const map = new Map<string, PaneState[]>();
    for (const p of ordered) {
      const proj = projectOf(p);
      const arr = map.get(proj) ?? [];
      arr.push(p);
      map.set(proj, arr);
    }
    return [...map.entries()];
  }, [ordered]);

  const counts = useMemo(() => {
    let awaiting = 0, running = 0, idle = 0;
    for (const p of ordered) {
      const s = p.sessionState?.status ?? p.descriptor.status;
      if (p.hasUserRequest || s === 'awaiting_input') awaiting += 1;
      else if (s === 'idle') idle += 1;
      else running += 1;
    }
    return { all: ordered.length, awaiting, running, idle };
  }, [ordered]);

  const handleRow = (id: string) => {
    focusPane(id);
    onClose();
    router.navigate('/(tabs)/run' as never);
  };

  const openSettings = () => {
    onClose();
    router.navigate('/settings' as never);
  };

  const connLabel = connectionState === 'connected' ? 'connected'
    : connectionState === 'connecting' || connectionState === 'authenticating' ? 'connecting…'
    : 'offline';

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* scrim — tap to dismiss */}
      <Pressable style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={onClose} />

      <View style={[styles.sheet, {
        backgroundColor: t.surfaceSolid, borderBottomColor: t.borderColor, paddingTop: insets.top,
      }]}>
        <View style={styles.grabberWrap}>
          <View style={[styles.grabber, { backgroundColor: t.borderStrong }]} />
        </View>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: t.borderColor }]}>
          <Text style={[styles.headerTitle, { color: t.fg, fontFamily: t.fontMono }]}>Sessions</Text>
          <Text style={[styles.headerSub, { color: t.fgDim, fontFamily: t.fontMono }]}>{connLabel}</Text>
          <View style={styles.flex1} />
          <Btn variant="ghost" size="sm" onPress={openSettings}>▦ settings</Btn>
          {connectionState === 'connected' && (
            <Btn variant="ghost" size="sm" onPress={() => { disconnect(); onClose(); }}>disconnect</Btn>
          )}
        </View>

        {/* Filter / count row */}
        {ordered.length > 0 && (
          <View style={[styles.filterRow, { borderBottomColor: t.borderColor }]}>
            <Tag variant="amber">all · {counts.all}</Tag>
            {counts.awaiting > 0 && <Tag variant="warn">awaiting · {counts.awaiting}</Tag>}
            <Tag>running · {counts.running}</Tag>
            <Tag>idle · {counts.idle}</Tag>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {ordered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: t.fgDim, fontFamily: t.fontMono }]}>
                {connectionState === 'connected'
                  ? 'No active sessions.\nStart a Claude session in base-studio-code.'
                  : 'Not connected.\nPair a desktop from the Run or Plan tab.'}
              </Text>
            </View>
          ) : (
            groups.map(([proj, items]) => (
              <View key={proj}>
                <View style={styles.groupLabel}>
                  <Text style={[styles.groupText, { color: t.fgDim, fontFamily: t.fontMono }]}>{proj}</Text>
                  <Text style={[styles.groupCount, { color: t.fgMuted, fontFamily: t.fontMono }]}>· {items.length}</Text>
                </View>
                {items.map((p) => (
                  <SessionRow
                    key={p.descriptor.id}
                    pane={p}
                    active={p.descriptor.id === activePaneId}
                    onPress={() => handleRow(p.descriptor.id)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>

        {/* Footer hint */}
        <View style={[styles.footer, { borderTopColor: t.borderColor, backgroundColor: t.bg }]}>
          <Text style={[styles.footerText, { color: t.fgDim, fontFamily: t.fontMono }]}>
            tap a session to focus it on the Run tab
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', left: 0, right: 0, top: 0,
    maxHeight: '88%',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  grabberWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  grabber: { width: 36, height: 4, borderRadius: 99 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 13, fontWeight: '600' },
  headerSub: { fontSize: 10 },

  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  scroll: { flexShrink: 1 },
  groupLabel: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
  },
  groupText: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  groupCount: { fontSize: 10 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 2,
  },
  rowDot: { width: 7, height: 7, borderRadius: 3.5 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  rowTask: { fontSize: 11.5, marginTop: 3 },
  rowNoTask: { fontSize: 10, marginTop: 3 },
  rowTime: { fontSize: 10 },
  chev: { fontSize: 11 },

  empty: { padding: 28, alignItems: 'center' },
  emptyText: { fontSize: 11.5, textAlign: 'center', lineHeight: 18 },

  footer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { fontSize: 10 },
});
