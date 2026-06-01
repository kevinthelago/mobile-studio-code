import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme } from '../src/theme';
import { useSession } from '../src/lib/session';
import { useTunnel } from '../src/lib/TunnelContext';
import { useApiKeyPrompt } from '../src/lib/ApiKeyContext';
import { verifyGithubPat } from '../src/lib/github';
import { PageHeader } from '../src/components/ui/PageHeader';
import { SectionLabel } from '../src/components/ui/SectionLabel';
import { Card } from '../src/components/ui/Card';
import { Btn } from '../src/components/ui/Btn';
import { ThemePicker } from '../src/components/ui/ThemePicker';
import { TunnelConnectionState } from '../src/lib/types';

// Settings — reached from the session strip's ▦ menu (see SessionStrip). Not a
// bottom tab. Groups credentials (GitHub PAT, Anthropic key — both optional and
// requested just-in-time elsewhere), the tunnel connection, the active repo,
// appearance, and about/sign-out. Only controls backed by real capability are
// shown — no decorative toggles.

function tunnelStatus(s: TunnelConnectionState): { label: string; color: string } {
  switch (s) {
    case 'connected': return { label: 'connected', color: '#4ade80' };
    case 'connecting':
    case 'authenticating': return { label: 'connecting…', color: '#fbbf24' };
    case 'error': return { label: 'error', color: '#f87171' };
    default: return { label: 'offline', color: 'rgba(255,255,255,0.4)' };
  }
}

