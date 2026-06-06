import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { PaneState, PaneStatus, PairingPayload, TunnelConnectionState } from '../../src/lib/types';
import { Surface } from '../../src/components/ui/Surface';
import { IconBtn } from '../../src/components/ui/IconBtn';
import { ProvidersScreen } from '../../src/components/ProvidersScreen';
import { stripAnsi, lastLines } from '../../src/lib/ansi';

const TAB_BAR_HEIGHT = 60;
const TERMINAL_LINE_LIMIT = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: PaneStatus, accent: string): string {
  switch (status) {
    case 'running': return '#4ade80';
    case 'idle': return 'rgba(255,255,255,0.3)';
    case 'awaiting_input': return '#fbbf24';
    case 'error': return '#f87171';
    default: return accent;
  }
}

function relativeTime(ts: number | null): string {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/** Parse the desktop's pairing QR: raw JSON { relayUrl, room, hostPubKey, psk }. */
function parsePairing(data: string): PairingPayload | null {
  try {
    const o = JSON.parse(data) as Partial<PairingPayload>;
    if (o.relayUrl && o.room && o.hostPubKey && o.psk) {
      return { relayUrl: o.relayUrl, room: o.room, hostPubKey: o.hostPubKey, psk: o.psk };
    }
  } catch { /* not JSON */ }
  return null;
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
      <Pressable onPress={disconnect} style={[styles.cancelConnect, { borderColor: t.borderColor }]} hitSlop={8}>
        <Text style={[styles.cancelConnectText, { color: t.fgMuted }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function PairingView({ onConnectModel }: { onConnectModel: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { connect, connectionState, lastConnection } = useTunnel();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const handleQrScanned = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    const parsed = parsePairing(data);
    if (!parsed) {
      setError('Unrecognised QR code — expected the base-studio-code pairing code.');
      setScanning(false);
      return;
    }
    scannedRef.current = true;
    setScanning(false);
    connect(parsed);
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
    const parsed = parsePairing(manualJson.trim());
    if (!parsed) {
      setError('Paste the full pairing JSON from base-studio-code.');
      return;
    }
    connect(parsed);
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

        {lastConnection && (
          <Pressable
            onPress={() => connect(lastConnection)}
            disabled={isConnecting}
            style={[styles.reconnectBtn, { borderColor: t.accent, opacity: isConnecting ? 0.5 : 1 }]}
          >
            <Svg width={15} height={15} viewBox="0 0 14 14" fill="none">
              <Path d="M2 7a5 5 0 105-5" stroke={t.accent} strokeWidth={1.6} strokeLinecap="round" />
              <Path d="M2 2v3h3" stroke={t.accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.reconnectText, { color: t.accent }]} numberOfLines={1}>
              Reconnect to {lastConnection.relayUrl.replace(/^wss?:\/\//, '')}
            </Text>
          </Pressable>
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
            {showManual ? 'Hide manual entry' : 'Paste pairing code manually'}
          </Text>
        </Pressable>

        {showManual && (
          <View style={styles.manualForm}>
            <TextInput
              value={manualJson}
              onChangeText={setManualJson}
              placeholder={'{"relayUrl":"wss://…","room":"…","hostPubKey":"…","psk":"…"}'}
              placeholderTextColor={t.fgDim}
              style={[styles.manualInput, styles.manualJsonInput, {
                color: t.fg, borderColor: t.borderColor,
                fontFamily: t.fontMono, backgroundColor: t.surface,
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

      {/* Run standalone — pick a cloud or local model instead of the desktop */}
      <View style={styles.standaloneDivider}>
        <View style={[styles.dividerLine, { backgroundColor: t.borderColor }]} />
        <Text style={[styles.dividerLabel, { color: t.fgDim }]}>OR RUN STANDALONE</Text>
        <View style={[styles.dividerLine, { backgroundColor: t.borderColor }]} />
      </View>
      <Pressable onPress={onConnectModel}>
        <Surface style={styles.standaloneCard} radius={16}>
          <View style={[styles.standaloneIcon, { backgroundColor: t.glass ? 'rgba(192,132,252,0.18)' : 'rgba(192,132,252,0.12)' }]}>
            <Svg width={17} height={17} viewBox="0 0 18 18" fill="none">
              <Path d="M5 13a3.2 3.2 0 010-6.4 4.3 4.3 0 018.2 1A3.1 3.1 0 0114.5 13H5z" stroke="#c084fc" strokeWidth={1.5} />
            </Svg>
          </View>
          <View style={styles.standaloneText}>
            <Text style={[styles.standaloneTitle, { color: t.fg }]}>Connect a cloud model</Text>
            <Text style={[styles.standaloneSub, { color: t.fgMuted }]}>Anthropic · OpenAI · Google · local</Text>
          </View>
          <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
            <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
        </Surface>
      </Pressable>
    </View>
  );
}

function SessionCard({ pane, onPress }: { pane: PaneState; onPress: () => void }) {
  const t = useTheme();
  const status = pane.sessionState?.status ?? pane.descriptor.status;
  const dotColor = statusColor(status, t.accent);
  const taskText = pane.sessionState?.currentTask ?? pane.descriptor.cwd;
  const lastLine = pane.outputBuffer
    ? stripAnsi(pane.outputBuffer).split('\n').filter(Boolean).at(-1) ?? ''
    : '';
  const preview = pane.sessionState?.prompt ?? lastLine;

  return (
    <Pressable onPress={onPress}>
      <Surface style={[
        styles.card,
        pane.hasUserRequest && { borderColor: '#fbbf24' },
      ]}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={[styles.cardTitle, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
              {pane.descriptor.name || pane.descriptor.id}
            </Text>
            {pane.hasUserRequest && (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>input needed</Text>
              </View>
            )}
          </View>

          {taskText ? (
            <Text style={[styles.cardTask, { color: t.fgMuted }]} numberOfLines={1}>
              {taskText}
            </Text>
          ) : null}

          {preview ? (
            <Text style={[styles.cardPreview, {
              color: pane.hasUserRequest ? '#fbbf24' : t.fgDim,
              fontFamily: t.fontMono,
            }]} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardMeta}>
          <Text style={[styles.cardTime, { color: t.fgDim }]}>
            {relativeTime(pane.lastActivityAt)}
          </Text>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M5 3l4 4-4 4" stroke={t.fgDim} strokeWidth={1.4} strokeLinecap="round" />
          </Svg>
        </View>
      </Surface>
    </Pressable>
  );
}

function PaneGridView() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { panes, orderedPaneIds, focusPane, disconnect } = useTunnel();
  const ordered = orderedPaneIds.map((id) => panes[id]).filter(Boolean) as PaneState[];

  return (
    <View style={[styles.grid, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 8 }]}>
      <View style={styles.gridHeader}>
        <Text style={[styles.gridTitle, { color: t.fg }]}>Sessions</Text>
        <Pressable onPress={disconnect} hitSlop={8}>
          <Text style={[styles.disconnectText, { color: t.fgMuted }]}>Disconnect</Text>
        </Pressable>
      </View>

      {ordered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: t.fgDim }]}>
            No active sessions.{'\n'}Start a Claude session in base-studio-code.
          </Text>
        </View>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(p) => p.descriptor.id}
          renderItem={({ item }) => (
            <SessionCard pane={item} onPress={() => focusPane(item.descriptor.id)} />
          )}
          contentContainerStyle={styles.cardList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
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
  const dotColor = statusColor(status, t.accent);

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
  const [showProviders, setShowProviders] = useState(false);

  if (connectionState === 'disconnected' || connectionState === 'error') {
    if (showProviders) {
      return <ProvidersScreen onBack={() => setShowProviders(false)} />;
    }
    return <PairingView onConnectModel={() => setShowProviders(true)} />;
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  connectingText: { marginTop: 16, fontSize: 14 },
  cancelConnect: {
    marginTop: 24, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelConnectText: { fontSize: 14, fontWeight: '600' },
  reconnectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22,
    borderWidth: 1, marginTop: 4,
  },
  reconnectText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

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
  manualJsonInput: { height: 88, paddingTop: 10, textAlignVertical: 'top' },
  manualConnectBtn: {
    alignSelf: 'flex-end',
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  manualConnectText: { fontSize: 13.5, fontWeight: '600' },

  // Run-standalone entry
  standaloneDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 18, marginBottom: 12, paddingHorizontal: 2,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 10.5, letterSpacing: 1.4, fontWeight: '600' },
  standaloneCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14,
  },
  standaloneIcon: {
    width: 34, height: 34, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  standaloneText: { flex: 1, minWidth: 0 },
  standaloneTitle: { fontSize: 14, fontWeight: '600' },
  standaloneSub: { fontSize: 11.5, marginTop: 1 },

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
  grid: { flex: 1 },
  gridHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  gridTitle: { fontSize: 20, fontWeight: '700' },
  disconnectText: { fontSize: 13 },
  cardList: { paddingHorizontal: 16, gap: 10 },

  // Session card
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  requestBadge: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  requestBadgeText: { fontSize: 10, color: '#fbbf24', fontWeight: '600' },
  cardTask: { fontSize: 12 },
  cardPreview: { fontSize: 11, marginTop: 2 },
  cardMeta: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  cardTime: { fontSize: 10.5 },

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
