import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useSession } from '../src/lib/session';
import { downloadRepo, verifyGithubPat } from '../src/lib/github';
import { getRecentRepos, addRecentRepo, RecentRepo } from '../src/lib/storage';
import { Surface } from '../src/components/ui/Surface';
import { PrimaryButton } from '../src/components/ui/PrimaryButton';
import { ThemePicker } from '../src/components/ui/ThemePicker';

type PatStatus = 'idle' | 'testing' | 'ok' | 'error';

export default function RepoScreen() {
  const t = useTheme();
  const router = useRouter();
  const { pat, ghUser, manifest, selectRepo, resetAuth, saveGithubPat } = useSession();
  const [repo, setRepo] = useState(manifest?.repo ?? '');
  const [branch, setBranch] = useState(manifest?.branch ?? 'main');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const [recents, setRecents] = useState<RecentRepo[]>([]);

  useEffect(() => {
    getRecentRepos().then(setRecents);
  }, []);

  // GitHub token entry. Onboarding used to collect this; with onboarding gone
  // the repo picker is its home. Expanded by default until a token is stored.
  const [ghPat, setGhPat] = useState('');
  const [ghStatus, setGhStatus] = useState<PatStatus>('idle');
  const [ghMsg, setGhMsg] = useState<string>();
  const [showGhInput, setShowGhInput] = useState(!pat);

  async function saveGh() {
    const trimmed = ghPat.trim();
    if (!trimmed) return;
    setGhStatus('testing');
    setGhMsg(undefined);
    try {
      const u = await verifyGithubPat(trimmed);
      await saveGithubPat(trimmed, u.login);
      setGhPat('');
      setShowGhInput(false);
      setGhStatus('ok');
      const missing = ['repo'].filter((s) => !u.scopes.includes(s));
      setGhMsg(
        `Signed in as ${u.login}` +
          (missing.length ? ` · missing scopes: ${missing.join(', ')}` : ''),
      );
    } catch (e) {
      setGhStatus('error');
      setGhMsg(e instanceof Error ? e.message : 'Verification failed');
    }
  }

  async function download() {
    if (!repo.includes('/')) {
      setError('Format: owner/repo (e.g. anthropics/anthropic-sdk-python)');
      return;
    }
    if (!pat) {
      setError('Add a GitHub token above to download.');
      setShowGhInput(true);
      return;
    }
    setBusy(true);
    setError(undefined);
    setProgress('Fetching tree…');
    try {
      const m = await downloadRepo(
        pat, repo.trim(), branch.trim(),
        (i, total, p) => setProgress(`(${i + 1}/${total}) ${p}`),
      );
      await addRecentRepo(repo.trim(), branch.trim());
      await selectRepo(m);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  function pickRecent(r: RecentRepo) {
    setRepo(r.repo);
    setBranch(r.branch);
    setError(undefined);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sheet grabber — this screen slides up over the app */}
          <View style={[styles.grabber, { backgroundColor: t.borderColor }]} />

          {manifest && (
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              hitSlop={12}
              style={styles.backLink}
            >
              <Text style={[styles.backLinkText, { color: t.accent }]}>
                ← Back to {manifest.repo}
              </Text>
            </Pressable>
          )}

          <View style={styles.heroBlock}>
            <Text style={[styles.eyebrow, { color: t.fgDim }]}>Repository</Text>
            <Text style={[styles.title, { color: t.fg }]}>Pick a repo</Text>
            <Text style={[styles.subtitle, { color: t.fgMuted }]}>
              {ghUser ? `Signed in as ${ghUser}. ` : ''}
              Files are saved on this device. Push later to commit changes back.
            </Text>
          </View>

          <Pressable onPress={() => router.push('/(planner)/planner')}>
            <Surface style={styles.plannerEntry} radius={18}>
              <View style={[styles.plannerIcon, { backgroundColor: t.glass ? 'rgba(192,132,252,0.18)' : 'rgba(192,132,252,0.12)' }]}>
                <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                  <Path d="M4 3h10M4 7h10M4 11h6" stroke="#c084fc" strokeWidth={1.6} strokeLinecap="round" />
                </Svg>
              </View>
              <View style={styles.plannerText}>
                <Text style={[styles.plannerTitle, { color: t.fg }]}>Plan a project</Text>
                <Text style={[styles.plannerSub, { color: t.fgMuted }]}>
                  Turn an idea into a GitHub plan with Claude
                </Text>
              </View>
              <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
            </Surface>
          </Pressable>

          <Surface style={styles.card} radius={20}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: t.fg }]}>GitHub</Text>
              {pat && (
                <Text style={[styles.verifiedTag, { color: t.code.ty, fontFamily: t.fontMono }]}>
                  connected
                </Text>
              )}
            </View>

            {pat && !showGhInput ? (
              <View style={styles.connectedRow}>
                <Text style={[styles.connectedText, { color: t.fgMuted }]} numberOfLines={1}>
                  {ghUser ? `Signed in as ${ghUser}.` : 'Token saved.'}
                </Text>
                <Pressable onPress={() => { setShowGhInput(true); setGhMsg(undefined); }} hitSlop={8}>
                  <Text style={[styles.replaceLink, { color: t.accent }]}>Replace</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={[styles.helpText, { color: t.fgMuted }]}>
                  Personal access token with the "repo" scope. Create one at
                  github.com → Settings → Developer settings.
                </Text>
                <TextInput
                  value={ghPat}
                  onChangeText={setGhPat}
                  placeholder="ghp_… or github_pat_…"
                  placeholderTextColor={t.fgDim}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, {
                    color: t.fg,
                    fontFamily: t.fontMono,
                    borderColor: t.borderColor,
                    backgroundColor: 'rgba(0,0,0,0.25)',
                  }]}
                  editable={ghStatus !== 'testing'}
                />
                <PrimaryButton
                  label="Save & Verify"
                  onPress={saveGh}
                  loading={ghStatus === 'testing'}
                  disabled={!ghPat.trim()}
                  style={styles.primary}
                />
              </>
            )}
            {ghMsg && (
              <Text style={[
                styles.statusMsg,
                { color: ghStatus === 'error' ? '#ff8a8a' : t.code.ty },
              ]}>
                {ghMsg}
              </Text>
            )}
          </Surface>

          <Surface style={styles.card} radius={20}>
            <Text style={[styles.label, { color: t.fgDim }]}>Repository</Text>
            <TextInput
              value={repo}
              onChangeText={setRepo}
              placeholder="owner/repo"
              placeholderTextColor={t.fgDim}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, {
                color: t.fg,
                fontFamily: t.fontMono,
                borderColor: t.borderColor,
                backgroundColor: 'rgba(0,0,0,0.25)',
              }]}
              editable={!busy}
            />

            <Text style={[styles.label, styles.labelTopGap, { color: t.fgDim }]}>Branch</Text>
            <TextInput
              value={branch}
              onChangeText={setBranch}
              placeholder="main"
              placeholderTextColor={t.fgDim}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, {
                color: t.fg,
                fontFamily: t.fontMono,
                borderColor: t.borderColor,
                backgroundColor: 'rgba(0,0,0,0.25)',
              }]}
              editable={!busy}
            />

            <PrimaryButton
              label="Download repo"
              onPress={download}
              loading={busy}
              style={styles.primary}
            />

            {progress && (
              <Text
                style={[styles.statusMsg, { color: t.fgMuted, fontFamily: t.fontMono }]}
                numberOfLines={1}
              >
                {progress}
              </Text>
            )}
            {error && (
              <Text style={[styles.statusMsg, { color: '#ff8a8a' }]}>{error}</Text>
            )}
          </Surface>

          {recents.length > 0 && (
            <View style={styles.recentsBlock}>
              <Text style={[styles.recentsLabel, { color: t.fgDim }]}>Recent</Text>
              <Surface style={styles.recentsCard} radius={20}>
                {recents.map((r, i) => (
                  <Pressable
                    key={`${r.repo}#${r.branch}`}
                    onPress={() => pickRecent(r)}
                    style={[
                      styles.recentRow,
                      i < recents.length - 1 && { borderBottomColor: t.borderColor, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                      <Circle cx={3.5} cy={3.5} r={1.6} stroke={t.fgMuted} strokeWidth={1.4} />
                      <Circle cx={3.5} cy={10.5} r={1.6} stroke={t.fgMuted} strokeWidth={1.4} />
                      <Circle cx={10.5} cy={7} r={1.6} stroke={t.fgMuted} strokeWidth={1.4} />
                      <Path d="M3.5 5v5M5.5 3.5h3a2 2 0 012 2v.5" stroke={t.fgMuted} strokeWidth={1.4} />
                    </Svg>
                    <Text style={[styles.recentRepo, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
                      {r.repo}
                    </Text>
                    <Text style={[styles.recentBranch, { color: t.fgDim, fontFamily: t.fontMono }]} numberOfLines={1}>
                      {r.branch}
                    </Text>
                  </Pressable>
                ))}
              </Surface>
            </View>
          )}

          <Surface style={styles.card} radius={20}>
            <ThemePicker />
          </Surface>

          <Pressable onPress={resetAuth} style={styles.resetLink} hitSlop={8}>
            <Text style={[styles.resetLinkText, { color: t.fgMuted }]}>
              Sign out and reset credentials
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  grabber: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginTop: 2, marginBottom: 14,
  },
  backLink: { paddingVertical: 6 },
  backLinkText: { fontSize: 14 },

  recentsBlock: { marginBottom: 14 },
  recentsLabel: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6, paddingHorizontal: 4,
  },
  recentsCard: { paddingHorizontal: 4 },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 10,
  },
  recentRepo: { flex: 1, fontSize: 13 },
  recentBranch: { fontSize: 11, flexShrink: 0 },
  heroBlock: { paddingTop: 16, paddingBottom: 22 },
  eyebrow: {
    fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6, marginBottom: 10 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  plannerEntry: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 14 },
  plannerIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  plannerText: { flex: 1, minWidth: 0 },
  plannerTitle: { fontSize: 14, fontWeight: '600' },
  plannerSub: { fontSize: 11.5, marginTop: 1 },
  card: { padding: 16, marginBottom: 14 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  verifiedTag: { fontSize: 11, letterSpacing: 0.6 },
  connectedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  connectedText: { fontSize: 13, flexShrink: 1 },
  replaceLink: { fontSize: 13, fontWeight: '600' },
  helpText: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  label: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6,
  },
  labelTopGap: { marginTop: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, marginBottom: 12,
  },
  primary: { marginTop: 6 },
  statusMsg: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  resetLink: { alignItems: 'center', marginTop: 8, paddingVertical: 12 },
  resetLinkText: { fontSize: 13 },
});
