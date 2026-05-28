import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { anthropicDraftCommitMessage } from '../../src/lib/anthropic';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { Card } from '../../src/components/ui/Card';
import { Tag } from '../../src/components/ui/Tag';
import { Btn } from '../../src/components/ui/Btn';
import { hexAlpha } from '../../src/lib/color';

type ChangeRow = { path: string; state: 'M' | 'A' };
type IssueRefMode = 'none' | 'refs' | 'fixes';

const TAB_BAR_HEIGHT = 60;

export default function GitScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    apiKey, manifest, modifiedCount, openFile, activeTask,
    pull, push, pulling, pushing,
  } = useSession();
  const [commitMsg, setCommitMsg] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [issueRefMode, setIssueRefMode] = useState<IssueRefMode>('refs');

  const linkedIssue = activeTask?.linkedIssue ?? null;

  function withIssueRef(base: string): string {
    if (!linkedIssue || issueRefMode === 'none') return base;
    const ref = issueRefMode === 'fixes'
      ? `Fixes #${linkedIssue.number}`
      : `Refs #${linkedIssue.number}`;
    return base + '\n\n' + ref;
  }

  const changes: ChangeRow[] = useMemo(() => {
    if (!manifest) return [];
    return Object.entries(manifest.files)
      .filter(([, e]) => e.modified)
      .map(([path, e]) => ({
        path,
        state: e.sha == null ? ('A' as const) : ('M' as const),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [manifest]);

  async function onPull() {
    try {
      const r = await pull();
      const total = r.added + r.updated;
      let title: string;
      let body: string;
      if (total === 0 && r.conflicts.length === 0) {
        title = 'Up to date';
        body = `${r.unchanged} file${r.unchanged === 1 ? '' : 's'} unchanged.`;
      } else if (r.conflicts.length === 0) {
        title = 'Pulled';
        const parts: string[] = [];
        if (r.added > 0) parts.push(`${r.added} added`);
        if (r.updated > 0) parts.push(`${r.updated} updated`);
        body = parts.join(', ') + '.';
      } else {
        title = `Pulled with ${r.conflicts.length} conflict${r.conflicts.length === 1 ? '' : 's'}`;
        const summary: string[] = [];
        if (r.added > 0) summary.push(`${r.added} added`);
        if (r.updated > 0) summary.push(`${r.updated} updated`);
        summary.push(`${r.conflicts.length} conflict${r.conflicts.length === 1 ? '' : 's'}`);
        const list = r.conflicts.slice(0, 5).map((p) => `  ${p}`).join('\n');
        const more = r.conflicts.length > 5
          ? `\n  …and ${r.conflicts.length - 5} more` : '';
        body = summary.join(', ') +
          '.\n\nConflicts (modified locally and remotely):\n' + list + more;
      }
      Alert.alert(title, body);
    } catch (e) {
      Alert.alert('Pull failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  async function onPush() {
    if (modifiedCount === 0) {
      Alert.alert('Nothing to push', 'No modified files since last sync.');
      return;
    }
    const base = commitMsg.trim() || 'msc: edits from Mobile Studio Code';
    const msg = withIssueRef(base);
    Alert.alert(
      `Push ${modifiedCount} file${modifiedCount === 1 ? '' : 's'}?`,
      `Commits to ${manifest?.repo} on ${manifest?.branch}.\n\nMessage: ${msg}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Push', onPress: async () => {
            try {
              const r = await push(msg);
              setCommitMsg('');
              Alert.alert(
                'Pushed',
                `${r.pushed} file${r.pushed === 1 ? '' : 's'} committed.`,
              );
            } catch (e) {
              Alert.alert(
                'Push failed', e instanceof Error ? e.message : 'Unknown error',
              );
            }
          },
        },
      ],
    );
  }

  async function onDraftCommit() {
    if (!apiKey || drafting || changes.length === 0) return;
    setDrafting(true);
    try {
      const fileLines = changes.map((c) => `${c.state} ${c.path}`).join('\n');
      const summary = linkedIssue
        ? `Task: ${activeTask?.title ?? ''}\nLinked issue #${linkedIssue.number}: ${linkedIssue.title}\n\nChanged files:\n${fileLines}`
        : fileLines;
      const msg = await anthropicDraftCommitMessage(apiKey, summary);
      setCommitMsg(msg);
    } catch (e) {
      Alert.alert('Draft failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDrafting(false);
    }
  }

  if (!manifest) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: t.fgMuted }]}>No repo loaded</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canDraft = !!apiKey && changes.length > 0 && !drafting;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <PageHeader
          crumbs={[manifest.repo, manifest.branch]}
          title={manifest.branch}
          meta={
            modifiedCount > 0
              ? <Text style={{ color: t.accent }}>{`${modifiedCount} changed`}</Text>
              : 'clean'
          }
          right={
            <Btn
              variant="primary"
              size="sm"
              onPress={onPush}
              disabled={modifiedCount === 0 || pushing}
            >
              {pushing ? '…' : 'push'}
            </Btn>
          }
        />

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Action row: pull + switch repo */}
          <View style={styles.actionRow}>
            <Btn variant="ghost" size="sm" onPress={onPull} disabled={pulling}>
              {pulling ? '↻ pulling…' : '↻ pull'}
            </Btn>
            <View style={styles.flex1} />
            <Btn variant="ghost" size="sm" onPress={() => router.push('/repo')}>
              switch repo
            </Btn>
          </View>

          {/* Changes */}
          <SectionLabel count={changes.length}>Changes</SectionLabel>
          <View style={styles.changeList}>
            {changes.length === 0 ? (
              <Text style={[styles.cleanText, { color: t.fgDim }]}>
                No modified files. Edit a file or ask Claude to make changes.
              </Text>
            ) : (
              changes.map((row) => {
                const isAdd = row.state === 'A';
                const badgeFg = isAdd ? t.success : t.accent;
                return (
                  <Pressable
                    key={row.path}
                    onPress={async () => {
                      await openFile(row.path);
                      router.push('/(tabs)/edit');
                    }}
                  >
                    <Card style={styles.changeCard}>
                      <View style={[styles.stateBadge, { backgroundColor: hexAlpha(badgeFg, 0.18) }]}>
                        <Text style={[styles.stateText, { color: badgeFg, fontFamily: t.fontMono }]}>
                          {row.state}
                        </Text>
                      </View>
                      <Text
                        style={[styles.filePath, { color: t.fg, fontFamily: t.fontMono }]}
                        numberOfLines={1}
                      >
                        {row.path}
                      </Text>
                    </Card>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* Commit message */}
          <SectionLabel
            action={canDraft ? (commitMsg.trim() ? '↻ regenerate' : '✦ draft with Claude') : undefined}
            onActionPress={canDraft ? onDraftCommit : undefined}
            hint={!apiKey ? 'add API key to draft' : drafting ? 'drafting…' : undefined}
          >
            Commit message
          </SectionLabel>

          <View style={styles.commitWrap}>
            <Card style={styles.commitCard}>
              <TextInput
                value={commitMsg}
                onChangeText={setCommitMsg}
                placeholder="Commit message…"
                placeholderTextColor={t.fgDim}
                style={[styles.commitInput, { color: t.fg, fontFamily: t.fontMono }]}
                multiline
                editable={!pushing}
              />

              {linkedIssue && (
                <View style={[styles.issueRefRow, { borderTopColor: t.borderColor }]}>
                  <Text
                    style={[styles.issueRefLabel, { color: t.fgDim, fontFamily: t.fontMono }]}
                    numberOfLines={1}
                  >
                    #{linkedIssue.number} · {linkedIssue.title}
                  </Text>
                  <View style={styles.issueRefChips}>
                    {(['refs', 'fixes', 'none'] as IssueRefMode[]).map((mode) => {
                      const active = mode === issueRefMode;
                      const label = mode === 'refs' ? `refs #${linkedIssue.number}`
                        : mode === 'fixes' ? `fixes #${linkedIssue.number}`
                        : 'none';
                      return (
                        <Pressable key={mode} onPress={() => setIssueRefMode(mode)}>
                          <Tag variant={active ? 'amber' : 'default'}>{label}</Tag>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={[styles.commitActions, { borderTopColor: t.borderColor }]}>
                {drafting && <ActivityIndicator size="small" color={t.fgMuted} />}
                <View style={styles.flex1} />
                <Btn
                  variant="primary"
                  size="sm"
                  onPress={onPush}
                  disabled={modifiedCount === 0 || pushing}
                >
                  {pushing ? '…' : `commit${modifiedCount > 0 ? ` · ${modifiedCount}` : ''}`}
                </Btn>
              </View>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14 },

  body: { flex: 1 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2,
  },

  changeList: { paddingHorizontal: 12, gap: 6 },
  cleanText: { fontSize: 12.5, paddingHorizontal: 4, paddingVertical: 8, lineHeight: 18 },
  changeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  stateBadge: {
    width: 18, height: 18, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  stateText: { fontSize: 10, fontWeight: '700' },
  filePath: { flex: 1, fontSize: 11.5 },

  commitWrap: { paddingHorizontal: 12, paddingTop: 2 },
  commitCard: { padding: 12 },
  commitInput: {
    fontSize: 12.5, paddingVertical: 4, paddingHorizontal: 4,
    paddingBottom: 10, minHeight: 44,
  },
  issueRefRow: { paddingTop: 8, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth },
  issueRefLabel: { fontSize: 11, marginBottom: 6 },
  issueRefChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  commitActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 6,
  },
});
