import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import type { FleetWorkerData } from './WorkerCard';

type Props = {
  worker: FleetWorkerData;
  onApprove: (response: string) => void;
  onDismiss: () => void;
};

/**
 * Coordination inbox item — shown for workers that are awaiting user input or
 * have raised a gate that needs human approval. Expands inline to a text input
 * so the user can send a typed response without leaving this screen.
 */
export function CoordInboxCard({ worker, onApprove, onDismiss }: Props) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [response, setResponse] = useState('');

  const prompt = worker.userRequestPrompt ?? worker.currentTask;

  function handleApprove() {
    onApprove(response.trim() || 'y');
    setResponse('');
    setExpanded(false);
  }

  return (
    <Surface style={[styles.card, { borderColor: '#fbbf24' }]}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header}>
        <View style={styles.iconWrap}>
          <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
            <Path
              d="M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v4M8 10.5v.5"
              stroke="#fbbf24" strokeWidth={1.6} strokeLinecap="round"
            />
          </Svg>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.stream, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
            {worker.stream}
          </Text>
          {prompt ? (
            <Text style={styles.prompt} numberOfLines={expanded ? undefined : 2}>
              {prompt}
            </Text>
          ) : null}
        </View>
        <Svg
          width={13} height={13} viewBox="0 0 14 14" fill="none"
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        >
          <Path d="M5 3l4 4-4 4" stroke={t.fgDim} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <TextInput
            value={response}
            onChangeText={setResponse}
            placeholder="Type a response (default: y)"
            placeholderTextColor={t.fgDim}
            style={[styles.input, {
              color: t.fg, borderColor: t.borderColor,
              fontFamily: t.fontMono, backgroundColor: 'rgba(0,0,0,0.2)',
            }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleApprove}
          />
          <View style={styles.actions}>
            <Pressable onPress={onDismiss} style={[styles.actionBtn, { borderColor: t.borderColor }]}>
              <Text style={[styles.actionText, { color: t.fgMuted }]}>Dismiss</Text>
            </Pressable>
            <Pressable onPress={handleApprove} style={[styles.actionBtn, styles.approveBtn]}>
              <Text style={[styles.actionText, { color: '#fbbf24' }]}>
                {response.trim() ? 'Send' : 'Approve'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginBottom: 8 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, gap: 12,
  },
  iconWrap: { marginTop: 2, flexShrink: 0 },
  headerText: { flex: 1, minWidth: 0, gap: 3 },
  stream: { fontSize: 13, fontWeight: '600' },
  prompt: { fontSize: 12, color: '#fbbf24', lineHeight: 17 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  input: {
    height: 44, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 13,
  },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  actionBtn: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  approveBtn: { borderColor: '#fbbf24' },
  actionText: { fontSize: 13, fontWeight: '600' },
});
