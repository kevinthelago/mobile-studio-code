import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { openSessionChat } from '../../lib/sessions/nav';

/** How long the toast stays up before auto-dismissing. */
const TOAST_MS = 8_000;
/** Clearance above the in-flow bottom tab bar (its height, sans safe area). */
const TAB_BAR_CLEARANCE = 60;

/**
 * Minimal in-app surfacing of a `user_request` (#219): when a desktop session
 * pauses for the user, a small banner appears above the tab bar linking to
 * that session's chat. Deliberately light — the full alerts inbox is #222;
 * this just makes sure the signal isn't dropped while the app is foregrounded
 * (the OS-level push is fired by the desktop).
 */
export function UserRequestToast() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { userRequestSignal, clearUserRequestSignal, panes } = useTunnel();

  // Auto-dismiss; re-arms whenever a newer request lands (keyed on `at`).
  useEffect(() => {
    if (!userRequestSignal) return;
    const timer = setTimeout(clearUserRequestSignal, TOAST_MS);
    return () => clearTimeout(timer);
  }, [userRequestSignal, clearUserRequestSignal]);

  if (!userRequestSignal) return null;

  const pane = panes[userRequestSignal.paneId];
  const name = pane?.descriptor.name || userRequestSignal.paneId;

  const open = () => {
    clearUserRequestSignal();
    openSessionChat(userRequestSignal.paneId);
  };

  return (
    <View
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
      pointerEvents="box-none"
    >
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${name} needs input`}>
        <View style={[styles.toast, { backgroundColor: t.surfaceSolid, borderColor: '#fbbf24' }]}>
          <Text style={styles.icon}>?</Text>
          <View style={styles.body}>
            <Text style={[styles.title, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
              {name} needs input
            </Text>
            <Text style={[styles.prompt, { color: t.fgMuted }]} numberOfLines={2}>
              {userRequestSignal.prompt}
            </Text>
          </View>
          <Pressable onPress={clearUserRequestSignal} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <Path d="M3 3l6 6M9 3l-6 6" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12, right: 12,
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 10, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icon: { color: '#fbbf24', fontWeight: '700', fontSize: 15 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 12.5, fontWeight: '600' },
  prompt: { fontSize: 11.5, lineHeight: 15 },
});
