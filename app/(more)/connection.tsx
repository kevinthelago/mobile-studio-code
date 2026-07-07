import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { parsePairingPayload } from '../../src/lib/tunnel/pairing';
import { Surface } from '../../src/components/ui/Surface';
import { ModalHeader } from '../../src/components/shell/ModalHeader';

/**
 * Connection screen (#218) — the pairing surface, moved out of the retired
 * Run tab into the More corner. QR scan, one-tap reconnect, manual paste,
 * and the live connection status with a disconnect action.
 */
export default function ConnectionScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const {
    connect, disconnect, connectionState, lastConnection, panes,
  } = useTunnel();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const handleQrScanned = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    const parsed = parsePairingPayload(data);
    if (!parsed) {
      setError('Unrecognised QR code — expected the base-studio-code pairing code.');
      setScanning(false);
      return;
    }
    scannedRef.current = true;
    setScanning(false);
    void connect(parsed);
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
    const parsed = parsePairingPayload(manualJson.trim());
    if (!parsed) {
      setError('Paste the full pairing JSON from base-studio-code.');
      return;
    }
    void connect(parsed);
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
        <View style={styles.viewfinderOuter} pointerEvents="none">
          <View style={[styles.viewfinder, { borderColor: t.accent }]} />
          <Text style={[styles.viewfinderLabel, { color: '#fff' }]}>
            Point at the QR code in base-studio-code
          </Text>
        </View>
        <Pressable
          style={[styles.cancelScan, { top: insets.top + 12 }]}
          onPress={() => setScanning(false)}
        >
          <Text style={[styles.cancelScanText, { color: '#fff' }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const isConnecting = connectionState === 'connecting' || connectionState === 'authenticating';
  const isConnected = connectionState === 'connected';
  const paneCount = Object.keys(panes).length;

  return (
    <View style={styles.root}>
      <ModalHeader title="Connection" subtitle="Pair with base-studio-code" />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status ── */}
        <Surface style={styles.statusCard} radius={10}>
          <View
            style={[styles.statusDot, {
              backgroundColor: isConnected ? '#4ade80' : isConnecting ? '#fbbf24'
                : connectionState === 'error' ? '#f87171' : t.fgDim,
            }]}
          />
          <View style={styles.statusText}>
            <Text style={[styles.statusTitle, { color: t.fg }]}>
              {isConnected ? 'Connected'
                : connectionState === 'authenticating' ? 'Authenticating…'
                  : connectionState === 'connecting' ? 'Connecting…'
                    : connectionState === 'error' ? 'Connection failed' : 'Not connected'}
            </Text>
            <Text style={[styles.statusDetail, { color: t.fgMuted }]} numberOfLines={1}>
              {isConnected && lastConnection
                ? `${lastConnection.relayUrl.replace(/^wss?:\/\//, '')} · ${paneCount} session${paneCount === 1 ? '' : 's'}`
                : 'The desktop pushes its state here, end-to-end encrypted.'}
            </Text>
          </View>
          {isConnected && (
            <Pressable
              onPress={disconnect}
              style={[styles.disconnectBtn, { borderColor: t.borderColor }]}
              hitSlop={6}
            >
              <Text style={[styles.disconnectText, { color: t.fgMuted }]}>Disconnect</Text>
            </Pressable>
          )}
          {isConnecting && (
            <Pressable onPress={disconnect} hitSlop={6}>
              <ActivityIndicator color={t.accent} size="small" />
            </Pressable>
          )}
        </Surface>

        {(error || connectionState === 'error') && (
          <Text style={styles.errorText}>
            {error
              ?? "Couldn't reach the desktop. Make sure base-studio-code's tunnel is running, then scan the QR again — a saved pairing stops working once the desktop restarts."}
          </Text>
        )}

        {/* ── Pairing actions ── */}
        {!isConnected && (
          <>
            {lastConnection && (
              <Pressable
                onPress={() => { void connect(lastConnection); }}
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
              onPress={() => { void handleScanPress(); }}
              disabled={isConnecting}
              style={[styles.scanBtn, { backgroundColor: t.accent, opacity: isConnecting ? 0.5 : 1 }]}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"
                  stroke="#fff" strokeWidth={2} strokeLinecap="round"
                />
              </Svg>
              <Text style={styles.scanBtnText}>Scan QR Code</Text>
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
                  style={[styles.manualInput, {
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
                  style={[styles.manualConnectBtn, { borderColor: t.accent, opacity: isConnecting ? 0.5 : 1 }]}
                >
                  <Text style={[styles.manualConnectText, { color: t.accent }]}>Connect</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 14 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flex: 1, gap: 3 },
  statusTitle: { fontSize: 14.5, fontWeight: '600' },
  statusDetail: { fontSize: 12 },
  disconnectBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  disconnectText: { fontSize: 12, fontWeight: '500' },
  errorText: { color: '#f87171', fontSize: 12.5, lineHeight: 18 },
  reconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  reconnectText: { fontSize: 13.5, fontWeight: '600' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    paddingVertical: 13,
  },
  scanBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  manualToggle: { alignItems: 'center', paddingVertical: 4 },
  manualToggleText: { fontSize: 12.5 },
  manualForm: { gap: 10 },
  manualInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  manualConnectBtn: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 11,
  },
  manualConnectText: { fontSize: 13.5, fontWeight: '600' },
  cameraWrap: { flex: 1 },
  viewfinderOuter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  viewfinder: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderRadius: 18,
  },
  viewfinderLabel: { fontSize: 13, fontWeight: '500' },
  cancelScan: {
    position: 'absolute',
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cancelScanText: { fontSize: 13.5, fontWeight: '600' },
});
