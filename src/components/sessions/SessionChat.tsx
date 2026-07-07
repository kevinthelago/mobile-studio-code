import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { PaneStatus } from '../../lib/types';
import { Surface } from '../ui/Surface';
import { IconBtn } from '../ui/IconBtn';
import { stripAnsi, lastLines } from '../../lib/ansi';
import { fitTerminalFontSize, BASE_TERMINAL_FONT } from '../../lib/tunnel/paneSize';
import { encodeSubmit } from '../../lib/tunnel/input';
import { decideInputGate } from '../../lib/sessions/inputGate';
import { inputBottomPadding } from '../../lib/sessions/layout';
import { paneKind, KIND_LABEL } from '../../lib/sessions/roster';

const TERMINAL_LINE_LIMIT = 200;
/** Horizontal padding (each side) of the terminal output content. */
const TERM_CONTENT_PAD = 12;

function statusColor(status: PaneStatus): string {
  switch (status) {
    case 'running': return '#4ade80';
    case 'awaiting_input': return '#fbbf24';
    case 'error': return '#f87171';
    default: return 'rgba(255,255,255,0.3)';
  }
}

/**
 * The ONE reusable chat surface for any addressable desktop session (#219):
 * a read-only terminal stream (pane_output, desktop-grid adoption via
 * pane_size) + a single text input that submits `text + \r` via pane_input.
 * All state mutations happen HERE by talking to the agent — no CRUD controls.
 *
 * Adapted from the deleted Run tab's TerminalView: same ansi strip + line
 * limit, same pane_size font fit, same direct keyboard tracking (c97cdce).
 * The desktop's view-only gate is honored via decideInputGate, fed the live
 * grant off the wire (auth_ok.inputGranted + input_grant_changed,
 * base-studio-code#2511); a pre-#2511 desktop never signals it (null), so the
 * unknown-grant hint still surfaces only after an attempt.
 */
