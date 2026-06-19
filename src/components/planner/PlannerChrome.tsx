import React from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Path, G, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';
import { IconBtn } from '../ui/IconBtn';
import {
  STAGES, StageId, StageState, PlannerTab,
} from '../../lib/planner/types';

// ── Stage icons (ported from the design) ───────────────────────────────────────
function StageGlyph({ id, color }: { id: StageId; color: string }) {
  const common = { stroke: color, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const glyph = {
    context: <Path d="M3 4.5h7l2 2h2v6.5a1 1 0 01-1 1H4a1 1 0 01-1-1z" {...common} />,
    repos: <G {...common}><Circle cx={5} cy={4} r={1.6} /><Circle cx={5} cy={13} r={1.6} /><Circle cx={12} cy={8.5} r={1.6} /><Path d="M5 5.6v5.8M6.6 4h3.4a2 2 0 012 2v1" /></G>,
    ui: <G {...common}><Rect x={4} y={2.5} width={9} height={13} rx={1.5} /><Path d="M4 6h9" /></G>,
    structure: <G {...common}><Path d="M3 4h4v4H3zM10 4h4v4h-4zM3 11h4v3H3zM10 11h4v3h-4z" /></G>,
    perms: <Path d="M8.5 2.5l4.5 1.8v3.4c0 3-2 5-4.5 6-2.5-1-4.5-3-4.5-6V4.3z" {...common} />,
    auto: <Path d="M9 2.5L4.5 9.5h3.5l-1 5.5L13 8h-3.5z" {...common} />,
    skills: <Path d="M8.5 2.5l1.4 3.6 3.6 1.4-3.6 1.4L8.5 12.5 7.1 8.9 3.5 7.5l3.6-1.4z" {...common} />,
  }[id];
  return <Svg width={14} height={14} viewBox="0 0 17 17">{glyph}</Svg>;
}

// ── Stepper — pinned, scrollable, tappable stage rail ──────────────────────────
export function Stepper({
  stageStates, onJump,
}: {
  stageStates: Record<StageId, StageState>;
  onJump?: (id: StageId) => void;
}) {
  const t = useTheme();
  const accentLine = 'rgba(255,174,207,0.45)';
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stepperRow}
    >
      {STAGES.map((st, i) => {
        const state = stageStates[st.id] ?? 'upcoming';
        const done = state === 'done';
        const current = state === 'current';
        const gated = state === 'gated';
        const nodeColor = done || current ? t.accent : t.fgDim;
        const leftActive = i > 0 && (done || current);
        const rightActive = done && i < STAGES.length - 1
          && (stageStates[STAGES[i + 1].id] === 'done' || stageStates[STAGES[i + 1].id] === 'current');
        return (
          <View key={st.id} style={styles.stepNode}>
            <View style={styles.stepConnectorRow}>
              <View style={[styles.connector, { backgroundColor: i === 0 ? 'transparent' : leftActive ? accentLine : t.borderColor }]} />
              <Pressable
                onPress={() => onJump?.(st.id)}
                style={[styles.stepCircle, {
                  backgroundColor: done ? t.accent : 'rgba(255,255,255,0.04)',
                  borderColor: nodeColor,
                  ...(current ? { shadowColor: t.accent, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3 } : {}),
                }]}
              >
                {done ? (
                  <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
                    <Path d="M3 7l2.5 2.5L10 4" stroke="#2a0e22" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : gated ? (
                  <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                    <Rect x={2} y={5} width={7} height={4.5} rx={1} stroke={t.fgDim} strokeWidth={1.4} />
                    <Path d="M3.3 5V3.8a2.2 2.2 0 014.4 0V5" stroke={t.fgDim} strokeWidth={1.4} />
                  </Svg>
                ) : (
                  <StageGlyph id={st.id} color={current ? t.accent : t.fgDim} />
                )}
              </Pressable>
              <View style={[styles.connector, { backgroundColor: i === STAGES.length - 1 ? 'transparent' : rightActive ? accentLine : t.borderColor }]} />
            </View>
            <Text style={[styles.stepLabel, {
              color: current ? t.accent : done ? t.fgMuted : t.fgDim,
              fontFamily: t.fontMono,
              fontWeight: current ? '600' : '500',
            }]}>
              {st.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Header — frosted bar with title, status, overflow + folded-in stepper ──────
export function PlannerHeader({
  title, repo, status, statusColor, confirmedLabel, stageStates,
  onBack, onMenu, onJump, topInset,
}: {
  title: string;
  repo?: string | null;
  status: string;
  statusColor?: string;
  confirmedLabel: string;
  stageStates?: Record<StageId, StageState>;
  onBack?: () => void;
  onMenu?: () => void;
  onJump?: (id: StageId) => void;
  topInset: number;
}) {
  const t = useTheme();
  const sc = statusColor ?? t.accent;
  return (
    <View style={[styles.header, { paddingTop: topInset + 4, borderBottomColor: t.borderColor, backgroundColor: t.bg }]}>
      <View style={styles.headerTop}>
        <IconBtn onPress={onBack}>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path d="M10 3L5 8l5 5" stroke={t.fg} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </IconBtn>
        <Text style={[styles.headerTitle, { color: t.fg }]} numberOfLines={1}>{title}</Text>
        <View style={[styles.statusTag, { borderColor: t.borderColor }]}>
          <View style={[styles.statusDot, { backgroundColor: sc }]} />
          <Text style={[styles.statusText, { color: sc, fontFamily: t.fontMono }]}>{status}</Text>
        </View>
        <IconBtn onPress={onMenu}>
          <Svg width={18} height={18} viewBox="0 0 18 18" fill={t.fg}>
            <Circle cx={9} cy={3.5} r={1.6} /><Circle cx={9} cy={9} r={1.6} /><Circle cx={9} cy={14.5} r={1.6} />
          </Svg>
        </IconBtn>
      </View>
      <View style={styles.headerSub}>
        {repo ? (
          <Text style={[styles.headerRepo, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
            ⎇ {repo}
          </Text>
        ) : <View />}
        <View style={{ flex: 1 }} />
        <Text style={[styles.headerConfirmed, { color: t.fgMuted, fontFamily: t.fontMono }]}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>{confirmedLabel}</Text> confirmed
        </Text>
      </View>
      {stageStates && (
        <View style={[styles.stepperWrap, { borderTopColor: t.borderColor }]}>
          <Stepper stageStates={stageStates} onJump={onJump} />
        </View>
      )}
    </View>
  );
}

// ── Tab bar — floating glass pill, 4 tabs with icons + optional badge ──────────
const TAB_ICON: Record<PlannerTab, React.ReactNode> = {
  chat: <Path d="M3 5a2 2 0 012-2h8a2 2 0 012 2v5a2 2 0 01-2 2H7l-3 3v-3a2 2 0 01-1-2z" />,
  plan: <Path d="M4 3h10M4 7h10M4 11h6" />,
  preview: <G><Rect x={4} y={2.5} width={9} height={13} rx={1.5} /><Path d="M4 6h9" /></G>,
  grade: <Path d="M9 2l2 4.3 4.5.5-3.4 3.1 1 4.6L9 12.3 4.9 14.5l1-4.6L2.5 6.8 7 6.3z" />,
};

export type PlannerTabItem = { id: PlannerTab; label: string; badge?: boolean };

export function PlannerTabBar({
  tabs, active, onChange, bottomInset,
}: {
  tabs: PlannerTabItem[];
  active: PlannerTab;
  onChange: (id: PlannerTab) => void;
  bottomInset: number;
}) {
  const t = useTheme();
  return (
    <View style={[styles.tabBar, {
      marginBottom: bottomInset + 12,
      backgroundColor: t.surface,
      borderColor: t.borderColor,
    }]}>
      {tabs.map((tb) => {
        const on = tb.id === active;
        const tint = on ? t.accent : t.fgMuted;
        return (
          <Pressable
            key={tb.id}
            onPress={() => onChange(tb.id)}
            style={[styles.tabBtn, on && { backgroundColor: `${t.accent}22` }]}
          >
            <View>
              <Svg width={19} height={19} viewBox="0 0 18 18" fill="none" stroke={tint} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                {TAB_ICON[tb.id]}
              </Svg>
              {tb.badge && <View style={[styles.tabBadge, { backgroundColor: t.accent, borderColor: t.bg }]} />}
            </View>
            <Text style={[styles.tabLabel, { color: tint, fontFamily: t.fontMono, fontWeight: on ? '600' : '500' }]}>
              {tb.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Composer — message input (display + onSend stub for the scaffold) ──────────
export function Composer({
  placeholder = 'Message the planner…', disabled, onSend,
}: {
  placeholder?: string;
  disabled?: boolean;
  onSend?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.composer, {
      backgroundColor: t.surface, borderColor: t.borderColor, opacity: disabled ? 0.5 : 1,
    }]}>
      <IconBtn onPress={() => {}}>
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Path d="M15 8l-6 6a3.5 3.5 0 01-5-5l6-6a2.2 2.2 0 013 3l-6 6a1 1 0 01-1.5-1.5L11 5.5" stroke={t.fgMuted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </IconBtn>
      <Text style={[styles.composerPlaceholder, { color: t.fgDim }]}>{placeholder}</Text>
      <IconBtn primary onPress={onSend} disabled={disabled}>
        <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
          <Path d="M7.5 12V4M4 7l3.5-3.5L11 7" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </IconBtn>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stepper
  stepperRow: { alignItems: 'flex-start', paddingHorizontal: 16, height: 56 },
  stepNode: { alignItems: 'center', minWidth: 58 },
  stepConnectorRow: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 30 },
  connector: { flex: 1, height: 2 },
  stepCircle: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { fontSize: 9.5, letterSpacing: 0.2, marginTop: 4, textTransform: 'uppercase' },

  // Header
  header: { paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 20, paddingHorizontal: 8, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 50, paddingRight: 16, paddingTop: 3 },
  headerRepo: { fontSize: 11, flexShrink: 1 },
  headerConfirmed: { fontSize: 11 },
  stepperWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },

  // Tab bar
  tabBar: {
    marginHorizontal: 14, height: 60, borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6,
  },
  tabBtn: { flex: 1, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabBadge: { position: 'absolute', top: -3, right: -5, width: 7, height: 7, borderRadius: 4, borderWidth: 1.5 },
  tabLabel: { fontSize: 9, letterSpacing: 0.2, textTransform: 'uppercase' },

  // Composer
  composer: {
    height: 48, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 6,
  },
  composerPlaceholder: { flex: 1, fontSize: 14 },
});
