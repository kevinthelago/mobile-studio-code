import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useSession } from '../src/lib/session';
import { downloadRepo } from '../src/lib/github';
import { Surface } from '../src/components/ui/Surface';
import { ThemePicker } from '../src/components/ui/ThemePicker';

export default function RepoScreen() {
  const t = useTheme();
  const router = useRouter();
  const { pat, ghUser, manifest, selectRepo, resetAuth } = useSession();
  const [repo, setRepo] = useState(manifest?.repo ?? '');
  const [branch, setBranch] = useState(manifest?.branch ?? 'main');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();

  async function download() {
    if (!repo.includes('/')) {
      setError('Format: owner/repo (e.g. anthropics/anthropic-sdk-python)');
      return;
    }
    if (!pat) {
      setError('No GitHub token. Reset and reauthenticate.');
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
      await selectRepo(m);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusy(false);
    }
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

          <Surface style={styles.card} radius={10}>
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

            <Pressable
              style={[
                styles.primary,
                { backgroundColor: t.accent },
                busy && styles.disabled,
              ]}
              onPress={download}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Download repo</Text>
              )}
            </Pressable>

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

          <Surface style={styles.card} radius={10}>
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
  backLink: { paddingVertical: 6 },
  backLinkText: { fontSize: 14 },
  heroBlock: { paddingTop: 16, paddingBottom: 22 },
  eyebrow: {
    fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6, marginBottom: 10 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { padding: 16, marginBottom: 14 },
  label: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6,
  },
  labelTopGap: { marginTop: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, marginBottom: 12,
  },
  primary: {
    paddingVertical: 12, borderRadius: 6, alignItems: 'center',
    justifyContent: 'center', minHeight: 44, marginTop: 6,
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.4 },
  statusMsg: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  resetLink: { alignItems: 'center', marginTop: 8, paddingVertical: 12 },
  resetLinkText: { fontSize: 13 },
});
