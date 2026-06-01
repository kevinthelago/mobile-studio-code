import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';
import { Theme, useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { parseTunnelPairing } from '../../src/lib/tunnelPairing';
import { PaneState, PaneStatus, TunnelConnectionState } from '../../src/lib/types';
import { Surface } from '../../src/components/ui/Surface';
import { IconBtn } from '../../src/components/ui/IconBtn';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { Card } from '../../src/components/ui/Card';
import { Tag } from '../../src/components/ui/Tag';
import { Btn } from '../../src/components/ui/Btn';
import { hexAlpha } from '../../src/lib/color';
import { stripAnsi, lastLines } from '../../src/lib/ansi';

const TAB_BAR_HEIGHT = 60;
const TERMINAL_LINE_LIMIT = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: PaneStatus, t: Theme): string {
  switch (status) {
    case 'running': return t.success;
    case 'idle': return t.fgDim;
    case 'awaiting_input': return t.warn;
    case 'error': return t.danger;
    default: return t.accent;
  }
}

/** Project label derived from a pane's cwd (its last path segment). */
function projectOf(pane: PaneState): string {
  const parts = (pane.descriptor.cwd || '').split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function relativeTime(ts: number | null): string {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Sub-screens ───────────────────────────────────────────────────────────────

function ConnectingView({ state }: { state: TunnelConnectionState }) {
  const t = useTheme();
  const { disconnect } = useTunnel();
  const label = state === 'authenticating' ? 'Authenticating…' : 'Connecting…';
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={t.accent} size="large" />
      <Text style={[styles.connectingText, { color: t.fgMuted }]}>{label}</Text>
      {/* Always offer an escape — the socket may retry indefinitely (e.g. an
          unreachable host or untrusted cert), and without this the user is
          stranded on the spinner. Cancel stops retrying → back to pairing. */}
      <Pressable onPress={disconnect} hitSlop={8} style={styles.cancelConnect}>
        <Text style={[styles.disconnectText, { color: t.fgMuted }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function PairingView() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { connect, connectionState } = useTunnel();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const handleQrScanned = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    const pairing = parseTunnelPairing(data);
    if (!pairing) {
      setError('Unrecognised QR code — expected a base-studio-code pairing code.');
      setScanning(false);
      return;
    }
    scannedRef.current = true;
    setScanning(false);
    connect(pairing);
  }, [connect]);

  const handleScanPress = useCallback(async () => {
    setError(null);
    scannedRef.current = false;
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Camera permission is required to scan QR codes.');
        return;
      }
    }
    setScanning(true);
  }, [permission, requestPermission]);

  const handleManualConnect = useCallback(() => {
    setError(null);
    const pairing = parseTunnelPairing(manualJson.trim());
    if (!pairing) {
      setError('Paste the full pairing code (JSON) shown under the QR.');
      return;
    }
    connect(pairing);
  }, [manualJson, connect]);

  if (scanning) {
    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={handleQrScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        {/* Viewfinder frame */}
        <View style={styles.viewfinderOuter} pointerEvents="none">
          <View style={[styles.viewfinder, { borderColor: t.accent }]} />
          <Text style={[styles.viewfinderLabel, { color: t.fg }]}>
            Point at the QR code in base-studio-code
          </Text>
        </View>
        <Pressable
          style={[styles.cancelScan, { top: insets.top + 12 }]}
          onPress={() => setScanning(false)}
        >
          <Text style={[styles.cancelScanText, { color: t.fg }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const isConnecting = connectionState === 'connecting' || connectionState === 'authenticating';

  return (
    <View style={[styles.pairing, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Surface style={styles.pairingCard} radius={20}>
        <View style={styles.pairingIconWrap}>
          <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
            <Path
              d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m8 0h3a2 2 0 002-2v-3"
              stroke={t.accent} strokeWidth={1.5} strokeLinecap="round"
            />
          </Svg>
        </View>
        <Text style={[styles.pairingTitle, { color: t.fg }]}>
          Connect to base-studio-code
        </Text>
        <Text style={[styles.pairingSubtitle, { color: t.fgMuted }]}>
          Open base-studio-code on your desktop and show the pairing QR code.
        </Text>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <Pressable
          onPress={handleScanPress}
          disabled={isConnecting}
          style={[styles.scanBtn, { backgroundColor: t.accent, opacity: isConnecting ? 0.5 : 1 }]}
        >
          {isConnecting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"
                  stroke="#fff" strokeWidth={2} strokeLinecap="round"
                />
              </Svg>
              <Text style={styles.scanBtnText}>Scan QR Code</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => setShowManual((v) => !v)} style={styles.manualToggle}>
          <Text style={[styles.manualToggleText, { color: t.fgMuted }]}>
            {showManual ? 'Hide manual entry' : 'Paste pairing code instead'}
          </Text>
        </Pressable>

        {showManual && (
          <View style={styles.manualForm}>
            <TextInput
              value={manualJson}
              onChangeText={setManualJson}
              placeholder='{"relayUrl":"wss://…","room":"…","hostPubKey":"…","psk":"…"}'
              placeholderTextColor={t.fgDim}
              style={[styles.manualInput, {
                color: t.fg, borderColor: t.borderColor,
                fontFamily: t.fontMono, backgroundColor: t.surface,
                height: 88, textAlignVertical: 'top',
              }]}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            <Pressable
              onPress={handleManualConnect}
              disabled={isConnecting}
              style={[styles.manualConnectBtn, {
                borderColor: t.accent, opacity: isConnecting ? 0.5 : 1,
              }]}
            >
              <Text style={[styles.manualConnectText, { color: t.accent }]}>Connect</Text>
            </Pressable>
          </View>
        )}
      </Surface>
    </View>
  );
}

function SessionCard({ pane, onPress }: { pane: PaneState; onPress: () => void }) {
  const t = useTheme();
  const status = pane.sessionState?.status ?? pane.descriptor.status;
  const dotColor = statusColor(status, t);
  const waiting = pane.hasUserRequest;
  const taskText = pane.sessionState?.currentTask ?? '';
  const project = projectOf(pane);
  const lastLine = pane.outputBuffer
    ? stripAnsi(pane.outputBuffer).split('\n').filter(Boolean).at(-1) ?? ''
    : '';
  const preview = pane.sessionState?.prompt ?? lastLine;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card
        style={[styles.card, waiting && styles.cardWaiting]}
        borderColor={waiting ? t.warn : t.borderColor}
      >
        <View style={styles.cardRow}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.cardTitle, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
            {pane.descriptor.name || pane.descriptor.id}
          </Text>
          {project ? <Tag fontSize={9}>{project}</Tag> : null}
          <View style={styles.flex1} />
          <Text style={[styles.cardTime, { color: t.fgDim, fontFamily: t.fontMono }]}>
            {relativeTime(pane.lastActivityAt)}
          </Text>
        </View>

        {taskText ? (
          <Text style={[styles.cardTask, { color: t.fgMuted }]} numberOfLines={2}>
            {taskText}
          </Text>
        ) : null}

        {preview ? (
          <View style={[styles.previewBox, {
            backgroundColor: waiting ? hexAlpha(t.warn, 0.12) : t.elev,
            borderColor: waiting ? hexAlpha(t.warn, 0.30) : t.borderColor,
          }]}>
            <Text style={[styles.previewText, {
              color: waiting ? t.warn : t.fgMuted, fontFamily: t.fontMono,
            }]} numberOfLines={2}>
              {waiting ? '? ' : ''}{preview}
            </Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function PaneGridView() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { panes, orderedPaneIds, focusPane, disconnect, unpair } = useTunnel();
  const ordered = orderedPaneIds.map((id) => panes[id]).filter(Boolean) as PaneState[];

  let running = 0, awaiting = 0, idle = 0;
  for (const p of ordered) {
    const s = p.sessionState?.status ?? p.descriptor.status;
    if (p.hasUserRequest || s === 'awaiting_input') awaiting += 1;
    else if (s === 'idle') idle += 1;
    else running += 1;
  }

  const confirmUnpair = () => {
    Alert.alert(
      'Forget this desktop?',
      'Unpairing returns the app to standalone and clears the saved connection. '
        + 'Your repo, files, tasks, and keys stay on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpair', style: 'destructive', onPress: () => { unpair(); } },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.gridSafe, { backgroundColor: t.bg }]} edges={['top']}>
      <PageHeader
        crumbs={['base-studio-code', 'tunnel']}
        title="Sessions"
        meta={
          <>
            {ordered.length} active
            {awaiting > 0 && <Text style={{ color: t.warn }}>{` · ${awaiting} awaiting input`}</Text>}
          </>
        }
        right={<Btn variant="ghost" size="sm" onPress={disconnect}>disconnect</Btn>}
      />

      {ordered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: t.fgDim }]}>
            No active sessions.{'\n'}Start a Claude session in base-studio-code.
          </Text>
          <Btn variant="ghost" size="sm" onPress={confirmUnpair} style={styles.unpairBtn}>
            <Text style={{ color: t.danger }}>unpair this desktop</Text>
          </Btn>
        </View>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(p) => p.descriptor.id}
          ListHeaderComponent={
            <View style={styles.tagRow}>
              <Tag variant="amber">all · {ordered.length}</Tag>
              <Tag>running · {running}</Tag>
              {awaiting > 0 && <Tag variant="warn">awaiting · {awaiting}</Tag>}
              <Tag>idle · {idle}</Tag>
              <View style={styles.flex1} />
              <Pressable onPress={confirmUnpair} hitSlop={8}>
                <Text style={[styles.unpairText, { color: t.danger, fontFamily: t.fontMono }]}>unpair</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <SessionCard pane={item} onPress={() => focusPane(item.descriptor.id)} />
          )}
          contentContainerStyle={[styles.cardList, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 8 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function TerminalView({ paneId }: { paneId: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { panes, sendInput, sendResize, unfocusPane } = useTunnel();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const kbOffset = TAB_BAR_HEIGHT + insets.bottom;

  const pane = panes[paneId];

  const output = pane
    ? lastLines(stripAnsi(pane.outputBuffer), TERMINAL_LINE_LIMIT)
    : '';

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [output]);

  const handleSend = useCallback(() => {
    const text = inputText;
    setInputText('');
    sendInput(paneId, text + '\n');
  }, [inputText, paneId, sendInput]);

  const handleLayout = useCallback(({ nativeEvent }: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = nativeEvent.layout;
    // Approximate columns/rows based on monospace char dimensions
    const cols = Math.floor(width / 7.2);
    const rows = Math.floor(height / 14);
    sendResize(paneId, Math.max(cols, 40), Math.max(rows, 10));
  }, [paneId, sendResize]);

  if (!pane) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyText, { color: t.fgDim }]}>Session not found.</Text>
      </View>
    );
  }

  const status = pane.sessionState?.status ?? pane.descriptor.status;
  const dotColor = statusColor(status, t);

  return (
    <KeyboardAvoidingView
      style={styles.termRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={kbOffset}
    >
      {/* Header */}
      <View style={[styles.termHeader, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
        <IconBtn onPress={unfocusPane}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M9 3L5 7l4 4" stroke={t.fg} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
        </IconBtn>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.termTitle, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
          {pane.descriptor.name || pane.descriptor.id}
        </Text>
        {pane.sessionState?.currentTask ? (
          <Text style={[styles.termTask, { color: t.fgMuted }]} numberOfLines={1}>
            {pane.sessionState.currentTask}
          </Text>
        ) : null}
      </View>

      {/* user_request prompt banner */}
      {pane.hasUserRequest && pane.sessionState?.prompt ? (
        <View style={styles.promptBanner}>
          <Text style={styles.promptIcon}>?</Text>
          <Text style={styles.promptText} numberOfLines={3}>{pane.sessionState.prompt}</Text>
        </View>
      ) : null}

      {/* Output */}
      <ScrollView
        ref={scrollRef}
        style={styles.termScroll}
        contentContainerStyle={styles.termContent}
        onLayout={handleLayout}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <Text style={[styles.termOutput, { color: t.fg, fontFamily: t.fontMono }]} selectable>
          {output || ' '}
        </Text>
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.termInputWrap, { borderTopColor: t.borderColor, paddingBottom: insets.bottom + 8 }]}>
        <Surface style={styles.termInputBar} radius={20}>
          <Text style={[styles.termPromptArrow, { color: t.accent, fontFamily: t.fontMono }]}>›</Text>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Send input…"
            placeholderTextColor={t.fgDim}
            style={[styles.termInput, { color: t.fg, fontFamily: t.fontMono }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <IconBtn primary size={36} onPress={handleSend} disabled={!inputText.trim()}>
            <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
              <Path d="M7 11V3M3 7l4-4 4 4" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </IconBtn>
        </Surface>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function SessionsScreen() {
  const { connectionState, activePaneId } = useTunnel();

  if (connectionState === 'disconnected' || connectionState === 'error') {
    return <PairingView />;
  }
  if (connectionState === 'connecting' || connectionState === 'authenticating') {
    return <ConnectingView state={connectionState} />;
  }
  if (activePaneId) {
    return <TerminalView paneId={activePaneId} />;
  }
  return <PaneGridView />;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  connectingText: { marginTop: 16, fontSize: 14 },
  cancelConnect: { marginTop: 24, paddingVertical: 8, paddingHorizontal: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  unpairBtn: { marginTop: 4 },

  // Pairing
  pairing: { flex: 1, paddingHorizontal: 20 },
  pairingCard: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  pairingIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,174,207,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  pairingTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  pairingSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  errorText: { fontSize: 12, color: '#f87171', textAlign: 'center' },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 13,
    borderRadius: 24, marginTop: 4,
  },
  scanBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  manualToggle: { paddingVertical: 6 },
  manualToggleText: { fontSize: 12.5 },
  manualForm: { width: '100%', gap: 10 },
  manualInput: {
    width: '100%', height: 44, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, fontSize: 13,
  },
  manualConnectBtn: {
    alignSelf: 'flex-end',
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  manualConnectText: { fontSize: 13.5, fontWeight: '600' },

  // Camera
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  viewfinderOuter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  viewfinder: {
    width: 220, height: 220, borderRadius: 20,
    borderWidth: 2,
  },
  viewfinderLabel: { fontSize: 14, textAlign: 'center', opacity: 0.85 },
  cancelScan: {
    position: 'absolute', right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  cancelScanText: { fontSize: 14, fontWeight: '600' },

  // Pane grid
  gridSafe: { flex: 1 },
  disconnectText: { fontSize: 13 },
  tagRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    paddingTop: 10, paddingBottom: 4,
  },
  unpairText: { fontSize: 10.5 },
  cardList: { paddingHorizontal: 12, gap: 8 },

  // Session card
  card: { padding: 12, borderRadius: 8 },
  cardWaiting: { borderLeftWidth: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 12.5, fontWeight: '500', flexShrink: 1 },
  cardTask: { fontSize: 12, marginTop: 7, lineHeight: 17 },
  previewBox: {
    marginTop: 7, paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 5, borderWidth: StyleSheet.hairlineWidth,
  },
  previewText: { fontSize: 10.5, lineHeight: 16 },
  cardTime: { fontSize: 9.5 },

  // Terminal
  termRoot: { flex: 1, backgroundColor: 'transparent' },
  termHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  termTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  termTask: { fontSize: 11, flexShrink: 1 },

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
  termContent: { padding: 12 },
  termOutput: { fontSize: 12, lineHeight: 17 },

  termInputWrap: {
    paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  termInputBar: {
    minHeight: 48, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, gap: 8,
  },
  termPromptArrow: { fontSize: 16 },
  termInput: { flex: 1, fontSize: 13, paddingVertical: 4 },
});
