import React, { useState } from 'react';
import {
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, G } from 'react-native-svg';
import { useTheme } from '../../theme';
import { PLAN_COLORS, PLAN_GRADIENT } from '../../lib/planner/colors';
import { LinearGradient } from 'expo-linear-gradient';

const ROWS: { key: 'save' | 'switch'; icon: React.ReactNode; title: string; detail: string }[] = [
  { key: 'save', icon: <G><Path d="M4 3h7l3 3v9H4z" /><Path d="M4 8h10" /></G>, title: 'Save & exit', detail: 'Keep draft, leave session' },
  { key: 'switch', icon: <G><Path d="M3 5h12M7 5V3.5h4V5M5 5l.7 9h6.6L13 5" /></G>, title: 'Switch blueprint', detail: 'Pick a different blueprint' },
];

export function OverflowMenu({
  onClose, onPublish, onSaveExit, onSwitchBlueprint, onClear,
}: {
  onClose: () => void;
  onPublish?: () => void;
  onSaveExit?: () => void;
  onSwitchBlueprint?: () => void;
  onClear?: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, {
        backgroundColor: t.surfaceSolid ?? t.surface,
        borderTopColor: t.borderColor,
        paddingBottom: insets.bottom + 24,
      }]}>
        <View style={[styles.grabber, { backgroundColor: t.borderColor }]} />

        <Pressable onPress={onPublish} style={styles.publishWrap}>
          <LinearGradient colors={[...PLAN_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.publish}>
            <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
              <Path d="M3 9h12M11 5l4 4-4 4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <View>
              <Text style={styles.publishTitle}>Sync to GitHub</Text>
              <Text style={[styles.publishSub, { fontFamily: t.fontMono }]}>publish milestones, issues & fleet</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {ROWS.map((r) => (
          <Pressable
            key={r.title}
            onPress={() => { (r.key === 'save' ? onSaveExit : onSwitchBlueprint)?.(); }}
            style={[styles.row, { backgroundColor: t.surface, borderColor: t.borderColor }]}
          >
            <Svg width={17} height={17} viewBox="0 0 18 18" fill="none" stroke={t.fgMuted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{r.icon}</Svg>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: t.fg }]}>{r.title}</Text>
              <Text style={[styles.rowDetail, { color: t.fgDim, fontFamily: t.fontMono }]}>{r.detail}</Text>
            </View>
          </Pressable>
        ))}

        <View style={[styles.divider, { backgroundColor: t.borderColor }]} />

        <Pressable
          onPress={() => (confirmClear ? onClear?.() : setConfirmClear(true))}
          style={[styles.clear, {
            borderColor: confirmClear ? PLAN_COLORS.bad : 'rgba(248,113,113,0.35)',
            backgroundColor: confirmClear ? 'rgba(248,113,113,0.12)' : 'transparent',
          }]}
        >
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path d="M3 4h10M6 4V2.5h4V4M5 4l.6 9h4.8L11 4" stroke={PLAN_COLORS.bad} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.clearText, { color: PLAN_COLORS.bad }]}>
            {confirmClear ? 'Tap again to clear the entire plan' : 'Clear plan'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', zIndex: 50 },
  sheet: { borderTopLeftRadius: 10, borderTopRightRadius: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  publishWrap: { marginBottom: 12 },
  publish: { height: 52, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  publishTitle: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  publishSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, marginTop: 1 },
  row: { height: 52, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, marginBottom: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowDetail: { fontSize: 10.5, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  clear: { height: 50, borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 14, fontWeight: '600' },
});
