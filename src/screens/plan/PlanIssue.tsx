import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { hexAlpha } from '../../lib/color';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Btn } from '../../components/ui/Btn';
import { PLAN_ACTIVITY, PLAN_SUBTASKS, PlanSubtask } from './planData';
import { AvatarStack, ClaudeBadge, LabelChip, PersonAvatar, DARK_ON_ACCENT } from './planShared';
import { PlanNav, TAB_BAR_HEIGHT } from './nav';

function Mono({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.fg, fontFamily: t.fontMono, fontSize: 11.5 }}>{children}</Text>;
}

function SubtaskRow({ s }: { s: PlanSubtask }) {
  const t = useTheme();
  return (
    <Card
      style={styles.subtask}
      background={s.isNew ? hexAlpha(t.accent, 0.08) : t.surface}
      borderColor={s.isNew ? t.accentDim : t.borderColor}
    >
      <View style={[styles.check, {
        borderColor: s.done ? t.success : t.borderStrong,
        backgroundColor: s.done ? t.success : 'transparent',
      }]}>
        {s.done && <Text style={[styles.checkMark, { color: DARK_ON_ACCENT }]}>✓</Text>}
      </View>

      <View style={styles.flex1}>
        <Text style={[styles.subtaskTitle, {
          color: s.done ? t.fgMuted : t.fg,
          textDecorationLine: s.done ? 'line-through' : 'none',
        }]}>
          {s.t}
          {s.isNew && (
            <Text style={[styles.newBadge, { color: t.accent }]}> ✦ NEW</Text>
          )}
        </Text>
        <Text style={[styles.subtaskNote, { color: t.fgDim, fontFamily: t.fontMono }]}>{s.note}</Text>
      </View>

      <Text style={[styles.est, { color: t.fgMuted, fontFamily: t.fontMono }]}>{s.est}</Text>
    </Card>
  );
}

export function PlanIssue({ nav, issueN }: { nav: PlanNav; projectId: string; issueN: number }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [comment, setComment] = useState('');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={TAB_BAR_HEIGHT + insets.bottom}
      >
        <PageHeader
          crumbs={[
            <Text key="back" onPress={nav.back} style={{ color: t.accent }}>plan</Text>,
            'Settlement webhooks v2',
            `#${issueN}`,
          ]}
          title="net: framing v2"
          meta={<><Text style={{ color: t.accent }}>● in progress</Text> · M1</>}
          right={
            <View style={[styles.prTag, { backgroundColor: hexAlpha(t.info, 0.12), borderColor: hexAlpha(t.info, 0.30) }]}>
              <Text style={{ color: t.info, fontFamily: t.fontMono, fontSize: 9.5 }}>⊕ PR #{issueN}</Text>
            </View>
          }
        />

        <ScrollView
          style={{ backgroundColor: t.bg }}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Labels + assignees */}
          <View style={[styles.metaBar, { borderBottomColor: t.borderColor }]}>
            <LabelChip id="net" />
            <View style={styles.flex1} />
            <AvatarStack who={['lina', 'alex']} border={t.bg} />
          </View>

          {/* Description */}
          <View style={[styles.descWrap, { borderBottomColor: t.borderColor }]}>
            <Text style={[styles.desc, { color: t.fgMuted }]}>
              Replace the v1 fixed-size frame with a CBOR-encoded variant carrying capability
              hints and a payload version. The encoder should expose a <Mono>Frame::new(payload, caps)</Mono> constructor
              and regenerate <Mono>schema.json</Mono> on build.
            </Text>
            <View style={[styles.kbBlock, { backgroundColor: t.elev, borderColor: t.borderColor }]}>
              <Text style={[styles.kbText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                ⌬ see blk_71fe — framing decision & acceptance bar
              </Text>
            </View>
          </View>

          {/* AI breakdown */}
          <View style={styles.aiHead}>
            <ClaudeBadge size={16} />
            <Text style={[styles.aiHeadText, { color: t.fg, fontFamily: t.fontMono }]}>Claude · subtasks</Text>
            <Text style={[styles.aiCount, { color: t.fgMuted, fontFamily: t.fontMono }]}>· {PLAN_SUBTASKS.length}</Text>
            <View style={styles.flex1} />
            <Text style={[styles.aiAction, { color: t.accent, fontFamily: t.fontMono }]}>regenerate</Text>
          </View>

          <View style={styles.subtaskList}>
            {PLAN_SUBTASKS.map((s) => <SubtaskRow key={s.n} s={s} />)}
          </View>

          <View style={styles.suggestRow}>
            <Btn variant="primary" size="sm" style={styles.flex1}>✦ create issue from suggestion</Btn>
            <Btn variant="ghost" size="sm">↺</Btn>
          </View>

          {/* Activity */}
          <View style={styles.activityHead}>
            <Text style={[styles.sectionLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>ACTIVITY</Text>
            <Text style={[styles.aiCount, { color: t.fgMuted, fontFamily: t.fontMono }]}>· {PLAN_ACTIVITY.length}</Text>
          </View>
          <View style={styles.activityList}>
            {PLAN_ACTIVITY.map((a, i) => (
              <View key={i} style={styles.activityRow}>
                <PersonAvatar id={a.who} size={18} />
                <View style={styles.flex1}>
                  <Text style={styles.activityText}>
                    <Text style={{ color: t.fg, fontFamily: t.fontMono, fontSize: 11 }}>@{a.who}</Text>
                    <Text style={{ color: t.fgMuted, fontSize: 11.5 }}> {a.a}</Text>
                  </Text>
                  <Text style={[styles.activityTime, { color: t.fgDim, fontFamily: t.fontMono }]}>{a.t}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, {
          backgroundColor: t.surface, borderTopColor: t.borderColor,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 10,
        }]}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="comment, or /assign, /label, /close, /ai breakdown…"
            placeholderTextColor={t.fgDim}
            multiline
            style={[styles.composerInput, {
              color: t.fg, backgroundColor: t.elev, borderColor: t.borderColor, fontFamily: t.fontMono,
            }]}
          />
          <View style={styles.composerActions}>
            <Btn variant="ghost" size="sm">✦ ask claude</Btn>
            <Btn variant="ghost" size="sm">open in pane</Btn>
            <View style={styles.flex1} />
            <Btn variant="primary" size="sm">comment</Btn>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },

  prTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99, borderWidth: StyleSheet.hairlineWidth },

  metaBar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },

  descWrap: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  desc: { fontSize: 12.5, lineHeight: 21 },
  kbBlock: {
    marginTop: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kbText: { fontSize: 10.5 },

  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  aiHeadText: { fontSize: 11 },
  aiCount: { fontSize: 10 },
  aiAction: { fontSize: 10.5 },

  subtaskList: { paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  subtask: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 8 },
  check: {
    width: 16, height: 16, borderRadius: 4, marginTop: 1,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  subtaskTitle: { fontSize: 12.5, lineHeight: 17 },
  newBadge: { fontSize: 8.5 },
  subtaskNote: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  est: { fontSize: 10, marginTop: 1 },

  suggestRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },

  activityHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.8 },
  activityList: { paddingHorizontal: 16, paddingBottom: 12, gap: 9 },
  activityRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  activityText: { lineHeight: 17 },
  activityTime: { fontSize: 9.5, marginTop: 1 },

  composer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  composerInput: {
    minHeight: 56, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 11.5, textAlignVertical: 'top',
  },
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
});
