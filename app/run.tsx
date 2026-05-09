// Run tab — live agentic loop
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../src/theme';
import { runAgentLoop, AgentEntry, MAX_ITERATIONS } from '../src/lib/agent';
import { ChatMessage } from '../src/lib/llm';

const C = theme.code;

const SYSTEM_PROMPT =
  'You are a coding assistant embedded in a mobile IDE. ' +
  'Help the user with code tasks concisely. ' +
  'If you need to run a shell command, wrap it in a ```shell``` block. ' +
  `Never exceed ${MAX_ITERATIONS} tool calls in one session.`;

const SUGGESTIONS = ['Run tests', 'Explain this', 'Fix the error'];

// ── Entry renderers ───────────────────────────────────────────────────────────

function SystemLine({ text }: { text: string }) {
  return <Text style={styles.systemLine}>· {text}</Text>;
}

function UserRow({ text }: { text: string }) {
  return (
    <View style={styles.userRow}>
      <Text style={styles.promptArrow}>›</Text>
      <Text style={styles.userText}>{text}</Text>
    </View>
  );
}

function ThinkingRow({ text }: { text: string }) {
  return (
    <View style={styles.thinkingRow}>
      <ActivityIndicator size="small" color={C.ty} style={{ transform: [{ scale: 0.6 }] }} />
      <Text style={styles.thinkingText}>{text}</Text>
    </View>
  );
}

function ToolCard({ entry }: { entry: AgentEntry }) {
  return (
    <View style={styles.toolCard}>
      <Text style={styles.toolTitle}>
        {entry.toolName ?? 'tool'}{entry.cmd ? ` · ${entry.cmd}` : ''}
      </Text>
    </View>
  );
}

function OutputBlock({ text }: { text: string }) {
  return (
    <View style={styles.outputBlock}>
      <Text style={styles.outputText}>{text}</Text>
    </View>
  );
}

function ReplyText({ text }: { text: string }) {
  return <Text style={styles.replyText}>{text}</Text>;
}

function ErrorText({ text }: { text: string }) {
  return (
    <View style={styles.errorBlock}>
      <Text style={styles.errorText}>⚠ {text}</Text>
    </View>
  );
}

