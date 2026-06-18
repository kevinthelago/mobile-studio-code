import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ClaudeAvatar } from '../ui/ClaudeAvatar';
import { PLAN_COLORS, GRADE_COLOR, gradeBarColor } from '../../lib/planner/colors';
import { Grade } from '../../lib/planner/types';

const SEV_COLOR = { warn: PLAN_COLORS.warn, info: PLAN_COLORS.info, bad: PLAN_COLORS.bad };

export function GradeTab({ grade }: { grade: Grade }) {
  const t = useTheme();
  const ringColor = GRADE_COLOR[grade.letter[0]] ?? PLAN_COLORS.good;
  return (
    <View style={styles.root}>
      {/* hero */}
      <View style={styles.hero}>
        <View style={[styles.ring, { borderColor: ringColor }]}>
          <Text style={[styles.ringGrade, { color: ringColor, fontFamily: t.fontMono }]}>{grade.letter}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroPct, { color: t.fg }]}>{grade.pct}%</Text>
          <Text style={[styles.heroSummary, { color: t.fgMuted }]}>{grade.summary}</Text>
        </View>
      </View>

      {/* breakdown */}
      <Text style={[styles.eyebrow, { color: t.fgDim, fontFamily: t.fontMono }]}>Breakdown</Text>
      <View style={styles.bars}>
        {grade.categories.map((c) => {
          const col = gradeBarColor(c.pct);
          return (
            <View key={c.name} style={styles.barBlock}>
              <View style={styles.barHead}>
                <Text style={[styles.barName, { color: t.fg }]}>{c.name}</Text>
                <Text style={[styles.barPct, { color: col, fontFamily: t.fontMono }]}>{c.pct}%</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
                <View style={[styles.barFill, { width: `${c.pct}%`, backgroundColor: col }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* suggestions */}
      <Text style={[styles.eyebrow, { color: t.fgDim, fontFamily: t.fontMono }]}>Prioritized suggestions</Text>
      {grade.suggestions.map((s, i) => (
        <Surface key={i} style={styles.sugg} radius={6}>
          <View style={[styles.suggDot, { backgroundColor: SEV_COLOR[s.severity] }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.suggTitle, { color: t.fg }]}>{s.title}</Text>
            <Text style={[styles.suggDetail, { color: t.fgMuted }]}>{s.detail}</Text>
          </View>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path d="M6 4l4 4-4 4" stroke={t.fgDim} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Surface>
      ))}

      <View style={styles.applyWrap}>
        <PrimaryButton onPress={() => {}}>
          <ClaudeAvatar size={16} />
          <Text style={styles.applyText}>Apply all suggestions</Text>
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  ring: { width: 86, height: 86, borderRadius: 43, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  ringGrade: { fontSize: 26, fontWeight: '700' },
  heroPct: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  heroSummary: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  eyebrow: { fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600', marginBottom: 10 },
  bars: { marginBottom: 20 },
  barBlock: { marginBottom: 11 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barName: { fontSize: 13 },
  barPct: { fontSize: 11.5, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  sugg: { flexDirection: 'row', gap: 11, padding: 12, marginBottom: 8 },
  suggDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  suggTitle: { fontSize: 13.5, fontWeight: '500', lineHeight: 18 },
  suggDetail: { fontSize: 12, marginTop: 3 },

  applyWrap: { marginTop: 6 },
  applyText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
