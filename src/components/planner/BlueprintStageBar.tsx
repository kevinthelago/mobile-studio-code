import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { PLAN_COLORS } from '../../lib/planner/colors';
import type { SectionRenderStatus } from '../../lib/planner/core';
import type { ProjectReadiness } from '../../lib/planner/project';

/** One segment per enabled section, status-colored, fill = gate fraction. The whole
 *  bar is derived from blueprint data via projectReadiness — no hardcoded stage list. */
export function BlueprintStageBar({
  readiness, activeKey, onSelectSection,
}: {
  readiness: ProjectReadiness;
  activeKey?: string | null;
  onSelectSection?: (key: string) => void;
}) {
  const t = useTheme();

  function color(status: SectionRenderStatus): string {
    switch (status) {
      case 'complete': return PLAN_COLORS.good;
      case 'in-progress': return t.accent;
      case 'locked': return t.borderColor;
      case 'na': return t.borderColor;
    }
  }

  return (
    <View style={styles.bar}>
      {readiness.sections.map(({ section, status }) => {
        const c = color(status.status);
        const active = section.key === activeKey;
        const na = status.status === 'na';
        return (
          <Pressable
            key={section.key}
            onPress={() => onSelectSection?.(section.key)}
            style={styles.seg}
            hitSlop={4}
          >
            <View style={[styles.track, { backgroundColor: t.surface }]}>
              <View style={[styles.fill, {
                width: `${Math.round(Math.max(0, Math.min(1, status.fraction)) * 100)}%`,
                backgroundColor: c,
              }]} />
            </View>
            <Text style={[styles.glyph, { color: c, opacity: na ? 0.5 : 1 }]}>{section.glyph}</Text>
            <Text
              style={[styles.label, {
                color: active ? t.fg : t.fgMuted,
                opacity: na ? 0.5 : 1,
                fontWeight: active ? '700' : '500',
              }]}
              numberOfLines={1}
            >
              {section.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingVertical: 4 },
  seg: { flex: 1, alignItems: 'center', gap: 4 },
  track: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  glyph: { fontSize: 13, lineHeight: 15 },
  label: { fontSize: 9.5, letterSpacing: 0.2, textAlign: 'center' },
});
