import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { Surface } from '../../src/components/ui/Surface';
import { ClaudeAvatar } from '../../src/components/ui/ClaudeAvatar';

type ChangeRow = { path: string; state: 'M' | 'A' };

type IssueRefMode = 'none' | 'refs' | 'fixes';

export default function GitScreen() {
  const t = useTheme();
  const router = useRouter();
  const {
    manifest, modifiedCount, openFile, activeTask,
    pull, push, pulling, pushing, draftCommitMessage,
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
    if (drafting || changes.length === 0) return;
    setDrafting(true);
    try {
      const fileLines = changes.map((c) => `${c.state} ${c.path}`).join('\n');
      const summary = linkedIssue
        ? `Task: ${activeTask?.title ?? ''}\nLinked issue #${linkedIssue.number}: ${linkedIssue.title}\n\nChanged files:\n${fileLines}`
        : fileLines;
      const msg = await draftCommitMessage(summary);
      setCommitMsg(msg);
    } catch (e) {
      Alert.alert('Draft failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDrafting(false);
    }
  }

  if (!manifest) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: t.fgMuted }]}>No repo loaded</Text>
        </View>
      </SafeAreaView>
    );
  }

  const FileRow = ({ row }: { row: ChangeRow }) => {
    const isAdd = row.state === 'A';
    const badgeBg = isAdd ? 'rgba(126,226,196,0.18)' : 'rgba(255,212,121,0.18)';
    const badgeFg = isAdd ? t.code.ty : t.code.nm;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={async () => {
          await openFile(row.path);
          router.push('/(tabs)/edit');
        }}
        style={[styles.fileRow, { borderTopColor: t.borderColor }]}
      >
        <View style={[styles.stateBadge, { backgroundColor: badgeBg }]}>
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
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: t.fgDim }]}>Branch</Text>
            <View style={styles.branchRow}>
              <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                <Circle cx={5} cy={4} r={2} stroke={t.accent} strokeWidth={1.8} />
                <Circle cx={5} cy={14} r={2} stroke={t.accent} strokeWidth={1.8} />
                <Circle cx={13} cy={9} r={2} stroke={t.accent} strokeWidth={1.8} />
                <Path d="M5 6v6M7 4h4a2 2 0 012 2v1" stroke={t.accent} strokeWidth={1.8} />
              </Svg>
              <Text
                style={[styles.branchName, { color: t.fg, fontFamily: t.fontMono }]}
                numberOfLines={1}
              >
                {manifest.branch}
              </Text>
            </View>
            <Text style={[styles.upstreamText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
              {manifest.repo}{modifiedCount > 0 ? ` · ${modifiedCount} modified` : ' · clean'}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.actionItem} onPress={onPull} disabled={pulling}>
              <Surface radius={14} style={styles.actionSurface}>
                {pulling ? (
                  <ActivityIndicator size="small" color={t.fg} />
                ) : (
                  <Text style={[styles.actionIcon, { color: t.fg }]}>↓</Text>
                )}
                <Text style={[styles.actionLabel, { color: t.fgMuted }]}>Pull</Text>
              </Surface>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={onPush} disabled={pushing}>
              {modifiedCount > 0 ? (
                <View style={[styles.actionSurface, styles.actionReady, {
                  backgroundColor: t.accent, borderRadius: 14, borderWidth: 0,
                }]}>
                  {pushing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.actionIcon, styles.actionIconReady]}>↑</Text>
                  )}
                  <Text style={[styles.actionLabel, styles.actionLabelReady]}>
                    Push ({modifiedCount})
                  </Text>
                </View>
              ) : (
                <Surface radius={14} style={styles.actionSurface}>
                  {pushing ? (
                    <ActivityIndicator size="small" color={t.fg} />
                  ) : (
                    <Text style={[styles.actionIcon, { color: t.fg }]}>↑</Text>
                  )}
                  <Text style={[styles.actionLabel, { color: t.fgMuted }]}>Push</Text>
                </Surface>
              )}
            </Pressable>

            <Pressable style={styles.actionItem} onPress={() => router.push('/repo')}>
              <Surface radius={14} style={styles.actionSurface}>
                <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                  <Path
                    d="M3 4a1 1 0 011-1h3l1 1h6a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4z"
                    stroke={t.fg} strokeWidth={1.6}
                  />
                </Svg>
                <Text style={[styles.actionLabel, { color: t.fgMuted }]}>Switch</Text>
              </Surface>
            </Pressable>
          </View>

          <View style={styles.changesWrap}>
            <Surface style={styles.changesCard}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: t.fgDim }]}>Modified</Text>
                <Text style={[styles.sectionCount, { color: t.fgDim }]}>{changes.length}</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {changes.length === 0 && (
                  <Text style={[styles.cleanText, { color: t.fgDim }]}>
                    No modified files. Edit a file or ask Claude to make changes.
                  </Text>
                )}
                {changes.map((row, i) => <FileRow key={row.path + i} row={row} />)}
              </ScrollView>
            </Surface>
          </View>

          <View style={styles.commitWrap}>
            <Surface style={styles.commitCard} radius={20}>
              <TextInput
                value={commitMsg}
                onChangeText={setCommitMsg}
                placeholder="Commit message…"
                placeholderTextColor={t.fgDim}
                style={[styles.commitInput, { color: t.fg }]}
                multiline
                editable={!pushing}
              />
              {linkedIssue && (
                <View style={[styles.issueRefRow, { borderTopColor: t.borderColor }]}>
                  <Text style={[styles.issueRefLabel, {
                    color: t.fgDim, fontFamily: t.fontMono,
                  }]} numberOfLines={1}>
                    #{linkedIssue.number} · {linkedIssue.title}
                  </Text>
                  <View style={styles.issueRefChips}>
                    {(['refs', 'fixes', 'none'] as IssueRefMode[]).map((mode) => {
                      const active = mode === issueRefMode;
                      return (
                        <Pressable
                          key={mode}
                          onPress={() => setIssueRefMode(mode)}
                          style={[styles.issueRefChip, {
                            backgroundColor: active
                              ? t.accent
                              : t.glass ? 'rgba(255,255,255,0.08)' : t.bg,
                            borderColor: t.borderColor,
                            borderRadius: t.sharp ? 4 : 12,
                          }]}
                        >
                          <Text style={[styles.issueRefChipText, {
                            color: active ? '#fff' : t.fgMuted,
                          }]}>
                            {mode === 'refs' ? `Refs #${linkedIssue.number}`
                              : mode === 'fixes' ? `Fixes #${linkedIssue.number}`
                              : 'None'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
              <View style={[styles.commitActions, { borderTopColor: t.borderColor }]}>
                <Pressable
                  onPress={onDraftCommit}
                  disabled={drafting || changes.length === 0}
                  style={styles.draftBtn}
                  hitSlop={8}
                >
                  {drafting ? (
                    <ActivityIndicator size="small" color={t.fgMuted} />
                  ) : (
                    <ClaudeAvatar size={14} />
                  )}
                  <Text style={[styles.draftBtnText, { color: t.fgMuted }]}>
                    Draft with Claude
                  </Text>
                </Pressable>
                <View style={styles.flex1} />
                <Pressable
                  style={[styles.commitBtn, {
                    backgroundColor: t.accent,
                    opacity: modifiedCount === 0 || pushing ? 0.4 : 1,
                  }]}
                  onPress={onPush}
                  disabled={modifiedCount === 0 || pushing}
                >
                  {pushing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.commitBtnText}>
                      Commit{modifiedCount > 0 ? ` · ${modifiedCount}` : ''}
                    </Text>
                  )}
                </Pressable>
              </View>
            </Surface>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  container: { flex: 1, paddingBottom: 110 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14 },

  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  eyebrow: {
    fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '600',
  },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  branchName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, flexShrink: 1 },
  upstreamText: { fontSize: 12, marginTop: 4 },

  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  actionItem: { flex: 1 },
  actionSurface: { height: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionReady: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionIcon: { fontSize: 18, lineHeight: 22 },
  actionIconReady: { color: '#fff' },
  actionLabel: { fontSize: 11, fontWeight: '500' },
  actionLabelReady: { color: '#fff' },

  changesWrap: { flex: 1, marginHorizontal: 12, marginTop: 12 },
  changesCard: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600',
  },
  sectionCount: { fontSize: 11 },
  cleanText: { fontSize: 12.5, padding: 16, lineHeight: 18 },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stateBadge: {
    width: 18, height: 18, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  stateText: { fontSize: 10, fontWeight: '700' },
  filePath: { flex: 1, fontSize: 13 },

  commitWrap: { marginHorizontal: 12, marginTop: 10, marginBottom: 110 },
  commitCard: { padding: 12 },
  commitInput: {
    fontSize: 13.5, paddingVertical: 4, paddingHorizontal: 4,
    paddingBottom: 10, minHeight: 44,
  },
  issueRefRow: { paddingTop: 8, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth },
  issueRefLabel: { fontSize: 11, marginBottom: 6 },
  issueRefChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  issueRefChip: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth },
  issueRefChipText: { fontSize: 11, fontWeight: '500' },
  commitActions: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10,
  },
  draftBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  draftBtnText: { fontSize: 11.5 },
  commitBtn: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 14,
    minWidth: 110, alignItems: 'center',
  },
  commitBtnText: { fontSize: 12.5, fontWeight: '600', color: '#fff' },
});