function SetRow({
  icon, title, sub, value, chevron, onPress, danger, last,
}: {
  icon?: string;
  title: string;
  sub?: string;
  value?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const t = useTheme();
  const titleColor = danger ? '#f87171' : t.fg;
  const body = (
    <View style={[styles.row, !last && { borderBottomColor: t.borderColor, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {icon != null && (
        <Text style={[styles.rowIcon, { color: danger ? '#f87171' : t.fgMuted, fontFamily: t.fontMono }]}>
          {icon}
        </Text>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
        {sub != null && <Text style={[styles.rowSub, { color: t.fgDim }]}>{sub}</Text>}
      </View>
      {value != null && <View style={styles.rowValue}>{value}</View>}
      {chevron && <Text style={[styles.chev, { color: t.fgDim }]}>›</Text>}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const {
    pat, apiKey, ghUser, manifest, saveAuth, saveApiKey, resetAuth,
  } = useSession();
  const { connectionState, disconnect, unpair, hasPairing } = useTunnel();
  const { requestApiKey } = useApiKeyPrompt();

  const [showPat, setShowPat] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [patBusy, setPatBusy] = useState(false);
  const [patMsg, setPatMsg] = useState<string>();

  const version = Constants.expoConfig?.version ?? '—';
  const status = tunnelStatus(connectionState);

  async function connectGithub() {
    const trimmed = patInput.trim();
    if (!trimmed) return;
    setPatBusy(true);
    setPatMsg(undefined);
    try {
      const u = await verifyGithubPat(trimmed);
      // Preserve the existing Anthropic key; only GitHub identity changes.
      await saveAuth(trimmed, apiKey, u.login);
      setPatInput('');
      setShowPat(false);
      const missing = ['repo'].filter((s) => !u.scopes.includes(s));
      if (missing.length) {
        Alert.alert('Connected', `Signed in as ${u.login}, but missing scopes: ${missing.join(', ')}`);
      }
    } catch (e) {
      setPatMsg(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setPatBusy(false);
    }
  }

  async function manageApiKey() {
    if (apiKey) {
      Alert.alert('Anthropic key', 'A key is configured for the on-device agent.', [
        { text: 'Keep' },
        { text: 'Replace', onPress: () => requestApiKey() },
        { text: 'Remove', style: 'destructive', onPress: () => saveApiKey(null) },
      ]);
    } else {
      await requestApiKey();
    }
  }

  function confirmUnpair() {
    Alert.alert(
      'Forget this desktop?',
      'Unpairing returns the app to standalone and clears the saved connection. '
        + 'Your repo, files, tasks, and keys stay on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpair', style: 'destructive', onPress: () => { unpair(); } },
      ],
    );
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign out',
      'Removes your GitHub token, Anthropic key, and the selected repo from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => { await resetAuth(); },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageHeader
        crumbs={['base-studio-code', 'settings']}
        title="Settings"
        meta={
          <>
            v{version} ·{' '}
            <Text style={{ color: status.color }}>● {status.label}</Text>
          </>
        }
        right={<Btn variant="ghost" size="sm" onPress={() => router.back()}>Done</Btn>}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {/* Account / GitHub */}
          <SectionLabel>Account</SectionLabel>
          <Card style={styles.group}>
            <SetRow
              icon="◐"
              title={ghUser ? ghUser : 'GitHub not connected'}
              sub={ghUser
                ? 'Personal access token stored on this device'
                : 'Needed for files, pull/push, and issues'}
              value={
                <Btn variant={ghUser ? 'default' : 'primary'} size="sm" onPress={() => setShowPat((v) => !v)}>
                  {ghUser ? 'replace' : 'connect'}
                </Btn>
              }
              last={!showPat}
            />
            {showPat && (
              <View style={styles.inlineForm}>
                <Text style={[styles.help, { color: t.fgMuted }]}>
                  PAT with "repo" scope · github.com → Settings → Developer settings.
                </Text>
                <TextInput
                  value={patInput}
                  onChangeText={setPatInput}
                  placeholder="ghp_… or github_pat_…"
                  placeholderTextColor={t.fgDim}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, {
                    color: t.fg, fontFamily: t.fontMono, borderColor: t.borderColor,
                    backgroundColor: t.glass ? 'rgba(0,0,0,0.25)' : t.surface,
                  }]}
                />
                {patMsg && <Text style={[styles.errMsg, { color: '#ff8a8a' }]}>{patMsg}</Text>}
                <View style={styles.formActions}>
                  <Btn variant="ghost" size="sm" onPress={() => { setShowPat(false); setPatInput(''); setPatMsg(undefined); }}>
                    Cancel
                  </Btn>
                  <Btn
                    variant="primary"
                    size="sm"
                    disabled={!patInput.trim() || patBusy}
                    onPress={connectGithub}
                  >
                    {patBusy ? 'Verifying…' : 'Save & Verify'}
                  </Btn>
                </View>
              </View>
            )}
          </Card>

          {/* AI */}
          <SectionLabel hint="on-device agent">AI</SectionLabel>
          <Card style={styles.group}>
            <SetRow
              icon="✦"
              title="Anthropic API key"
              sub={apiKey
                ? 'Configured — powers the standalone agent'
                : 'Optional — added when you first run the agent'}
              value={
                <Text style={[styles.valText, {
                  color: apiKey ? '#4ade80' : t.fgDim, fontFamily: t.fontMono,
                }]}>
                  {apiKey ? 'configured' : 'not set'}
                </Text>
              }
              onPress={manageApiKey}
              chevron
              last
            />
          </Card>

          {/* Tunnel & host */}
          <SectionLabel>Tunnel &amp; host</SectionLabel>
          <Card style={styles.group}>
            <SetRow
              icon="⇋"
              title={connectionState === 'connected' ? 'Connected to desktop' : 'Tunnel offline'}
              sub={connectionState === 'connected'
                ? 'Mirroring desktop sessions'
                : 'Pair with base-studio-code to work in tunnel mode'}
              value={
                <Text style={[styles.valText, { color: status.color, fontFamily: t.fontMono }]}>
                  ● {status.label}
                </Text>
              }
            />
            <SetRow
              icon="⌁"
              title={connectionState === 'connected' ? 'Manage sessions' : 'Pair a desktop'}
              sub="Open the Run tab"
              onPress={() => router.navigate('/(tabs)/run' as never)}
              chevron
              last={!hasPairing}
            />
            {connectionState === 'connected' && (
              <SetRow
                icon="⊘"
                title="Disconnect"
                sub="Temporary — reconnects on next launch"
                onPress={disconnect}
              />
            )}
            {hasPairing && (
              <SetRow
                icon="⊗"
                title="Unpair / forget desktop"
                sub="Clears the saved connection; repo state stays intact"
                onPress={confirmUnpair}
                danger
                last
              />
            )}
          </Card>

          {/* Repository */}
          <SectionLabel>Repository</SectionLabel>
          <Card style={styles.group}>
            <SetRow
              icon="◴"
              title={manifest ? manifest.repo : 'No repo selected'}
              sub={manifest ? `branch ${manifest.branch}` : 'Download a repo to browse and edit files'}
              value={
                <Btn variant={manifest ? 'default' : 'primary'} size="sm" onPress={() => router.navigate('/repo')}>
                  {manifest ? 'switch' : 'add'}
                </Btn>
              }
              last
            />
          </Card>

          {/* Appearance */}
          <SectionLabel>Appearance</SectionLabel>
          <Card style={styles.appearanceCard}>
            <ThemePicker />
          </Card>

          {/* About */}
          <SectionLabel>About</SectionLabel>
          <Card style={styles.group}>
            <SetRow icon="ℹ" title="Version" value={
              <Text style={[styles.valText, { color: t.fgMuted, fontFamily: t.fontMono }]}>{version}</Text>
            } />
            <SetRow
              icon="⊘"
              title="Sign out"
              sub={ghUser ?? undefined}
              onPress={confirmSignOut}
              danger
              last
            />
          </Card>

          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },
  body: { padding: 16, paddingTop: 8 },
  group: { padding: 0, marginBottom: 8, overflow: 'hidden' },
  appearanceCard: { padding: 14, marginBottom: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 52,
  },
  rowIcon: { width: 18, fontSize: 14, textAlign: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '500' },
  rowSub: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  rowValue: { flexShrink: 0 },
  valText: { fontSize: 11.5 },
  chev: { fontSize: 18, marginLeft: 2 },

  inlineForm: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 },
  help: { fontSize: 11.5, lineHeight: 16, marginBottom: 10 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
  },
  errMsg: { fontSize: 12, marginTop: 8 },
  formActions: {
    flexDirection: 'row', gap: 8, marginTop: 12,
    alignItems: 'center', justifyContent: 'flex-end',
  },
});