export function SessionChat({ paneId }: { paneId: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const {
    panes, activePaneId, connectionState, inputGranted, focusPane, unfocusPane, sendInput,
  } = useTunnel();
  const [inputText, setInputText] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const [termWidth, setTermWidth] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Focus on mount: pane_set_state streaming + pane_focus (the client
  // re-asserts both on reconnect). On unmount, release the pane back to
  // minimized — but only if it is still the active one, so a chat opened for
  // another pane in the meantime isn't clobbered by our late cleanup.
  const activeRef = useRef(activePaneId);
  activeRef.current = activePaneId;
  useEffect(() => {
    focusPane(paneId);
    return () => {
      if (activeRef.current === paneId) unfocusPane();
    };
  }, [paneId, focusPane, unfocusPane]);

  // Track the keyboard directly so the input bar sits just above it when up
  // (the fix pattern from c97cdce — RN's KeyboardAvoidingView misjudges this
  // layout, so we listen and pad ourselves).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const pane = panes[paneId];
  const output = pane
    ? lastLines(stripAnsi(pane.outputBuffer), TERMINAL_LINE_LIMIT)
    : '';

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [output]);

  // The desktop puts its input grant on the wire since base-studio-code#2511;
  // null = an older desktop that never signals it (the gate stays honest).
  const gate = decideInputGate({
    connected: connectionState === 'connected',
    inputGranted,
    attempted,
  });

  const handleSend = useCallback(() => {
    const text = inputText;
    setInputText('');
    setAttempted(true);
    // encodeSubmit terminates the line with \r — raw-mode Enter; \n would type
    // the line but never run it. paneId is a live desktop id from pane_list.
    sendInput(paneId, encodeSubmit(text));
  }, [inputText, paneId, sendInput]);

  // Record the output area's width to scale the font to the desktop's grid.
  // We intentionally do NOT send pane_resize: the phone adopts the desktop
  // PTY's size (its pane_size frames) rather than fighting the shared desktop
  // terminal over it.
  const handleLayout = useCallback(({ nativeEvent }: { nativeEvent: { layout: { width: number } } }) => {
    setTermWidth(nativeEvent.layout.width);
  }, []);

  // This surface mounts on a full-screen stack page (no tab bar below), so
  // nothing is reserved under the content; clear the home indicator when the
  // keyboard is down and the keyboard itself when up.
  const inputPadBottom = inputBottomPadding({
    keyboardHeight: kbHeight,
    reservedBelow: 0,
    safeAreaBottom: insets.bottom,
  });

  if (!pane) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
          <BackBtn />
          <Text style={[styles.title, { color: t.fg }]}>Session</Text>
        </View>
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: t.fgDim }]}>
            {connectionState === 'connected'
              ? 'This session is no longer running on the desktop.'
              : 'Not connected — pair with your desktop to reach this session.'}
          </Text>
        </View>
      </View>
    );
  }

  const status = pane.sessionState?.status ?? pane.descriptor.status;

  // Scale the monospace font so the desktop's `cols` cells span the output
  // width — reproduces the desktop's line-wrapping instead of re-wrapping.
  const fontSize = pane.ptySize
    ? fitTerminalFontSize(termWidth - TERM_CONTENT_PAD * 2, pane.ptySize.cols)
    : BASE_TERMINAL_FONT;
  const lineHeight = Math.round(fontSize * 1.4);

  return (
    <View style={styles.root}>
      {/* Header: back + status + name + kind */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
        <BackBtn />
        <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
            {pane.descriptor.name || pane.descriptor.id}
          </Text>
          <Text style={[styles.subtitle, { color: t.fgMuted }]} numberOfLines={1}>
            {KIND_LABEL[paneKind(pane.descriptor)]}
            {pane.sessionState?.currentTask ? ` · ${pane.sessionState.currentTask}` : ''}
          </Text>
        </View>
      </View>

      {/* user_request prompt banner */}
      {pane.hasUserRequest && pane.sessionState?.prompt ? (
        <View style={styles.promptBanner}>
          <Text style={styles.promptIcon}>?</Text>
          <Text style={styles.promptText} numberOfLines={3}>{pane.sessionState.prompt}</Text>
        </View>
      ) : null}

      {/* Read-only terminal stream */}
      <ScrollView
        ref={scrollRef}
        style={styles.termScroll}
        contentContainerStyle={styles.termContent}
        onLayout={handleLayout}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <Text style={[styles.termOutput, { color: t.fg, fontFamily: t.fontMono, fontSize, lineHeight }]} selectable>
          {output || ' '}
        </Text>
      </ScrollView>

      {/* The single input — above the keyboard when up, above the home
          indicator when down (see inputBottomPadding). */}
      <View style={[styles.inputWrap, { borderTopColor: t.borderColor, paddingBottom: inputPadBottom }]}>
        {gate.hint ? (
          <Text style={[styles.gateHint, { color: gate.editable ? t.fgDim : '#fbbf24' }]} numberOfLines={2}>
            {gate.hint}
          </Text>
        ) : null}
        <Surface style={[styles.inputBar, !gate.editable && styles.inputBarDisabled]} radius={10}>
          <Text style={[styles.promptArrow, { color: t.accent, fontFamily: t.fontMono }]}>›</Text>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            editable={gate.editable}
            placeholder={gate.editable ? 'Message this session…' : 'View-only'}
            placeholderTextColor={t.fgDim}
            style={[styles.input, { color: t.fg, fontFamily: t.fontMono }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <IconBtn primary size={36} onPress={handleSend} disabled={!gate.editable || !inputText.trim()}>
            <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
              <Path d="M7 11V3M3 7l4-4 4 4" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </IconBtn>
        </Surface>
      </View>
    </View>
  );
}

function BackBtn() {
  const t = useTheme();
  return (
    <IconBtn onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Path d="M9 3L5 7l4 4" stroke={t.fg} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </IconBtn>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10, gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 11 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },

  promptBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(251,191,36,0.3)',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  promptIcon: { color: '#fbbf24', fontWeight: '700', fontSize: 14 },
  promptText: { color: '#fbbf24', fontSize: 13, flex: 1, lineHeight: 18 },

  termScroll: { flex: 1 },
  termContent: { padding: TERM_CONTENT_PAD },
  termOutput: { fontSize: 12, lineHeight: 17 },

  inputWrap: {
    paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  gateHint: { fontSize: 11, lineHeight: 15, paddingHorizontal: 4, marginBottom: 6 },
  inputBar: {
    minHeight: 48, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, gap: 8,
  },
  inputBarDisabled: { opacity: 0.55 },
  promptArrow: { fontSize: 16 },
  input: { flex: 1, fontSize: 13, paddingVertical: 4 },
});
