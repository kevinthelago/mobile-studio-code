import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { PLAN_COLORS } from '../../lib/planner/colors';
import type { SectionRenderStatus } from '../../lib/planner/core';
import type { ProjectReadiness } from '../../lib/planner/project';

const NODE_W = 64;        // per-stage column width (used for auto-scroll math)

/** Pinned, horizontally-scrollable, tappable stage stepper. One node per enabled
 *  section, derived entirely from blueprint data via projectReadiness — no hardcoded
 *  stage list. Tapping a node calls onSelectSection so the host can jump the project
 *  pane to that section. Auto-scrolls to keep the active / in-progress node in view. */
export function BlueprintStageBar({
  readiness, activeKey, onSelectSection,
}: {
  readiness: ProjectReadiness;
  activeKey?: string | null;
  onSelectSection?: (key: string) => void;
}) {
  const t = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const sections = readiness.sections;

  function nodeColor(status: SectionRenderStatus): string {
    switch (status) {
      case 'complete': return PLAN_COLORS.good;
      case 'in-progress': return t.accent;
      case 'locked': return t.fgDim;
      case 'na': return t.fgDim;
    }
  }

  // Keep the focused node visible: prefer the tapped section, else the in-progress one.
  const focusIndex = useMemo(() => {
    const byKey = activeKey ? sections.findIndex((s) => s.section.key === activeKey) : -1;
    if (byKey >= 0) return byKey;
    return sections.findIndex((s) => s.status.status === 'in-progress');
  }, [sections, activeKey]);

  useEffect(() => {
    if (focusIndex < 0) return;
    const x = Math.max(0, focusIndex * NODE_W - 110);
    scrollRef.current?.scrollTo({ x, animated: true });
  }, [focusIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.bar}
      style={styles.scroll}
    >
      {sections.map(({ section, status }, i) => {
        const st = status.status;
        const c = nodeColor(st);
        const done = st === 'complete';
        const current = st === 'in-progress';
        const gated = st === 'locked';
        const na = st === 'na';
        const active = section.key === activeKey;
        const prevDone = i > 0 && sections[i - 1].status.status === 'complete';

        return (
          <Pressable
            key={section.key}
            onPress={() => onSelectSection?.(section.key)}
            style={styles.node}
            hitSlop={4}
          >
            <View style={styles.connectorRow}>
              {/* left connector */}
              <View style={[styles.connector, {
                backgroundColor: i === 0 ? 'transparent' : (done || prevDone ? t.accent : t.borderColor),
              }]} />
              <View style={[styles.circle, {
                borderColor: done || current || active ? c : t.borderColor,
                backgroundColor: done ? c : t.surface,
                ...(current ? { borderWidth: 2 } : null),
              }]}>
                {done ? (
                  <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
                    <Path d="M3 7l2.5 2.5L10 4" stroke={t.bg} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : gated ? (
                  <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                    <Path d="M2 5h7v4.5H2zM3.3 5V3.8a2.2 2.2 0 014.4 0V5" stroke={t.fgDim} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : (
                  <Text style={[styles.glyph, { color: c, opacity: na ? 0.5 : 1 }]}>{section.glyph}</Text>
                )}
              </View>
              {/* right connector */}
              <View style={[styles.connector, {
                backgroundColor: i === sections.length - 1 ? 'transparent' : (done ? t.accent : t.borderColor),
              }]} />
            </View>
            <Text
              style={[styles.label, {
                color: current || active ? t.accent : done ? t.fgMuted : t.fgDim,
                opacity: na ? 0.5 : 1,
                fontWeight: current || active ? '700' : '500',
                fontFamily: t.fontMono,
              }]}
              numberOfLines={1}
            >
              {section.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  bar: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 8, paddingVertical: 4 },
  node: { width: NODE_W, alignItems: 'center', gap: 4 },
  connectorRow: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 30 },
  connector: { flex: 1, height: 2 },
  circle: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  glyph: { fontSize: 13, lineHeight: 15 },
  label: { fontSize: 9.5, letterSpacing: 0.2, textAlign: 'center', textTransform: 'uppercase' },
});
