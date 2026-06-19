import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';

// A device-in-device preview of a generated screen. The inner screen is the
// light-themed product being built (mock); the command bar is AI-driven and
// user-tappable. Scaffold — the live render comes with the real pipeline.
export function PreviewTab() {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.deviceWrap}>
        <View style={styles.device}>
          <View style={styles.gen}>
            <View style={styles.genLogo} />
            <Text style={styles.genTitle}>Build your streak</Text>
            <Text style={styles.genSub}>Create an account to start tracking daily habits.</Text>
            <View style={styles.genForm}>
              <View style={styles.genInput}><Text style={styles.genInputText}>Email</Text></View>
              <View style={styles.genInput}><Text style={styles.genInputText}>Password</Text></View>
              <View style={styles.genCta}><Text style={styles.genCtaText}>Create account</Text></View>
            </View>
            <Text style={styles.genFoot}>Already have one? <Text style={styles.genFootLink}>Sign in</Text></Text>
          </View>
        </View>
      </View>

      <View style={styles.caption}>
        <Text style={[styles.captionText, { color: t.fgMuted, fontFamily: t.fontMono }]}>Screen 3 of 6 · Sign up</Text>
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.dot, { width: i === 2 ? 16 : 6, backgroundColor: i === 2 ? t.accent : t.borderColor }]} />
          ))}
        </View>
      </View>

      <Surface style={styles.commandBar} radius={6}>
        {[
          <Path key="p" d="M9 3L4 7.5 9 12" />,
          <Path key="n" d="M5 3l5 4.5L5 12" />,
          <G key="r"><Path d="M3 7.5a4.5 4.5 0 104.5-4.5" /><Path d="M7.5 0.5L7.5 3 5 3" /></G>,
        ].map((ic, i) => (
          <Pressable key={i} style={[styles.cmdBtn, { backgroundColor: t.surface, borderColor: t.borderColor }]}>
            <Svg width={15} height={15} viewBox="0 0 14 14" fill="none" stroke={t.fg} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{ic}</Svg>
          </Pressable>
        ))}
        <Pressable style={[styles.cmdConfirm, { backgroundColor: t.accent }]}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M3 7l2.5 2.5L11 4" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.cmdConfirmText}>Confirm</Text>
        </Pressable>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 8, alignItems: 'center' },
  deviceWrap: { alignItems: 'center', marginTop: 8 },
  device: { width: 208, height: 410, borderRadius: 30, backgroundColor: '#faf9f6', borderWidth: 6, borderColor: '#23262d', overflow: 'hidden' },
  gen: { flex: 1, padding: 20, paddingTop: 26 },
  genLogo: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#1a1a1a', marginBottom: 22 },
  genTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: '#1a1a1a' },
  genSub: { fontSize: 12.5, color: '#7a7a7a', marginTop: 6, lineHeight: 17 },
  genForm: { marginTop: 22, gap: 10 },
  genInput: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#e2e0da', justifyContent: 'center', paddingHorizontal: 12 },
  genInputText: { fontSize: 12, color: '#9a9a9a' },
  genCta: { height: 42, borderRadius: 10, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  genCtaText: { color: '#fff', fontSize: 13.5, fontWeight: '600' },
  genFoot: { textAlign: 'center', fontSize: 11.5, color: '#9a9a9a', marginTop: 18 },
  genFootLink: { color: '#1a1a1a', fontWeight: '600' },

  caption: { alignItems: 'center', marginTop: 16 },
  captionText: { fontSize: 11 },
  dots: { flexDirection: 'row', gap: 5, marginTop: 8 },
  dot: { height: 6, borderRadius: 3 },

  commandBar: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, marginTop: 18, width: '100%' },
  cmdBtn: { flex: 1, height: 38, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  cmdConfirm: { flex: 2, height: 38, borderRadius: 4, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  cmdConfirmText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
