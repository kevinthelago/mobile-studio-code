import React from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { PlannerMsg, UserMsg, SysLine, SectionCard } from './atoms';
import {
  Plan, PlannerMessage, BLUEPRINTS, STAGES,
} from '../../lib/planner/types';

// ── Drafting message list ──────────────────────────────────────────────────────
export function ChatMessages({
  plan, onConfirmSection,
}: {
  plan: Plan;
  onConfirmSection: (index: number) => void;
}) {
  return (
    <View style={styles.messages}>
      {plan.messages.map((m: PlannerMessage, i) => {
        if (m.kind === 'system') return <SysLine key={i}>{m.text}</SysLine>;
        if (m.kind === 'assistant') return <PlannerMsg key={i}>{m.text}</PlannerMsg>;
        if (m.kind === 'section') {
          return (
            <SectionCard
              key={i}
              section={m.section}
              onConfirm={() => onConfirmSection(i)}
            />
          );
        }
        return <UserMsg key={i}>{m.text}</UserMsg>;
      })}
    </View>
  );
}

// ── Empty / new-project body — pitch + blueprint picker ────────────────────────
export function ChatEmptyBody({
  pitch, blueprint, onSelectBlueprint,
}: {
  pitch: string;
  blueprint: string;
  onSelectBlueprint: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <PlannerMsg>
        I’m your planning session — I’ll turn a pitch into an executable plan:
        features, a GitHub structure, and a fleet of agents. Nothing gets built
        until you publish.
      </PlannerMsg>

      <Text style={[styles.eyebrow, { color: t.fgDim, fontFamily: t.fontMono }]}>
        Describe what you want to build
      </Text>
      <View style={styles.indent}>
        <Surface style={styles.pitchCard} radius={16}>
          <Text style={[styles.pitchText, { color: pitch ? t.fg : t.fgDim }]}>
            {pitch || 'A habit tracker where I log daily habits and see streaks…'}
          </Text>
          <View style={styles.pitchFoot}>
            <View style={[styles.attachBtn, { borderColor: t.borderColor }]}>
              <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
                <Rect x={2} y={2} width={11} height={11} rx={2} stroke={t.fgMuted} strokeWidth={1.5} />
                <Path d="M5 9l2-2 2 2 3-3" stroke={t.fgMuted} strokeWidth={1.5} />
              </Svg>
            </View>
            <Text style={[styles.attachHint, { color: t.fgDim, fontFamily: t.fontMono }]}>
              attach a brief or screenshots
            </Text>
          </View>
        </Surface>
      </View>

      <View style={styles.indent}>
        <Text style={[styles.eyebrow, { color: t.fgDim, fontFamily: t.fontMono }]}>
          Blueprint <Text style={styles.eyebrowSoft}>— shapes the stages</Text>
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.blueprintRow}
      >
        {BLUEPRINTS.map((b) => {
          const on = b.id === blueprint;
          return (
            <Pressable
              key={b.id}
              onPress={() => onSelectBlueprint(b.id)}
              style={[styles.blueprint, {
                backgroundColor: on ? 'rgba(255,174,207,0.13)' : t.surface,
                borderColor: on ? 'rgba(255,174,207,0.45)' : t.borderColor,
              }]}
            >
              <View style={styles.blueprintHead}>
                <Text style={[styles.blueprintName, { color: on ? t.accent : t.fg }]}>{b.name}</Text>
                {on && (
                  <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
                    <Path d="M3 8l3 3 6-7" stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </View>
              <Text style={[styles.blueprintDesc, { color: t.fgMuted }]}>{b.desc}</Text>
              <View style={styles.blueprintDots}>
                {STAGES.map((_, j) => (
                  <View key={j} style={[styles.blueprintDot, {
                    backgroundColor: b.stages === 0
                      ? t.borderColor
                      : j < b.stages ? (on ? t.accent : t.fgMuted) : t.borderColor,
                  }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  messages: { paddingTop: 12 },
  empty: { paddingTop: 14 },
  eyebrow: { fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600', marginBottom: 8, marginLeft: 32 },
  eyebrowSoft: { textTransform: 'none', letterSpacing: 0 },
  indent: { marginLeft: 32 },
  pitchCard: { padding: 13, minHeight: 92, marginBottom: 16 },
  pitchText: { fontSize: 14, lineHeight: 21 },
  pitchFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  attachBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  attachHint: { fontSize: 10.5 },

  blueprintRow: { gap: 10, paddingLeft: 32, paddingRight: 16, paddingBottom: 4 },
  blueprint: { width: 150, padding: 13, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth },
  blueprintHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blueprintName: { fontSize: 14, fontWeight: '600' },
  blueprintDesc: { fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  blueprintDots: { flexDirection: 'row', gap: 3, marginTop: 10 },
  blueprintDot: { width: 14, height: 3, borderRadius: 2 },
});
