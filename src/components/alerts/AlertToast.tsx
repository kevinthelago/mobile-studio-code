import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { useAlerts } from '../../lib/alerts/AlertsContext';
import { alertMeta, alertTarget } from '../../lib/alerts/model';
import { openAlertTarget } from '../../lib/alerts/nav';

/** How long the toast stays up before auto-dismissing. */
const TOAST_MS = 8_000;
/** Clearance above the in-flow bottom tab bar (its height, sans safe area). */
const TAB_BAR_CLEARANCE = 60;

/** What the toast is currently showing, normalised across its two sources. */
type ActiveToast = {
  source: 'alert' | 'user_request';
  kind: string;
  title: string;
  body: string;
  paneId?: string;
  at: number;
};

/**
 * In-app alert banner (#222, generalising #219's UserRequestToast): one toast
 * above the tab bar for BOTH signal paths —
 * - the tunnel's live `user_request` (a session paused while we're connected),
 * - a foreground FCM alert push (any #2498 kind, incl. while disconnected).
 * The newer of the two wins (they can overlap: prompt-waiting is pushed over
 * FCM too). Tap deep-links per kind — the paused session's chat, the Planner
 * tab, or the inbox.
 */
export function AlertToast() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { userRequestSignal, clearUserRequestSignal, panes } = useTunnel();
  const { toast, dismissToast } = useAlerts();

  const active = useMemo<ActiveToast | null>(() => {
    const fromRequest: ActiveToast | null = userRequestSignal
      ? {
          source: 'user_request',
          kind: 'prompt-waiting',
          title: `${panes[userRequestSignal.paneId]?.descriptor.name || userRequestSignal.paneId} needs input`,
          body: userRequestSignal.prompt,
          paneId: userRequestSignal.paneId,
          at: userRequestSignal.at,
        }
      : null;
    const fromPush: ActiveToast | null = toast
      ? {
          source: 'alert',
          kind: toast.kind,
          title: toast.title || alertMeta(toast.kind).title,
          body: toast.body,
          paneId: toast.paneId,
          at: toast.at,
        }
      : null;
    if (fromRequest && fromPush) return fromPush.at >= fromRequest.at ? fromPush : fromRequest;
    return fromPush ?? fromRequest;
  }, [userRequestSignal, toast, panes]);

  const dismiss = () => {
    // Both sources may be live at once — a dismiss clears whichever are.
    if (userRequestSignal) clearUserRequestSignal();
    if (toast) dismissToast();
  };

  // Auto-dismiss; re-arms whenever a newer signal lands (keyed on `at`).
  const activeAt = active?.at;
  useEffect(() => {
    if (activeAt === undefined) return;
    const timer = setTimeout(dismiss, TOAST_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAt]);

  if (!active) return null;

  const meta = alertMeta(active.kind);

  const open = () => {
    dismiss();
    openAlertTarget(alertTarget(active));
  };

  return (
    <View
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
      pointerEvents="box-none"
    >
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={active.title}>
        <View style={[styles.toast, { backgroundColor: t.surfaceSolid, borderColor: meta.color }]}>
          <Text style={[styles.icon, { color: meta.color }]}>{meta.glyph}</Text>
          <View style={styles.body}>
            <Text style={[styles.title, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
              {active.title}
            </Text>
            {active.body ? (
              <Text style={[styles.prompt, { color: t.fgMuted }]} numberOfLines={2}>
                {active.body}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
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
  icon: { fontWeight: '700', fontSize: 15 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 12.5, fontWeight: '600' },
  prompt: { fontSize: 11.5, lineHeight: 15 },
});
