import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Btn } from '../../components/ui/Btn';
import { PageHeader } from '../../components/ui/PageHeader';
import { PLAN_PROJECTS, SCOPING_DRAFT, SCOPING_MESSAGES, ScopingMessage } from './planData';
import { LabelChip, ProgressBar } from './planShared';
import { PlanNav, TAB_BAR_HEIGHT } from './nav';

// Render **bold** spans in accent (the design's markdown-lite emphasis).
function emphasized(text: string, accent: string, base: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <Text key={i} style={{ color: accent, fontWeight: '600' }}>{p.slice(2, -2)}</Text>;
    }
    return <Text key={i} style={{ color: base }}>{p}</Text>;
  });
}

function ChatBubble({ m }: { m: ScopingMessage }) {
  const t = useTheme();
  if (m.who === 'you') {
    return (
      <View style={[styles.youBubble, { backgroundColor: t.elev, borderColor: t.borderColor }]}>
        <Text style={[styles.bubbleText, { color: t.fg }]}>{m.t}</Text>
      </View>
    );
  }
  return (
    <View style={styles.claudeBubble}>
      <Text style={[styles.claudeMark, { color: t.accent }]}>◉</Text>
      <Text style={[styles.bubbleText, { color: t.fg, flex: 1 }]}>
        {emphasized(m.t, t.accent, t.fg)}
      </Text>
    </View>
  );
}

export function PlanScoping({ nav, projectId }: { nav: PlanNav; projectId: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [answer, setAnswer] = useState('');
  const project = PLAN_PROJECTS.find((p) => p.id === projectId);
  const progress = project?.progress ?? 0.38;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={TAB_BAR_HEIGHT + insets.bottom}
      >
        <PageHeader
          crumbs={[
            <Text key="back" onPress={nav.toProjects} style={{ color: t.accent }}>plan</Text>,
            projectId,
            'scoping',
          ]}
          title={project?.name ?? 'Scoping'}
          meta={<><Text style={{ color: t.accent }}>{Math.round(progress * 100)}%</Text> planned · 7 q's</>}
          right={
            <View style={[styles.pauseTag, { backgroundColor: t.elev, borderColor: t.borderColor }]}>
              <Text style={{ color: t.fgMuted, fontFamily: t.fontMono, fontSize: 9.5 }}>⏸ pause</Text>
            </View>
          }
        />

        {/* Progress strip */}
        <View style={[styles.progressStrip, { backgroundColor: t.surface, borderBottomColor: t.borderColor }]}>
          <View style={styles.flex1}><ProgressBar value={progress} tone="accent" /></View>
          <Text style={[styles.progressText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
            q 7/~18 · draft has <Text style={{ color: t.fg }}>{SCOPING_DRAFT.length}</Text> issues
          </Text>
        </View>

        <ScrollView
          style={{ backgroundColor: t.bg }}
          contentContainerStyle={{ paddingBottom: 14 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Chat */}
          <View style={styles.chat}>
            {SCOPING_MESSAGES.map((m, i) => <ChatBubble key={i} m={m} />)}
          </View>

          {/* Draft preview */}
          <View style={styles.draftHead}>
            <Text style={[styles.sectionLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>DRAFT MILESTONE</Text>
            <Text style={[styles.draftCount, { color: t.fgMuted, fontFamily: t.fontMono }]}>
              · will publish to gh/{project?.repo ?? 'acme/payments'}
            </Text>
            <View style={styles.flex1} />
            <Text style={[styles.expand, { color: t.accent, fontFamily: t.fontMono }]}>expand</Text>
          </View>

          <View style={styles.draftList}>
            {SCOPING_DRAFT.map((d, i) => (
              <Card key={i} style={styles.draftCard}>
                <View style={[styles.draftIdx, { backgroundColor: `${t.accent}33` }]}>
                  <Text style={[styles.draftIdxText, { color: t.accent, fontFamily: t.fontMono }]}>{i + 1}</Text>
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.draftTitle, { color: t.fg }]}>{d.t}</Text>
                  <View style={styles.draftLabels}>
                    {d.labels.map((l) => <LabelChip key={l} id={l} fontSize={8.5} />)}
                  </View>
                </View>
                <Text style={[styles.draftEst, { color: t.fgMuted, fontFamily: t.fontMono }]}>{d.est}</Text>
              </Card>
            ))}
          </View>

          <View style={styles.publishRow}>
            <Btn size="sm" style={styles.flex1}>save draft</Btn>
            <Btn variant="primary" size="sm" style={styles.publishMain}>publish 6 issues + milestone →</Btn>
          </View>
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, {
          backgroundColor: t.surface, borderTopColor: t.borderColor,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 10,
        }]}>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            placeholder="answer · or paste a constraint…"
            placeholderTextColor={t.fgDim}
            multiline
            style={[styles.composerInput, {
              color: t.fg, backgroundColor: t.elev, borderColor: t.borderColor, fontFamily: t.fontMono,
            }]}
          />
          <View style={styles.composerActions}>
            <Text style={[styles.voiceHint, { color: t.fgDim, fontFamily: t.fontMono }]}>↑ voice · 🎙</Text>
            <View style={styles.flex1} />
            <Btn variant="ghost" size="sm">skip</Btn>
            <Btn variant="primary" size="sm">send ↵</Btn>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },

  pauseTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },

  progressStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  progressText: { fontSize: 10 },

  chat: { paddingVertical: 10 },
  youBubble: {
    alignSelf: 'flex-end', maxWidth: '80%',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    marginVertical: 6, marginHorizontal: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  claudeBubble: {
    flexDirection: 'row', maxWidth: '90%', gap: 8,
    paddingVertical: 8, paddingRight: 12, paddingLeft: 12,
    marginVertical: 6, marginHorizontal: 12,
  },
  claudeMark: { fontSize: 11, lineHeight: 19 },
  bubbleText: { fontSize: 12.5, lineHeight: 19 },

  draftHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.8 },
  draftCount: { fontSize: 9.5 },
  expand: { fontSize: 10.5 },

  draftList: { paddingHorizontal: 12, paddingBottom: 14, gap: 6 },
  draftCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 8 },
  draftIdx: { width: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  draftIdxText: { fontSize: 10, fontWeight: '600' },
  draftTitle: { fontSize: 12, lineHeight: 16 },
  draftLabels: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  draftEst: { fontSize: 10, marginTop: 1 },

  publishRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  publishMain: { flex: 2 },

  composer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  composerInput: {
    minHeight: 50, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, textAlignVertical: 'top',
  },
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  voiceHint: { fontSize: 10 },
});
