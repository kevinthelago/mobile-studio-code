import React, { useCallback } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTunnel } from '../../lib/TunnelContext';
import { PaneState, PaneStatus } from '../../lib/types';
import { useTheme } from '../../theme';

function dotColor(status: PaneStatus): string {
  switch (status) {
    case 'running': return '#4ade80';
    case 'awaiting_input': return '#fbbf24';
    case 'error': return '#f87171';
    default: return 'rgba(255,255,255,0.28)';
  }
}

function Chip({
  pane, active, onPress,
}: { pane: PaneState; active: boolean; onPress: () => void }) {
  const t = useTheme();
  const status = pane.sessionState?.status ?? pane.descriptor.status;
  const name = pane.descriptor.name || pane.descriptor.id;
  const waiting = pane.hasUserRequest;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active
            ? `${t.accent}28`
            : t.glass ? 'rgba(255,255,255,0.07)' : t.surface,
          borderColor: waiting ? '#fbbf24' : active ? t.accent : t.borderColor,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor(status) }]} />
      <Text
        style={[styles.chipLabel, { color: active ? t.accent : t.fg, fontFamily: t.fontMono }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {waiting && <View style={styles.alertPip} />}
    </Pressable>
  );
}

/**
 * Persistent horizontal strip of session chips pinned below the status bar on
 * every tab. Renders as an absolute overlay so it does not affect existing
 * tab-screen layouts. Hidden when the tunnel is disconnected or has no panes.
 */
export function SessionStrip() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connectionState, panes, activePaneId, orderedPaneIds, focusPane } = useTunnel();

  if (connectionState !== 'connected' || orderedPaneIds.length === 0) return null;

  const handleChipPress = (paneId: string) => {
    focusPane(paneId);
    router.navigate('/(tabs)/run' as never);
  };

  const STRIP_H = 40;

  return (
    // absoluteFill overlay — box-none so taps fall through to content beneath
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={[styles.bar, { top: insets.top, height: STRIP_H }]}
        pointerEvents="auto"
      >
        {t.glass ? (
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 100}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.surface }]} />
        )}
        {/* subtle top highlight to lift the strip off content */}
        <View style={[styles.topHighlight, { backgroundColor: t.borderColor }]} />
        {/* bottom hairline border */}
        <View style={[styles.bottomBorder, { backgroundColor: t.borderColor }]} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          {orderedPaneIds.map((id) => {
            const pane = panes[id];
            if (!pane) return null;
            return (
              <Chip
                key={id}
                pane={pane}
                active={id === activePaneId}
                onPress={() => handleChipPress(id)}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth,
  },
  bottomBorder: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 10, gap: 6, alignItems: 'center',
    paddingVertical: 5,
  },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 11, fontWeight: '500', maxWidth: 100 },
  alertPip: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#fbbf24',
  },
});
