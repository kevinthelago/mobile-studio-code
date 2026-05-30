import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';

// The Plan tab is the mobile face of the project-planning surface that lives
// on the paired desktop (base-studio-code). When the tunnel is connected this
// screen will mirror the desktop's planning views — projects, kanban board,
// issue + AI subtask breakdown, scoping session, pairing. See
// design/msc-redesign/.../screen-plan.jsx for the target. This placeholder is
// the stub for that work.
const TAB_BAR_HEIGHT = 60;
const STRIP_HEIGHT = 40;

export default function PlanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { connectionState } = useTunnel();
  const isConnected = connectionState === 'connected';

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + STRIP_HEIGHT + 12,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 12,
        },
      ]}
    >
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: t.elev, borderColor: t.borderColor }]}>
          <Svg width={28} height={28} viewBox="0 0 20 20" fill="none">
            <Rect x={3} y={4} width={14} height={12} rx={2} stroke={t.accent} strokeWidth={1.6} />
            <Path d="M3 8h14" stroke={t.accent} strokeWidth={1.6} />
            <Path d="M8 8v8M12 8v8" stroke={t.accent} strokeWidth={1.6} />
          </Svg>
        </View>

        <Text style={[styles.title, { color: t.fg, fontFamily: t.fontMono }]}>Plan</Text>

        {isConnected ? (
          <>
            <Text style={[styles.body, { color: t.fgMuted }]}>
              Projects, kanban, issues, and live planning will mirror here from
              base-studio-code over the tunnel.
            </Text>
            <Text style={[styles.meta, { color: t.fgDim, fontFamily: t.fontMono }]}>
              coming soon
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: t.fgMuted }]}>
              The Plan view is tunneled from base-studio-code on your desktop.
              Open the Run tab to pair, then return here.
            </Text>
            <View style={[styles.tunnelChip, {
              backgroundColor: t.elev,
              borderColor: t.borderColor,
            }]}>
              <View style={[styles.dot, { backgroundColor: t.warn }]} />
              <Text style={[styles.chipText, { color: t.warn, fontFamily: t.fontMono }]}>
                tunnel offline
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 280 },
  meta: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.08 * 10 / 10, marginTop: 6 },
  tunnelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 10 },
});