function EntryRow({ entry }: { entry: AgentEntry }) {
  switch (entry.kind) {
    case 'system':   return <SystemLine text={entry.text ?? ''} />;
    case 'user':     return <UserRow text={entry.text ?? ''} />;
    case 'thinking': return <ThinkingRow text={entry.text ?? ''} />;
    case 'tool':     return <ToolCard entry={entry} />;
    case 'output':   return <OutputBlock text={entry.text ?? ''} />;
    case 'reply':    return <ReplyText text={entry.text ?? ''} />;
    case 'error':    return <ErrorText text={entry.text ?? ''} />;
    default:         return null;
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RunScreen() {
  const [entries, setEntries] = useState<AgentEntry[]>([
    { kind: 'system', text: `agent · max ${MAX_ITERATIONS} iterations` },
  ]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const appendEntry = useCallback((entry: AgentEntry) => {
    setEntries((prev) => {
      // Replace a trailing 'thinking' entry when real content arrives
      if (
        entry.kind !== 'thinking' &&
        prev.length > 0 &&
        prev[prev.length - 1].kind === 'thinking'
      ) {
        return [...prev.slice(0, -1), entry];
      }
      return [...prev, entry];
    });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
  }, []);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    setBusy(true);

    await runAgentLoop({
      userMessage: msg,
      history,
      systemPrompt: SYSTEM_PROMPT,
      onEntry: appendEntry,
      onDone: (finalHistory) => {
        setHistory(finalHistory);
        setBusy(false);
      },
    });
  }

  function handleNew() {
    setEntries([{ kind: 'system', text: `agent · max ${MAX_ITERATIONS} iterations` }]);
    setHistory([]);
    setInput('');
    setBusy(false);
  }

  const turnCount = history.filter((m) => m.role === 'user').length;
  const toolCount = entries.filter((e) => e.kind === 'tool').length;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.container}>
          {/* Top pill */}
          <View style={styles.topPill}>
            <View style={styles.claudeAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pillTitle}>Agent</Text>
              <Text style={styles.pillSub}>
                {turnCount} turn{turnCount !== 1 ? 's' : ''} · {toolCount} tool call{toolCount !== 1 ? 's' : ''}
                {busy ? ' · running…' : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={handleNew} disabled={busy}>
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                <Path
                  d="M7 1v3M7 10v3M1 7h3M10 7h3M3 3l2 2M9 9l2 2M3 11l2-2M9 5l2-2"
                  stroke={busy ? theme.fgDim : theme.fg}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Transcript */}
          <ScrollView
            ref={scrollRef}
            style={styles.transcript}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {entries.map((e, i) => <EntryRow key={i} entry={e} />)}
          </ScrollView>

          {/* Suggestion chips — only show when idle and no history */}
          {!busy && history.length === 0 && (
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggChip}
                  onPress={() => handleSend(s)}
                >
                  <Text style={styles.suggText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask the agent…"
              placeholderTextColor={theme.fgDim}
              style={styles.inputText}
              editable={!busy}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || busy) && styles.sendBtnDisabled]}
              onPress={() => handleSend()}
              disabled={!input.trim() || busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                  <Path
                    d="M7 11V3M3 7l4-4 4 4"
                    stroke="#fff"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  container: { flex: 1, backgroundColor: theme.bg, paddingBottom: 12 },

  topPill: {
    marginHorizontal: 16, marginTop: 12, height: 56,
    backgroundColor: theme.surface, borderRadius: 28,
    borderWidth: 0.5, borderColor: theme.borderColor,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  claudeAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#d97757' },
  pillTitle: { fontSize: 14, fontWeight: '600', color: theme.fg },
  pillSub: { fontSize: 11, color: theme.fgMuted, fontFamily: 'monospace' },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },

  transcript: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },

  systemLine: { color: theme.fgDim, fontSize: 11, marginBottom: 14, fontFamily: 'monospace' },

  userRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  promptArrow: { color: theme.accent, fontSize: 14, fontFamily: 'monospace' },
  userText: { color: theme.fg, fontFamily: 'monospace', fontSize: 13, flex: 1 },

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  thinkingText: { color: theme.fgMuted, fontFamily: 'monospace', fontSize: 12 },

  toolCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: theme.borderColor,
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  toolTitle: {
    fontSize: 10.5, color: theme.fgMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    fontFamily: 'monospace',
  },

  outputBlock: {
    borderLeftWidth: 2, borderLeftColor: theme.borderColor,
    paddingLeft: 10, paddingVertical: 6, marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  outputText: { color: theme.fgMuted, fontFamily: 'monospace', fontSize: 11.5 },

  replyText: { fontSize: 13.5, color: theme.fg, lineHeight: 20, marginBottom: 14 },

  errorBlock: {
    borderLeftWidth: 2, borderLeftColor: '#c33',
    paddingLeft: 10, paddingVertical: 6, marginBottom: 10,
  },
  errorText: { color: '#c33', fontFamily: 'monospace', fontSize: 12 },

  suggestions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  suggChip: {
    height: 32, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 0.5, borderColor: theme.borderColor,
    alignItems: 'center', justifyContent: 'center',
  },
  suggText: { fontSize: 12.5, fontWeight: '500', color: theme.fg },

  inputBar: {
    marginHorizontal: 12, height: 52,
    backgroundColor: theme.surface, borderRadius: 26,
    borderWidth: 0.5, borderColor: theme.borderColor,
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 16, paddingRight: 6, gap: 8,
  },
  inputText: { flex: 1, color: theme.fg, fontSize: 14 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
