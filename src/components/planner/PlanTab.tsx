import React, { useState } from 'react';
import {
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Collapsible, Tag } from './atoms';
import { PLAN_COLORS } from '../../lib/planner/colors';
import { Plan } from '../../lib/planner/types';

export function PlanTab({ plan, onGrade }: { plan: Plan; onGrade: () => void }) {
  const t = useTheme();
  const [open, setOpen] = useState<Record<string, boolean>>({ context: true, milestones: true });
  const [mode, setMode] = useState<'phases' | 'repos'>('phases');
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <View style={styles.root}>
      <Collapsible title="Context files" count={String(plan.contextFiles.length)} open={!!open.context} onToggle={() => toggle('context')}>
        <View style={{ paddingTop: 10 }}>
          {plan.contextFiles.slice(0, 4).map((f, i) => (
            <View key={f.name} style={[styles.fileRow, i < 3 && { borderBottomColor: t.borderColor, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Svg width={13} height={14} viewBox="0 0 13 14" fill="none">
                <Path d="M2 1h6l3 3v9H2z" stroke={t.accent} strokeWidth={1.3} />
                <Path d="M8 1v3h3" stroke={t.accent} strokeWidth={1.3} />
              </Svg>
              <Text style={[styles.fileName, { color: t.fg, fontFamily: t.fontMono }]}>{f.name}</Text>
              <Text style={[styles.fileSize, { color: t.fgDim, fontFamily: t.fontMono }]}>{f.size}</Text>
            </View>
          ))}
          {plan.contextFiles.length > 4 && (
            <Text style={[styles.moreNote, { color: t.fgDim, fontFamily: t.fontMono }]}>
              + {plan.contextFiles.length - 4} more · agents run under these
            </Text>
          )}
        </View>
      </Collapsible>

      <Collapsible title="Milestones · Structure" count={String(plan.milestones.length)} accent={t.accent} open={!!open.milestones} onToggle={() => toggle('milestones')}>
        <View style={{ paddingTop: 12 }}>
          <View style={styles.toolRow}>
            <View style={[styles.segment, { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: t.borderColor }]}>
              {(['phases', 'repos'] as const).map((m) => (
                <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && { backgroundColor: t.surface }]}>
                  <Text style={[styles.segText, { color: mode === m ? t.fg : t.fgDim, fontFamily: t.fontMono }]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onGrade} style={[styles.gradeChip, { backgroundColor: 'rgba(126,226,196,0.12)', borderColor: 'rgba(126,226,196,0.3)' }]}>
              <Text style={[styles.gradeLetter, { color: PLAN_COLORS.good, fontFamily: t.fontMono }]}>{plan.grade.letter}</Text>
              <Text style={[styles.gradePct, { color: PLAN_COLORS.good, fontFamily: t.fontMono }]}>{plan.grade.pct}%</Text>
            </Pressable>
          </View>
          {plan.milestones.map((m, i) => (
            <View key={m.name} style={[styles.msRow, i < plan.milestones.length - 1 && { borderBottomColor: t.borderColor, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.msDot, { backgroundColor: m.status === 'done' ? PLAN_COLORS.good : m.status === 'gated' ? t.fgDim : t.accent }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.msName, { color: t.fg }]}>{m.name}</Text>
                <Text style={[styles.msMeta, { color: t.fgMuted, fontFamily: t.fontMono }]}>{m.issues} issues · {m.agents} agents</Text>
              </View>
              {m.status === 'gated' ? (
                <Tag color={t.fgDim}>gated</Tag>
              ) : (
                <View style={styles.readyTag}>
                  <View style={[styles.readyDot, { backgroundColor: PLAN_COLORS.good }]} />
                  <Text style={[styles.readyText, { color: PLAN_COLORS.good, fontFamily: t.fontMono }]}>ready</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </Collapsible>

      <Collapsible title="Agents · Permissions" count="5" open={!!open.agents} onToggle={() => toggle('agents')} summary="5 agents · scoped to milestones · 2 need review" />
      <Collapsible title="Director · Coordination" open={!!open.director} onToggle={() => toggle('director')} summary="Sequential by milestone · merges via PR · conflict policy: ask" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 12 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  fileName: { flex: 1, fontSize: 12.5 },
  fileSize: { fontSize: 10.5 },
  moreNote: { fontSize: 11, marginTop: 8 },

  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 3, borderWidth: StyleSheet.hairlineWidth },
  segBtn: { height: 28, paddingHorizontal: 12, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  gradeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  gradeLetter: { fontSize: 12, fontWeight: '700' },
  gradePct: { fontSize: 10.5 },

  msRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  msDot: { width: 8, height: 8, borderRadius: 4 },
  msName: { fontSize: 13.5, fontWeight: '500' },
  msMeta: { fontSize: 10.5, marginTop: 2 },
  readyTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readyDot: { width: 5, height: 5, borderRadius: 3 },
  readyText: { fontSize: 10 },
});
