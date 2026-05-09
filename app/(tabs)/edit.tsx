import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { detectLang, tokenizeFile } from '../../src/lib/syntax';
import { AttachedImage, ChatTurn } from '../../src/lib/types';
import { Surface } from '../../src/components/ui/Surface';
import { TopPill } from '../../src/components/ui/TopPill';
import { IconBtn } from '../../src/components/ui/IconBtn';
import { ClaudeAvatar } from '../../src/components/ui/ClaudeAvatar';

// Height of our custom bottom tab bar
const TAB_BAR_HEIGHT = 60;

function FilePathBreadcrumb({ path, dirty }: { path: string; dirty: boolean }) {
  const t = useTheme();
  const parts = path.split('/');
  const file = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.breadcrumb}>
      {dirs.map((d, i) => (
        <React.Fragment key={i}>
          <Text style={[styles.pathSegment, { color: t.fgDim, fontFamily: t.fontMono }]}>{d}</Text>
          <Text style={[styles.pathSegment, { color: t.fgDim, fontFamily: t.fontMono }]}>/</Text>
        </React.Fragment>
      ))}
      <Text style={[styles.pathSegment, styles.pathActive, { color: t.fg, fontFamily: t.fontMono }]}>
        {file}
      </Text>
      {dirty && <View style={[styles.dirtyDot, { backgroundColor: t.accent }]} />}
    </ScrollView>
  );
}

