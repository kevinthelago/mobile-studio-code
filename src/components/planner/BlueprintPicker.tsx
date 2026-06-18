import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { PLAN_COLORS } from '../../lib/planner/colors';
import { makeBlueprints, enabledSections, type Blueprint } from '../../lib/planner/core';

/** Pick a blueprint to start a local plan. The list is the ported makeBlueprints();
 *  each card previews the blueprint's enabled sections (glyphs) — fully data-driven. */
export function BlueprintPicker({
  onPick, onEdit,
}: {
  onPick: (bp: Blueprint) => void;
  onEdit?: (bp: Blueprint) => void;
}) {
  const t = useTheme();
  const blueprints = useMemo(() => makeBlueprints(), []);

  return (
    <View style={styles.list}>
      {blueprints.map((bp) => {
        const sections = enabledSections(bp.sections);
        return (
          <Pressable key={bp.id} onPress={() => onPick(bp)}>
            <Surface style={styles.card} radius={16}>
              <View style={styles.headerRow}>
                <Text style={[styles.name, { color: t.fg }]}>{bp.name}</Text>
                <View style={[styles.countPill, { borderColor: t.borderColor }]}>
                  <Text style={[styles.countText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                    {sections.length} sections
                  </Text>
                </View>
              </View>
              <Text style={[styles.desc, { color: t.fgMuted }]}>{bp.desc}</Text>
              <View style={styles.glyphRow}>
                {sections.map((s) => (
                  <View key={s.key} style={styles.glyphChip}>
                    <Text style={[styles.glyph, { color: PLAN_COLORS.plan }]}>{s.glyph}</Text>
                    <Text style={[styles.glyphLabel, { color: t.fgDim }]} numberOfLines={1}>{s.name}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.cta}>
                <Pressable onPress={() => onPick(bp)} style={styles.ctaBtn}>
                  <Text style={[styles.ctaText, { color: t.accent }]}>Start planning</Text>
                  <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                    <Path d="M3.5 2.5l4 3.5-4 3.5" stroke={t.accent} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Pressable>
                {onEdit && (
                  <Pressable onPress={() => onEdit(bp)} style={[styles.editBtn, { borderColor: t.borderColor }]}>
                    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                      <Path d="M8 2l2 2-6 6H2V8z" stroke={t.fgMuted} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.editText, { color: t.fgMuted }]}>Edit</Text>
                  </Pressable>
                )}
              </View>
            </Surface>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { padding: 16, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  countPill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontSize: 10.5 },
  desc: { fontSize: 13, lineHeight: 18 },
  glyphRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  glyphChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  glyph: { fontSize: 13 },
  glyphLabel: { fontSize: 11 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ctaText: { fontSize: 13, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  editText: { fontSize: 11.5, fontWeight: '500' },
});
