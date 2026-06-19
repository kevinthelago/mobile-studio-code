import React from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { ClaudeAvatar } from '../ui/ClaudeAvatar';
import { PLAN_COLORS } from '../../lib/planner/colors';
import { Section } from '../../lib/planner/types';

// ── Tag — small uppercase mono pill, optional leading dot ──────────────────────
export function Tag({
  children, color, bg, border = true, dot,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  border?: boolean;
  dot?: string;
}) {
  const t = useTheme();
  return (
    <View style={[
      styles.tag,
      {
        backgroundColor: bg ?? 'rgba(255,255,255,0.05)',
        borderWidth: border ? StyleSheet.hairlineWidth : 0,
        borderColor: t.borderColor,
      },
    ]}>
      {dot && <View style={[styles.tagDot, { backgroundColor: dot }]} />}
      <Text style={[styles.tagText, { color: color ?? t.fgMuted, fontFamily: t.fontMono }]}>
        {children}
      </Text>
    </View>
  );
}

// ── Conversation bubbles ───────────────────────────────────────────────────────
export function PlannerMsg({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.msgRow}>
      <ClaudeAvatar size={22} />
      <Text style={[styles.msgText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function UserMsg({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.userRow}>
      <View style={[styles.userBubble, {
        backgroundColor: t.surface,
        borderColor: t.borderColor,
      }]}>
        <Text style={[styles.userText, { color: t.fg }]}>{children}</Text>
      </View>
    </View>
  );
}

export function SysLine({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text style={[styles.sysLine, { color: t.fgDim, fontFamily: t.fontMono }]}>
      — {children} —
    </Text>
  );
}

// ── SectionCard — the inline "section drafted" confirm/review card ─────────────
export function SectionCard({
  section, onConfirm, onReview,
}: {
  section: Section;
  onConfirm?: () => void;
  onReview?: () => void;
}) {
  const t = useTheme();
  const { confirmed } = section;
  const headBg = confirmed ? 'rgba(126,226,196,0.08)' : 'rgba(255,174,207,0.10)';
  const borderCol = confirmed ? 'rgba(126,226,196,0.3)' : 'rgba(255,174,207,0.45)';
  return (
    <View style={[styles.section, { borderColor: borderCol, backgroundColor: t.surface }]}>
      <View style={[styles.sectionHead, { backgroundColor: headBg, borderBottomColor: t.borderColor }]}>
        <Tag color={confirmed ? PLAN_COLORS.good : t.accent} border={false} dot={confirmed ? PLAN_COLORS.good : t.accent}>
          {confirmed ? 'confirmed' : `section · ${section.stage}`}
        </Tag>
        <View style={{ flex: 1 }} />
        <Text style={[styles.sectionFile, { color: t.fgDim, fontFamily: t.fontMono }]}>
          {section.stage}.md
        </Text>
      </View>
      <View style={styles.sectionBody}>
        <Text style={[styles.sectionTitle, { color: t.fg }]}>{section.title}</Text>
        {section.lines.map((l, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: t.accent }]}>•</Text>
            <Text style={[styles.bulletText, { color: t.fgMuted }]}>{l}</Text>
          </View>
        ))}
        {section.meta.length > 0 && (
          <View style={styles.metaRow}>
            {section.meta.map((m, i) => <Tag key={i}>{m}</Tag>)}
          </View>
        )}
        {confirmed ? (
          <View style={styles.confirmedRow}>
            <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
              <Path d="M3 7l2.5 2.5L10 4" stroke={PLAN_COLORS.good} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.confirmedText, { color: PLAN_COLORS.good, fontFamily: t.fontMono }]}>
              Confirmed · added to plan
            </Text>
          </View>
        ) : (
          <View style={styles.sectionActions}>
            <Pressable onPress={onReview} style={[styles.softBtn, { backgroundColor: t.surface, borderColor: t.borderColor }]}>
              <Text style={[styles.softBtnText, { color: t.fg }]}>Review</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.confirmBtn, { backgroundColor: t.accent }]}>
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                <Path d="M3 7l2.5 2.5L11 4" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.confirmBtnText}>Confirm section</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Quick replies — horizontal scroll of suggestion chips ──────────────────────
export function QuickReplies({
  items, onPick, style,
}: {
  items: { label: string; primary?: boolean }[];
  onPick?: (label: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickRow}
      style={style}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((q, i) => (
        <Pressable
          key={i}
          onPress={() => onPick?.(q.label)}
          style={[styles.quickChip, {
            backgroundColor: q.primary ? 'rgba(255,174,207,0.13)' : t.surface,
            borderColor: q.primary ? 'rgba(255,174,207,0.45)' : t.borderColor,
          }]}
        >
          <Text style={[styles.quickText, { color: q.primary ? t.accent : t.fg }]}>{q.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ── Collapsible — Plan-tab visualizer card ─────────────────────────────────────
export function Collapsible({
  title, count, accent, open, onToggle, summary, children,
}: {
  title: string;
  count?: string;
  accent?: string;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.collapsible, { borderColor: t.borderColor, backgroundColor: t.surface }]}>
      <Pressable onPress={onToggle} style={styles.collapsibleHead}>
        <Svg width={11} height={11} viewBox="0 0 11 11" fill="none" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={[styles.collapsibleTitle, { color: t.fg }]}>{title}</Text>
        {count != null && <Tag color={accent ?? t.fgMuted} dot={accent}>{count}</Tag>}
      </Pressable>
      {open && (
        <View style={[styles.collapsibleBody, { borderTopColor: t.borderColor }]}>{children}</View>
      )}
      {!open && summary && (
        <Text style={[styles.collapsibleSummary, { color: t.fgDim }]}>{summary}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 20,
    paddingHorizontal: 8, borderRadius: 7,
  },
  tagDot: { width: 5, height: 5, borderRadius: 3 },
  tagText: { fontSize: 10, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },

  msgRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  msgText: { flex: 1, fontSize: 14, lineHeight: 21, paddingTop: 1 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 },
  userBubble: {
    maxWidth: '82%', borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6, borderBottomRightRadius: 2, paddingHorizontal: 13, paddingVertical: 9,
  },
  userText: { fontSize: 14, lineHeight: 20 },
  sysLine: { textAlign: 'center', fontSize: 11, marginTop: 4, marginBottom: 16, letterSpacing: 0.2 },

  section: {
    marginBottom: 16, marginLeft: 32, borderWidth: 1, borderRadius: 6, overflow: 'hidden',
  },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionFile: { fontSize: 10 },
  sectionBody: { paddingHorizontal: 13, paddingVertical: 12 },
  sectionTitle: { fontSize: 14.5, fontWeight: '600', marginBottom: 7 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 13, lineHeight: 21 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 21 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  confirmedText: { fontSize: 11.5 },
  sectionActions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  softBtn: {
    flex: 1, height: 34, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  softBtnText: { fontSize: 13, fontWeight: '600' },
  confirmBtn: {
    flex: 1.4, height: 34, borderRadius: 4, flexDirection: 'row', gap: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  quickRow: { gap: 8, paddingHorizontal: 14, alignItems: 'center' },
  quickChip: {
    height: 34, paddingHorizontal: 13, borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center',
  },
  quickText: { fontSize: 13, fontWeight: '500' },

  collapsible: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  collapsibleHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  collapsibleTitle: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  collapsibleBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  collapsibleSummary: { paddingHorizontal: 14, paddingBottom: 13, marginTop: -4, fontSize: 12.5 },
});
