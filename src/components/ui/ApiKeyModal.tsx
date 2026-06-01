import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTheme } from '../../theme';
import { verifyAnthropicKey } from '../../lib/anthropic';
import { Surface } from './Surface';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onSaved: (key: string) => void;
};

type Status = 'idle' | 'testing' | 'error';

// Just-in-time Anthropic key prompt. Shown the moment an on-device (standalone)
// action needs a key that isn't configured — e.g. sending a chat message or
// drafting a commit message. Walks the user through getting a key, verifies it
// on save, then hands it back to the caller so the original action can proceed.
export function ApiKeyModal({ visible, onCancel, onSaved }: Props) {
  const t = useTheme();
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState<string>();

  function reset() {
    setKey('');
    setStatus('idle');
    setMsg(undefined);
  }

  async function verifyAndSave(k: string) {
    setStatus('testing');
    setMsg(undefined);
    try {
      await verifyAnthropicKey(k);
      reset();
      onSaved(k);
    } catch (e) {
      setStatus('error');
      setMsg(e instanceof Error ? e.message : 'Verification failed');
    }
  }

  function onSave() {
    const k = key.trim();
    if (!k) return;
    if (!k.startsWith('sk-ant-')) {
      Alert.alert(
        "Doesn't look right",
        'Anthropic keys start with "sk-ant-". Save anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: () => verifyAndSave(k) },
        ],
      );
      return;
    }
    verifyAndSave(k);
  }

  function cancel() {
    reset();
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <Pressable style={styles.backdrop} onPress={cancel} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <Surface style={styles.sheet} radius={28}>
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: t.fgDim }]} />
          </View>

          <Text style={[styles.title, { color: t.fg }]}>Anthropic API key needed</Text>
          <Text style={[styles.subtitle, { color: t.fgMuted }]}>
            The on-device agent runs with your own Anthropic key. Add one to
            continue — or cancel and pair a desktop from the Run tab to use
            tunnel mode instead.
          </Text>

          <View style={styles.steps}>
            <Text style={[styles.step, { color: t.fgMuted }]}>
              1. Open console.anthropic.com → Settings → API Keys
            </Text>
            <Text style={[styles.step, { color: t.fgMuted }]}>
              2. Create a key and paste it below
            </Text>
            <Text style={[styles.step, { color: t.fgDim }]}>
              Stored only on this device, in the secure keychain.
            </Text>
          </View>

          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="sk-ant-…"
            placeholderTextColor={t.fgDim}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={onSave}
            style={[styles.input, {
              color: t.fg,
              fontFamily: t.fontMono,
              borderColor: t.borderColor,
              backgroundColor: t.glass ? 'rgba(0,0,0,0.25)' : t.surface,
            }]}
          />

          {msg && (
            <Text style={[styles.statusMsg, { color: '#ff8a8a' }]}>{msg}</Text>
          )}

          <View style={styles.actions}>
            <Pressable onPress={cancel} style={styles.secondaryBtn}>
              <Text style={[styles.secondaryBtnText, { color: t.fgMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={!key.trim() || status === 'testing'}
              style={[styles.primaryBtn, {
                backgroundColor: t.accent,
                opacity: !key.trim() || status === 'testing' ? 0.5 : 1,
              }]}
            >
              {status === 'testing' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Save & Verify</Text>
              )}
            </Pressable>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 8, paddingBottom: 8,
  },
  sheet: { paddingHorizontal: 16, paddingBottom: 18 },
  handle: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  title: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  steps: { marginTop: 14, gap: 6 },
  step: { fontSize: 12.5, lineHeight: 18 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, marginTop: 14,
  },
  statusMsg: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  actions: {
    flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center',
  },
  secondaryBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  secondaryBtnText: { fontSize: 14, fontWeight: '500' },
  primaryBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
