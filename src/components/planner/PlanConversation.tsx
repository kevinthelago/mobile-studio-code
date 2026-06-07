import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, Platform,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { IconBtn } from '../ui/IconBtn';
import { stripAllPlannerTags } from '../../lib/planner/planTag';
import type { PlanMessage } from '../../lib/planner/project';

/** Planner chat: message list + composer. Tags are stripped from assistant text for
 *  display; a tag-only reply shows a subtle "(updated the plan)" note. */
export function PlanConversation({
  messages, sending, onSend, bottomInset,
}: {
  messages: PlanMessage[];
  sending: boolean;
  onSend: (text: string) => void;
  bottomInset: number;
}) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Track the keyboard directly and pad the composer above it. More reliable than
  // KeyboardAvoidingView, which mis-measures when it doesn't start at the screen top.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, sending, kbHeight]);

  // iOS keyboard height already includes the home-indicator inset.
  const composerPad = kbHeight > 0 ? kbHeight + 8 : bottomInset + 8;

  function send() {
    const v = text.trim();
    if (!v || sending) return;
    setText('');
    onSend(v);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 && (
          <Text style={[styles.empty, { color: t.fgDim }]}>
            Describe what you want to build. The planner will walk you through it, one topic at a time.
          </Text>
        )}
        {messages.map((m, i) => {
          const display = m.role === 'assistant'
            ? (stripAllPlannerTags(m.text) || '(updated the plan)')
            : m.text;
          const mine = m.role === 'user';
          return (
            <View
              key={i}
              style={[styles.bubble, mine ? styles.mine : styles.theirs, {
                backgroundColor: mine
                  ? (t.glass ? `${t.accent}26` : `${t.accent}1f`)
                  : (t.glass ? 'rgba(255,255,255,0.06)' : t.surface),
                borderColor: t.borderColor,
              }]}
            >
              <Text style={[styles.bubbleText, { color: t.fg }]}>{display}</Text>
            </View>
          );
        })}
        {sending && (
          <View style={[styles.bubble, styles.theirs, { backgroundColor: t.glass ? 'rgba(255,255,255,0.06)' : t.surface }]}>
            <ActivityIndicator color={t.fgMuted} size="small" />
          </View>
        )}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: composerPad, borderTopColor: t.borderColor }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the planner…"
          placeholderTextColor={t.fgDim}
          style={[styles.input, { color: t.fg, backgroundColor: t.glass ? 'rgba(255,255,255,0.06)' : t.surface }]}
          multiline
          editable={!sending}
        />
        <IconBtn primary size={40} onPress={send} disabled={!text.trim() || sending}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M7 11V3M3 7l4-4 4 4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </IconBtn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollInner: { padding: 14, gap: 10 },
  empty: { fontSize: 13, lineHeight: 19, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  bubble: { maxWidth: '88%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  bubbleText: { fontSize: 13.5, lineHeight: 19 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, maxHeight: 120, minHeight: 40, borderRadius: 18,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 14,
  },
});
