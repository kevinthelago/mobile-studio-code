import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { AttachedImage, ChatTurn, RetryStatus } from '../../src/lib/types';
import { Surface } from '../../src/components/ui/Surface';
import { TopPill } from '../../src/components/ui/TopPill';
import { IconBtn } from '../../src/components/ui/IconBtn';
import { ClaudeAvatar } from '../../src/components/ui/ClaudeAvatar';
import { TaskSheet } from '../../src/components/ui/TaskSheet';

function summarizeToolInput(name: string, input: Record<string, unknown>) {
  if (typeof input.path === 'string') {
    if (name === 'write_file' && typeof input.content === 'string') {
      return `${input.path} (${input.content.length} chars)`;
    }
    return input.path;
  }
  return JSON.stringify(input);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function RetryBanner({
  status, onCancel,
}: { status: NonNullable<RetryStatus>; onCancel: () => void }) {
  const t = useTheme();
  const [remaining, setRemaining] = useState(status.delayMs);
  useEffect(() => {
    setRemaining(status.delayMs);
    if (status.delayMs <= 0) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, status.delayMs - elapsed);
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [status]);
  return (
    <View style={[styles.retryBanner, { borderColor: t.borderColor }]}>
      <ActivityIndicator size="small" color={t.accent} />
      <View style={styles.retryTextWrap}>
        <Text style={[styles.retryTitle, { color: t.fg }]}>
          Retry {status.attempt} in {(remaining / 1000).toFixed(1)}s
        </Text>
        <Text style={[styles.retrySubtitle, { color: t.fgMuted }]} numberOfLines={1}>
          {truncate(status.error, 80)}
        </Text>
      </View>
      <TouchableOpacity onPress={onCancel} hitSlop={8} style={styles.retryCancel}>
        <Text style={styles.retryCancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

function TurnView({ turn }: { turn: ChatTurn }) {
  const t = useTheme();
  if (turn.kind === 'user') {
    return (
      <View style={styles.userRow}>
        <Text style={[styles.promptArrow, { color: t.accent, fontFamily: t.fontMono }]}>›</Text>
        <Text style={[styles.userText, { color: t.fg, fontFamily: t.fontMono }]}>{turn.text}</Text>
      </View>
    );
  }
  if (turn.kind === 'assistant') {
    return (
      <Text style={[styles.replyText, { color: t.fg }]}>{turn.text}</Text>
    );
  }
  if (turn.kind === 'note') {
    return (
      <Text style={[styles.noteLine, {
        color: t.fgDim, fontFamily: t.fontMono, borderLeftColor: t.borderColor,
      }]}>
        ↳ {turn.text}
      </Text>
    );
  }
  return (
    <View style={[styles.toolCard, {
      backgroundColor: t.glass ? 'rgba(255,255,255,0.05)' : t.surface,
      borderColor: t.borderColor,
    }]}>
      <Text style={[styles.toolTitle, { color: t.fgMuted, fontFamily: t.fontMono }]}>
        {turn.name} · {summarizeToolInput(turn.name, turn.input)}
      </Text>
      {turn.result === undefined ? (
        <Text style={[styles.toolRunning, { color: t.fgMuted, fontFamily: t.fontMono }]}>
          running…
        </Text>
      ) : (
        <Text style={[styles.toolResult, {
          color: turn.isError ? '#ff8a8a' : t.code.ty,
          fontFamily: t.fontMono,
        }]}>
          {turn.isError ? '✗ ' : '✓ '}
          {truncate(turn.result, 200)}
        </Text>
      )}
    </View>
  );
}

const SUGGESTIONS = ['Explain this repo', 'Show recent changes', 'Run the tests'];

export default function RunScreen() {
  const t = useTheme();
  const {
    manifest, activeTask, turns, send, chatBusy, retry, cancelChat,
    resumeNotice, clearChat,
  } = useSession();
  const [input, setInput] = useState('');
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<AttachedImage[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [turns.length, chatBusy]);

  async function handleSend(text?: string) {
    const trimmed = (text ?? input).trim();
    const imgs = pendingImages;
    // Allow images-only sends. Suggestion chips pass `text` directly and
    // never have images, so the suggestion path stays text-only.
    if ((!trimmed && imgs.length === 0) || chatBusy) return;
    if (text === undefined) setInput('');
    setPendingImages([]);
    await send(trimmed, imgs.length > 0 ? imgs : undefined);
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access in Settings to attach screenshots.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
      exif: false,
    });
    if (result.canceled) return;
    const newImages: AttachedImage[] = result.assets
      .filter((a) => a.base64)
      .map((a) => ({
        uri: a.uri,
        base64: a.base64!,
        mediaType: (a.mimeType ?? 'image/jpeg') as AttachedImage['mediaType'],
      }));
    setPendingImages((prev) => [...prev, ...newImages]);
  }

  function handleRemoveImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  function confirmClear() {
    if (turns.length === 0) return;
    Alert.alert('Clear conversation?', 'This wipes the local chat history for this repo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearChat() },
    ]);
  }

  const toolCalls = turns.filter((x) => x.kind === 'tool').length;
  const userTurns = turns.filter((x) => x.kind === 'user').length;
  const isEmpty = turns.length === 0 && !chatBusy && !resumeNotice;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <TopPill
            left={<ClaudeAvatar size={24} />}
            center={
              <Pressable onPress={() => setTaskSheetOpen(true)} hitSlop={6}>
                <View style={styles.taskCenter}>
                  <Text style={[styles.pillTitle, { color: t.fg }]} numberOfLines={1}>
                    {activeTask?.title ?? 'Claude'}
                    <Text style={{ color: t.fgDim }}>  ⌄</Text>
                  </Text>
                  <Text
                    style={[styles.pillSub, { color: t.fgMuted, fontFamily: t.fontMono }]}
                    numberOfLines={1}
                  >
                    {activeTask?.linkedIssue ? `#${activeTask.linkedIssue.number} · ` : ''}
                    {userTurns} turn{userTurns === 1 ? '' : 's'} · {toolCalls} tool call{toolCalls === 1 ? '' : 's'}
                  </Text>
                </View>
              </Pressable>
            }
            right={
              <IconBtn onPress={confirmClear}>
                <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                  <Path
                    d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M4 4l1 8a1 1 0 001 1h2a1 1 0 001-1l1-8"
                    stroke={t.fg} strokeWidth={1.4} strokeLinecap="round"
                  />
                </Svg>
              </IconBtn>
            }
          />

          <TaskSheet
            visible={taskSheetOpen}
            onClose={() => setTaskSheetOpen(false)}
          />

          {resumeNotice && (
            <View style={[styles.resumeBanner, {
              backgroundColor: t.glass ? 'rgba(192,132,252,0.12)' : t.surface,
            }]}>
              <ActivityIndicator size="small" color={t.accent} />
              <Text style={[styles.resumeText, { color: t.accent2 }]}>{resumeNotice}</Text>
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            style={styles.transcript}
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <Text style={[styles.systemLine, { color: t.fgDim, fontFamily: t.fontMono }]}>
              · workspace: {manifest?.repo ?? '(none)'}
            </Text>
            {isEmpty && (
              <Text style={[styles.placeholder, { color: t.fgDim }]}>
                Ask Claude anything about your repo. It can list directories, read
                files, and write changes.
              </Text>
            )}
            {turns.map((turn, i) => <TurnView key={i} turn={turn} />)}
            {chatBusy && !retry && (
              <View style={styles.thinkingRow}>
                <View style={[styles.thinkingDot, { backgroundColor: t.code.ty }]} />
                <Text style={[styles.thinkingText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                  thinking…
                </Text>
              </View>
            )}
          </ScrollView>

          {retry && <RetryBanner status={retry} onCancel={cancelChat} />}

          {isEmpty && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionRow}
            >
              {SUGGESTIONS.map((s, i) => (
                <Pressable
                  key={s}
                  onPress={() => handleSend(s)}
                  style={[
                    styles.suggestionChip,
                    {
                      backgroundColor: i === 0
                        ? t.accent
                        : t.glass ? 'rgba(255,255,255,0.10)' : t.surface,
                      borderColor: t.borderColor,
                      borderWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderRadius: t.sharp ? 4 : 16,
                    },
                  ]}
                >
                  <Text style={[styles.suggestionText, {
                    color: i === 0 ? '#fff' : t.fg,
                  }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.inputWrap}>
            {pendingImages.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbStrip}
              >
                {pendingImages.map((img, i) => (
                  <View key={img.uri + i} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <Pressable
                      onPress={() => handleRemoveImage(i)}
                      hitSlop={6}
                      style={styles.thumbRemove}
                    >
                      <Text style={styles.thumbRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
            <Surface style={styles.inputBar} radius={26}>
              <IconBtn onPress={handlePickImage} disabled={chatBusy}>
                <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                  <Path
                    d="M7 1v12M1 7h12"
                    stroke={t.fg} strokeWidth={1.6} strokeLinecap="round"
                  />
                </Svg>
              </IconBtn>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask Claude…"
                placeholderTextColor={t.fgDim}
                style={[styles.inputText, { color: t.fg }]}
                multiline
                editable={!chatBusy}
              />
              {chatBusy ? (
                <Pressable onPress={cancelChat} style={[styles.cancelBtn, {
                  backgroundColor: 'rgba(255,138,138,0.15)',
                  borderColor: 'rgba(255,138,138,0.4)',
                }]}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              ) : (
                <IconBtn
                  primary
                  size={40}
                  onPress={() => handleSend()}
                  disabled={!input.trim() && pendingImages.length === 0}
                >
                  <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                    <Path
                      d="M7 11V3M3 7l4-4 4 4"
                      stroke="#fff" strokeWidth={2} strokeLinecap="round"
                    />
                  </Svg>
                </IconBtn>
              )}
            </Surface>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },
  container: { flex: 1, paddingBottom: 110 },

  pillTitle: { fontSize: 14, fontWeight: '600' },
  pillSub: { fontSize: 11 },
  taskCenter: { flex: 1, minWidth: 0 },

  resumeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    marginHorizontal: 16, marginTop: 8, borderRadius: 12,
  },
  resumeText: { fontSize: 12 },

  transcript: { flex: 1 },
  transcriptContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },
  placeholder: { fontSize: 13, lineHeight: 18, paddingVertical: 10 },
  systemLine: { fontSize: 11, marginBottom: 14 },
  noteLine: {
    fontSize: 11, marginVertical: 6, paddingLeft: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    fontStyle: 'italic',
  },
  userRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  promptArrow: { fontSize: 14 },
  userText: { fontSize: 13, flex: 1 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  thinkingDot: { width: 6, height: 6, borderRadius: 3 },
  thinkingText: { fontSize: 12 },
  toolCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  toolTitle: {
    fontSize: 10.5, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 4,
  },
  toolRunning: { fontSize: 11.5 },
  toolResult: { fontSize: 11.5 },
  replyText: { fontSize: 13.5, lineHeight: 20, marginBottom: 14 },

  retryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(255,184,107,0.10)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  retryTextWrap: { flex: 1 },
  retryTitle: { fontSize: 12.5, fontWeight: '600' },
  retrySubtitle: { fontSize: 11, marginTop: 1 },
  retryCancel: { paddingHorizontal: 8, paddingVertical: 4 },
  retryCancelText: { fontSize: 12.5, color: '#ff8a8a', fontWeight: '500' },

  suggestionRow: {
    paddingHorizontal: 16, paddingVertical: 8, gap: 8,
  },
  suggestionChip: {
    height: 32, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionText: { fontSize: 12.5, fontWeight: '500' },

  inputWrap: { paddingHorizontal: 12, paddingTop: 4 },
  inputBar: {
    height: 52,
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 8, paddingRight: 6, gap: 8,
  },
  inputText: { flex: 1, fontSize: 14, maxHeight: 120, paddingVertical: 6 },
  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelBtnText: { color: '#ff8a8a', fontSize: 13, fontWeight: '600' },

  thumbStrip: { paddingHorizontal: 4, paddingBottom: 6, gap: 8 },
  thumbWrap: { position: 'relative', marginRight: 8 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#222' },
  thumbRemove: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbRemoveText: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '600' },
});
