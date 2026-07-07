import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { useAlerts } from '../../lib/alerts/AlertsContext';
import { openAlertsInbox } from '../../lib/alerts/nav';

function connectionColor(state: string, accent: string): string {
  switch (state) {
    case 'connected': return '#4ade80';
    case 'connecting':
    case 'authenticating': return '#fbbf24';
    case 'error': return '#f87171';
    default: return accent; // disconnected → muted handled by caller
  }
}

/**
 * Shared tab-page header: title + subtitle on the left, an optional action
 * pill, the connection dot and the "More" corner (gear → pairing / providers /
 * theme / security) on the right. Every mirror tab renders this so the More
 * corner is always one tap away (#218).
 */
export function ScreenHeader({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  /** Optional header action pill (e.g. Glance's "Sessions" → the roster, #219). */
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { connectionState } = useTunnel();
  const { unread } = useAlerts();
  const connected = connectionState === 'connected';
  const dot = connected || connectionState === 'connecting' || connectionState === 'authenticating' || connectionState === 'error'
    ? connectionColor(connectionState, t.accent)
    : t.fgDim;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: t.borderColor }]}>
      <View style={styles.text}>
        <Text style={[styles.title, { color: t.fg }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.fgDim }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {action && (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={[styles.actionPill, { borderColor: t.borderColor }]}
        >
          <Text style={[styles.actionLabel, { color: t.accent }]}>{action.label}</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => router.push('/(more)/connection')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Connection: ${connectionState}`}
        style={styles.dotWrap}
      >
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </Pressable>

      <Pressable
        onPress={openAlertsInbox}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}
        style={[styles.gear, { borderColor: t.borderColor }]}
      >
        <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
          <Path
            d="M10 3a4 4 0 0 0-4 4c0 3-1 4.5-2 5.5h12c-1-1-2-2.5-2-5.5a4 4 0 0 0-4-4Z"
            stroke={t.fgMuted} strokeWidth={1.5} strokeLinejoin="round"
          />
          <Path d="M8.5 15.5a1.5 1.5 0 0 0 3 0" stroke={t.fgMuted} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: '#f87171', borderColor: t.bg }]}>
            <Text style={styles.badgeText} numberOfLines={1}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.push('/(more)/more')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="More"
        style={[styles.gear, { borderColor: t.borderColor }]}
      >
        <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
          <Circle cx={10} cy={10} r={2.6} stroke={t.fgMuted} strokeWidth={1.5} />
          <Path
            d="M10 2.8v2M10 15.2v2M17.2 10h-2M4.8 10h-2M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4M15.1 15.1l-1.4-1.4M6.3 6.3L4.9 4.9"
            stroke={t.fgMuted} strokeWidth={1.5} strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '600' },
  subtitle: { fontSize: 11.5 },
  actionPill: {
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 15, borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { fontSize: 12.5, fontWeight: '600' },
  dotWrap: { padding: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  gear: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8, borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
});