function TokenizedCode({ content, path }: { content: string; path: string }) {
  const t = useTheme();
  const lang = detectLang(path);
  const lines = useMemo(() => tokenizeFile(content, lang), [content, lang]);
  const palette = t.code as unknown as Record<string, string>;
  return (
    <ScrollView style={styles.editor} showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.codeBody}>
          {lines.map((line) => (
            <View key={line.n} style={styles.codeLine}>
              <Text style={[styles.lineNum, { color: t.fgDim, fontFamily: t.fontMono }]}>
                {line.n}
              </Text>
              <Text style={[styles.codeText, { fontFamily: t.fontMono, color: t.code.id }]}>
                {line.tokens.length === 0 ? ' ' : line.tokens.map((tk, i) => (
                  <Text key={i} style={{ color: palette[tk.t] ?? t.code.id }}>
                    {tk.v}
                  </Text>
                ))}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

function PlainEditor({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <ScrollView style={styles.editor} showsVerticalScrollIndicator={false}>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textAlignVertical="top"
        style={[styles.plainEditor, { color: t.fg, fontFamily: t.fontMono }]}
      />
    </ScrollView>
  );
}

function ChatTurnView({ turn }: { turn: ChatTurn }) {
  const t = useTheme();
  if (turn.kind === 'user') {
    return (
      <View style={styles.promptRow}>
        <Text style={[styles.promptArrow, { color: t.accent }]}>›</Text>
        <View style={styles.promptBody}>
          {turn.images && turn.images.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbScroll}
              contentContainerStyle={styles.thumbRow}
            >
              {turn.images.map((img, i) => (
                <Image
                  key={i}
                  source={{ uri: img.uri }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          )}
          {turn.text ? (
            <Text style={[styles.promptText, { color: t.fg, fontFamily: t.fontMono }]}>
              {turn.text}
            </Text>
          ) : null}
        </View>
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
        ⏳ {turn.text}
      </Text>
    );
  }
  return (
    <View style={[styles.toolCard, {
      backgroundColor: t.glass ? 'rgba(255,255,255,0.05)' : t.surface,
      borderColor: t.borderColor,
    }]}>
      <Text style={[styles.toolTitle, { color: t.fgMuted, fontFamily: t.fontMono }]}>
        {turn.name}{typeof turn.input.path === 'string' ? ` · ${turn.input.path}` : ''}
      </Text>
      {turn.result === undefined ? (
        <Text style={[styles.toolStatus, { color: t.fgMuted, fontFamily: t.fontMono }]}>
          running…
        </Text>
      ) : (
        <Text
          style={[
            styles.toolStatus,
            { color: turn.isError ? '#ff8a8a' : t.code.ty, fontFamily: t.fontMono },
          ]}
          numberOfLines={2}
        >
          {turn.isError ? '✗ ' : '✓ '}
          {turn.result.length > 120 ? turn.result.slice(0, 120) + '…' : turn.result}
        </Text>
      )}
    </View>
  );
}

function ImagePreviewStrip({
  images,
  onRemove,
}: {
  images: AttachedImage[];
  onRemove: (index: number) => void;
}) {
  const t = useTheme();
  if (images.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.previewStrip, { borderTopColor: t.borderColor }]}
      contentContainerStyle={styles.previewStripContent}
    >
      {images.map((img, i) => (
        <View key={i} style={styles.previewItem}>
          <Image
            source={{ uri: img.uri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <Pressable
            style={[styles.previewRemove, { backgroundColor: t.accent }]}
            onPress={() => onRemove(i)}
            hitSlop={8}
          >
            <Text style={styles.previewRemoveText}>✕</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

export default function EditScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentPath, currentContent, setCurrentContent, saveCurrentFile,
    isCurrentDirty, turns, send, chatBusy,
  } = useSession();
  const [input, setInput] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<AttachedImage[]>([]);
  const chatScrollRef = useRef<ScrollView>(null);

  const recentTurns = useMemo(() => turns.slice(-6), [turns]);
  const toolCount = useMemo(() => turns.filter((x) => x.kind === 'tool').length, [turns]);

  // keyboardVerticalOffset = tab bar + bottom safe area inset
  const kbOffset = TAB_BAR_HEIGHT + insets.bottom;

  useEffect(() => {
    setEditMode(false);
  }, [currentPath]);

  useEffect(() => {
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [turns.length]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveCurrentFile();
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if ((!trimmed && pendingImages.length === 0) || chatBusy) return;
    const imgs = pendingImages.length > 0 ? pendingImages : undefined;
    setInput('');
    setPendingImages([]);
    await send(trimmed, imgs);
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

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
      .map((a) => {
        const ext = (a.mimeType ?? 'image/jpeg') as AttachedImage['mediaType'];
        return {
          uri: a.uri,
          base64: a.base64!,
          mediaType: ext,
        };
      });

    setPendingImages((prev) => [...prev, ...newImages]);
  }

  function handleRemoveImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  if (!currentPath || currentContent === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: t.fg }]}>No file open</Text>
          <Text style={[styles.emptySub, { color: t.fgMuted }]}>
            Pick a file from the Files tab to edit.
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: t.accent }]}
            onPress={() => router.push('/(tabs)/')}
          >
            <Text style={styles.emptyBtnText}>Open Files</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={kbOffset}
      >
        <View style={styles.container}>
          <TopPill
            left={
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                <Path d="M2 3h3l1 1h6v7H2z" stroke={t.fgMuted} strokeWidth={1.6} />
              </Svg>
            }
            center={<FilePathBreadcrumb path={currentPath} dirty={isCurrentDirty} />}
            right={isCurrentDirty ? (
              <IconBtn primary onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                    <Path d="M3 7l3 3 5-7" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
                  </Svg>
                )}
              </IconBtn>
            ) : (
              <IconBtn onPress={() => setEditMode((m) => !m)}>
                <Text style={[styles.modeBadge, { color: editMode ? t.accent : t.fgMuted }]}>
                  {editMode ? '✎' : '✎'}
                </Text>
              </IconBtn>
            )}
          />

          {editMode ? (
            <PlainEditor value={currentContent} onChange={setCurrentContent} />
          ) : (
            <TokenizedCode content={currentContent} path={currentPath} />
          )}

          <View style={styles.claudeChipWrapper}>
            <Surface style={styles.claudeChip} radius={14}>
              <ClaudeAvatar size={14} />
              <Text style={[styles.claudeChipText, { color: t.fg }]}>
                Claude · sonnet 4.6
              </Text>
              <View style={[styles.claudeDivider, { backgroundColor: t.borderColor }]} />
              <Text style={[styles.claudeTools, { color: t.fgMuted }]}>
                {toolCount} tool{toolCount === 1 ? '' : 's'}
              </Text>
            </Surface>
          </View>

          <View style={styles.claudePanelWrap}>
            <Surface style={styles.claudePanel} radius={28}>
              <ScrollView
                ref={chatScrollRef}
                style={styles.flex1}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {recentTurns.length === 0 && (
                  <Text style={[styles.placeholder, { color: t.fgDim }]}>
                    Ask Claude to read or change this file. It can edit any file in
                    the repo. Tap 📎 to attach a screenshot.
                  </Text>
                )}
                {recentTurns.map((turn, i) => (
                  <ChatTurnView key={i} turn={turn} />
                ))}
                {chatBusy && (
                  <View style={styles.thinkingRow}>
                    <View style={[styles.thinkingDot, { backgroundColor: t.code.ty }]} />
                    <Text style={[styles.thinkingText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                      thinking…
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Pending image strip */}
              <ImagePreviewStrip images={pendingImages} onRemove={handleRemoveImage} />

              <View style={[styles.inputBar, {
                backgroundColor: t.glass ? 'rgba(0,0,0,0.25)' : t.bg,
                borderColor: t.borderColor,
              }]}>
                {/* Image attach button */}
                <Pressable
                  onPress={handlePickImage}
                  disabled={chatBusy}
                  style={({ pressed }) => [styles.attachBtn, { opacity: pressed ? 0.5 : 1 }]}
                  hitSlop={8}
                >
                  <Text style={[styles.attachIcon, { color: pendingImages.length > 0 ? t.accent : t.fgMuted }]}>
                    📎
                  </Text>
                </Pressable>

                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask Claude…"
                  placeholderTextColor={t.fgDim}
                  style={[styles.inputText, { color: t.fg }]}
                  multiline
                  editable={!chatBusy}
                />
                <IconBtn
                  primary
                  onPress={handleSend}
                  disabled={(!input.trim() && pendingImages.length === 0) || chatBusy}
                >
                  <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                    <Path d="M7 11V3M3 7l4-4 4 4"
                      stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </IconBtn>
              </View>
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
  container: { flex: 1 },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', marginBottom: 14 },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 22 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pathSegment: { fontSize: 13 },
  pathActive: { fontWeight: '600' },
  dirtyDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 6 },
  modeBadge: { fontSize: 14, fontWeight: '600' },

  editor: { flex: 1, paddingVertical: 4, maxHeight: 280 },
  codeBody: { paddingVertical: 4, paddingRight: 16 },
  codeLine: { flexDirection: 'row' },
  lineNum: {
    width: 36, textAlign: 'right', paddingRight: 12,
    fontSize: 12.5, lineHeight: 20,
  },
  codeText: { fontSize: 12.5, lineHeight: 20 },
  plainEditor: {
    minHeight: 240, paddingHorizontal: 16, paddingVertical: 4,
    fontSize: 12.5, lineHeight: 20,
  },

  claudeChipWrapper: { alignItems: 'center', marginVertical: 8 },
  claudeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  claudeChipText: { fontSize: 12, fontWeight: '600' },
  claudeDivider: { width: 1, height: 12, marginHorizontal: 2 },
  claudeTools: { fontSize: 12 },

  claudePanelWrap: {
    flex: 1, marginHorizontal: 12, marginBottom: 12,
  },
  claudePanel: {
    flex: 1,
    padding: 16,
  },
  placeholder: { fontSize: 13, lineHeight: 18, paddingVertical: 6 },

  // User turns
  promptRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  promptArrow: { fontSize: 14, marginTop: 2 },
  promptBody: { flex: 1 },
  promptText: { fontSize: 13, flex: 1 },
  thumbScroll: { marginBottom: 4 },
  thumbRow: { gap: 6 },
  thumbImage: {
    width: 72, height: 72, borderRadius: 8,
  },

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 6 },
  thinkingDot: { width: 6, height: 6, borderRadius: 3 },
  thinkingText: { fontSize: 12 },
  toolCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10, padding: 10, marginBottom: 6,
  },
  toolTitle: {
    fontSize: 10.5, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 4,
  },
  toolStatus: { fontSize: 11.5 },
  replyText: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  noteLine: {
    fontSize: 11, marginVertical: 4, paddingLeft: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    fontStyle: 'italic',
  },

  // Image preview strip (above input)
  previewStrip: {
    maxHeight: 90,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  previewStripContent: { paddingHorizontal: 4, gap: 8 },
  previewItem: { position: 'relative' },
  previewImage: { width: 70, height: 70, borderRadius: 8 },
  previewRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  previewRemoveText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  inputBar: {
    marginTop: 10, minHeight: 44, borderRadius: 22,
    paddingLeft: 10, paddingRight: 6,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  attachBtn: { padding: 4 },
  attachIcon: { fontSize: 18 },
  inputText: { flex: 1, fontSize: 14, maxHeight: 80, paddingVertical: 6 },
});
