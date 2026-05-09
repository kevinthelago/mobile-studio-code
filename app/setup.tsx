import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { useSession } from '../src/lib/session';
import { verifyGithubPat } from '../src/lib/github';
import { verifyAnthropicKey } from '../src/lib/anthropic';
import { Surface } from '../src/components/ui/Surface';

type Status = 'idle' | 'testing' | 'ok' | 'error';

export default function SetupScreen() {
  const t = useTheme();
  const { saveAuth, pat, apiKey, ghUser } = useSession();

  const [ghPat, setGhPat] = useState('');
  const [ghStatus, setGhStatus] = useState<Status>('idle');
  const [ghMsg, setGhMsg] = useState<string>();
  const [ghStored, setGhStored] = useState(!!pat);
  const [ghLogin, setGhLogin] = useState<string | null>(ghUser);
  const [verifiedPat, setVerifiedPat] = useState<string | null>(pat);

  const [anKey, setAnKey] = useState('');
  const [anStatus, setAnStatus] = useState<Status>('idle');
  const [anMsg, setAnMsg] = useState<string>();
  const [anStored, setAnStored] = useState(!!apiKey);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(apiKey);

  async function saveGh() {
    setGhStatus('testing');
    setGhMsg(undefined);
    try {
      const trimmed = ghPat.trim();
      const u = await verifyGithubPat(trimmed);
      setGhStored(true);
      setGhLogin(u.login);
      setVerifiedPat(trimmed);
      setGhPat('');
      setGhStatus('ok');
      const missing = ['repo'].filter((s) => !u.scopes.includes(s));
      setGhMsg(
        `Signed in as ${u.login}` +
          (missing.length ? ` · missing scopes: ${missing.join(', ')}` : ''),
      );
    } catch (e) {
      setGhStatus('error');
      setGhMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function saveAn() {
    const k = anKey.trim();
    if (!k.startsWith('sk-ant-')) {
      Alert.alert(
        "Doesn't look right",
        'Anthropic keys start with "sk-ant-". Save anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: () => doSaveAn(k) },
        ],
      );
      return;
    }
    doSaveAn(k);
  }

  async function doSaveAn(k: string) {
    setAnStatus('testing');
    setAnMsg(undefined);
    try {
      await verifyAnthropicKey(k);
      setAnStored(true);
      setVerifiedKey(k);
      setAnKey('');
      setAnStatus('ok');
      setAnMsg('Key verified.');
    } catch (e) {
      setAnStatus('error');
      setAnMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function onContinue() {
    if (!verifiedPat || !verifiedKey || !ghLogin) return;
    await saveAuth(verifiedPat, verifiedKey, ghLogin);
  }

  const ready = ghStored && anStored && !!verifiedPat && !!verifiedKey;

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
          <View style={styles.heroBlock}>
            <Text style={[styles.eyebrow, { color: t.fgDim }]}>Setup</Text>
            <Text style={[styles.title, { color: t.fg }]}>Mobile Studio Code</Text>
            <Text style={[styles.subtitle, { color: t.fgMuted }]}>
              Connect GitHub and Anthropic to start coding from your phone.
              Both keys are verified on save and stored only on this device.
            </Text>
          </View>

          <Surface style={styles.card} radius={20}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: t.fg }]}>GitHub</Text>
              {ghStored && (
                <Text style={[styles.savedTag, { color: t.code.ty, fontFamily: t.fontMono }]}>
                  verified
                </Text>
              )}
            </View>
            <Text style={[styles.helpText, { color: t.fgMuted }]}>
              {ghLogin
                ? `Currently: ${ghLogin}. Enter a new PAT to replace.`
                : 'Personal access token with "repo" scope. Create at github.com → Settings → Developer settings.'}
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
            />
            <Pressable
              style={[
                styles.primary,
                { backgroundColor: t.accent },
                (!ghPat.trim() || ghStatus === 'testing') && styles.disabled,
              ]}
              onPress={saveGh}
              disabled={!ghPat.trim() || ghStatus === 'testing'}
            >
              {ghStatus === 'testing' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Save & Verify</Text>
              )}
            </Pressable>
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
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: t.fg }]}>Anthropic</Text>
              {anStored && (
                <Text style={[styles.savedTag, { color: t.code.ty, fontFamily: t.fontMono }]}>
                  verified
                </Text>
              )}
            </View>
            <Text style={[styles.helpText, { color: t.fgMuted }]}>
              API key from console.anthropic.com → Settings → API Keys.
            </Text>
            <TextInput
              value={anKey}
              onChangeText={setAnKey}
              placeholder="sk-ant-…"
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
            />
            <Pressable
              style={[
                styles.primary,
                { backgroundColor: t.accent },
                (!anKey.trim() || anStatus === 'testing') && styles.disabled,
              ]}
              onPress={saveAn}
              disabled={!anKey.trim() || anStatus === 'testing'}
            >
              {anStatus === 'testing' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Save & Verify</Text>
              )}
            </Pressable>
            {anMsg && (
              <Text style={[
                styles.statusMsg,
                { color: anStatus === 'error' ? '#ff8a8a' : t.code.ty },
              ]}>
                {anMsg}
              </Text>
            )}
          </Surface>

          <Pressable
            style={[
              styles.continue,
              { backgroundColor: t.accent2 },
              !ready && styles.disabled,
            ]}
            onPress={onContinue}
            disabled={!ready}
          >
            <Text style={styles.continueText}>
              {ready ? 'Continue' : 'Verify both above to continue'}
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
  heroBlock: { paddingTop: 16, paddingBottom: 22 },
  eyebrow: {
    fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6, marginBottom: 10 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { padding: 16, marginBottom: 14 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  savedTag: { fontSize: 11, letterSpacing: 0.6 },
  helpText: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, marginBottom: 12,
  },
  primary: {
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', minHeight: 44, marginTop: 6,
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.4 },
  statusMsg: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  continue: {
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', marginTop: 8,
  },
  continueText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
