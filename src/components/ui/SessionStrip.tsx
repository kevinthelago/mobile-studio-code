import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTunnel } from '../../lib/TunnelContext';
import { PaneState, PaneStatus } from '../../lib/types';
import { useTheme } from '../../theme';
import { hexAlpha } from '../../lib/color';
import { SessionSwitcher } from './SessionSwitcher';

function dotColor(status: PaneStatus, t: ReturnType<typeof useTheme>): string {
  switch (status) {
    case 'running': return t.success;
    case 'awaiting_input': return t.warn;
    case 'error': return t.danger;
    default: return t.fgDim;
  }
}

// Pulsing connection dot — port of the design's `.tunnel-dot` keyframe.
function TunnelDot() {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.tunnelDot, { backgroundColor: t.success, opacity: pulse }]} />;
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
          backgroundColor: active ? hexAlpha(t.accent, 0.16) : t.elev,
          borderColor: waiting ? t.warn : active ? t.accentDim : t.borderColor,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor(status, t) }]} />
      <Text
        style={[styles.chipLabel, { color: active ? t.accent : t.fgMuted, fontFamily: t.fontMono }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {waiting && <View style={[styles.alertPip, { backgroundColor: t.warn }]} />}
    </Pressable>
  );
}

/**
 * Persistent horizontal strip of session chips pinned below the status bar on
 * every tab. Renders as an absolute overlay so it does not affect existing
 * tab-screen layouts. The chips bar appears once the tunnel is connected with
 * panes; the ▦ button is always available and opens the session switcher (the
 * hub for focusing sessions and reaching Settings).
 */
export function SessionStrip() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connectionState, panes, activePaneId, orderedPaneIds, focusPane } = useTunnel();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const handleChipPress = (paneId: string) => {
    focusPane(paneId);
    router.navigate('/(tabs)/run' as never);
  };

  const STRIP_H = 40;
  const showChips = connectionState === 'connected' && orderedPaneIds.length > 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {showChips && (
        <View
          style={[styles.bar, { top: insets.top, height: STRIP_H, right: 44 }]}
          pointerEvents="auto"
        >
          {t.glass ? (
            <BlurView
              intensity={Platform.OS === 'ios' ? 50 : 100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: t.surfaceSolid }]} />
          )}
          <View style={[styles.topHighlight, { backgroundColor: t.borderColor }]} />
          <View style={[styles.bottomBorder, { backgroundColor: t.borderColor }]} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.scroll}
          >
            {/* Tunnel-connected indicator (design's .msc-strip-tunnel) */}
            <View style={[styles.tunnelChip, {
              backgroundColor: hexAlpha(t.success, 0.12),
              borderColor: hexAlpha(t.success, 0.35),
            }]}>
              <TunnelDot />
              <Text style={[styles.tunnelArrow, { color: t.success }]}>⇋</Text>
            </View>

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
      )}

      {/* ▦ — opens the session switcher (which also hosts the Settings entry) */}
      <Pressable
        onPress={() => setSwitcherOpen(true)}
        hitSlop={10}
        style={[styles.gearBtn, { top: insets.top + 4 }]}
        pointerEvents="auto"
        accessibilityRole="button"
        accessibilityLabel="Sessions and settings"
      >
        <Text style={[styles.gearGlyph, { color: t.fgMuted, fontFamily: t.fontMono }]}>▦</Text>
      </Pressable>

      <SessionSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
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

  tunnelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  tunnelDot: { width: 6, height: 6, borderRadius: 3 },
  tunnelArrow: { fontSize: 11, lineHeight: 13 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 11, fontWeight: '500', maxWidth: 100 },
  alertPip: {
    width: 5, height: 5, borderRadius: 3,
  },
  gearBtn: {
    position: 'absolute', right: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  gearGlyph: { fontSize: 18, lineHeight: 20 },
});
