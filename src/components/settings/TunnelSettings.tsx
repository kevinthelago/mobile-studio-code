import React from 'react';
import { StyleSheet, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTunnel } from '../../lib/TunnelContext';
import { PairingDiagnostics, TunnelConnectionState } from '../../lib/types';
import { useTheme, Theme } from '../../theme';

// ── T7: Tunnel / relay / FCM diagnostics settings surface ────────────────────
// This component lives in the Settings tab and shows the current state of:
//   1. The WebSocket tunnel connection (state machine)
//   2. Per-leg pairing diagnostics (relay reach → room join → handshake → auth)
//   3. FCM push-notification token status

const STATUS_OK = '#34c759';
const STATUS_ERR = '#ff3b30';

type LegProps = {
  label: string;
  status: 'ok' | 'fail' | 'pending' | null;
};

function DiagLeg({ label, status }: LegProps) {
  const t = useTheme();
  const icon = status === 'ok' ? '✓' : status === 'fail' ? '✗' : status === 'pending' ? '…' : '—';
  const color = status === 'ok' ? STATUS_OK : status === 'fail' ? STATUS_ERR : status === 'pending' ? t.fgMuted : t.fgDim;
  return (
    <View style={styles.legRow}>
      <Text style={[styles.legIcon, { color }]}>{icon}</Text>
      <Text style={[styles.legLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

function connectionLabel(state: TunnelConnectionState): string {
  switch (state) {
    case 'disconnected': return 'Disconnected';
    case 'connecting': return 'Connecting…';
    case 'authenticating': return 'Authenticating…';
    case 'connected': return 'Connected';
    case 'error': return 'Connection failed';
  }
}

function connectionColor(state: TunnelConnectionState, t: Theme): string {
  switch (state) {
    case 'connected': return STATUS_OK;
    case 'error': return STATUS_ERR;
    default: return t.fgMuted;
  }
}

type Props = {
  /** Optional: current FCM token (for display). Pass null if not yet obtained. */
  fcmToken?: string | null;
  /** Optional: reconnect button handler (shown when state is 'error' or 'disconnected'). */
  onReconnect?: () => void;
  /** Optional: disconnect button handler. */
  onDisconnect?: () => void;
};

export function TunnelSettings({ fcmToken, onReconnect, onDisconnect }: Props) {
  const { connectionState, diagnostics, lastConnection } = useTunnel();
  const t = useTheme();

  const isConnecting = connectionState === 'connecting' || connectionState === 'authenticating';
  const canReconnect = (connectionState === 'error' || connectionState === 'disconnected') && !!lastConnection;

  return (
    <View style={styles.root}>
      {/* ── Connection state ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.fgMuted }]}>TUNNEL</Text>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <View style={styles.stateRow}>
            {isConnecting && <ActivityIndicator size="small" style={styles.spinner} />}
            <Text style={[styles.stateText, { color: connectionColor(connectionState, t) }]}>
              {connectionLabel(connectionState)}
            </Text>
          </View>
          {lastConnection && (
            <Text style={[styles.relayText, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
              {lastConnection.relayUrl}
            </Text>
          )}
          {diagnostics.failReason && connectionState === 'error' && (
            <Text style={[styles.errorText, { color: STATUS_ERR }]} numberOfLines={2}>
              {diagnostics.failReason}
            </Text>
          )}
        </View>
      </View>

      {/* ── Per-leg diagnostics ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.fgMuted }]}>PAIRING DIAGNOSTICS</Text>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <DiagLeg label="Relay reachable" status={diagnostics.relayReach} />
          <DiagLeg label="Room joined" status={diagnostics.roomJoin} />
          <DiagLeg label="Noise handshake" status={diagnostics.handshake} />
          <DiagLeg label="Auth accepted" status={diagnostics.auth} />
        </View>
      </View>

      {/* ── FCM push token ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.fgMuted }]}>PUSH NOTIFICATIONS</Text>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          {fcmToken ? (
            <>
              <View style={styles.legRow}>
                <Text style={[styles.legIcon, { color: STATUS_OK }]}>✓</Text>
                <Text style={[styles.legLabel, { color: t.fg }]}>FCM token registered</Text>
              </View>
              <Text style={[styles.relayText, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
                {fcmToken.length > 20 ? `${fcmToken.slice(0, 20)}…` : fcmToken}
              </Text>
            </>
          ) : (
            <View style={styles.legRow}>
              <Text style={[styles.legIcon, { color: t.fgDim }]}>—</Text>
              <Text style={[styles.legLabel, { color: t.fgMuted }]}>No FCM token (push unavailable)</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Actions ── */}
      <View style={styles.actions}>
        {canReconnect && onReconnect && (
          <Pressable
            style={[styles.btn, styles.btnPrimary, { backgroundColor: t.accent }]}
            onPress={onReconnect}
          >
            <Text style={[styles.btnText, { color: '#fff' }]}>Reconnect</Text>
          </Pressable>
        )}
        {connectionState === 'connected' && onDisconnect && (
          <Pressable
            style={[styles.btn, styles.btnSecondary, { borderColor: t.borderColor }]}
            onPress={onDisconnect}
          >
            <Text style={[styles.btnText, { color: t.fgMuted }]}>Disconnect</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 20 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 4 },
  card: { borderRadius: 12, padding: 14, gap: 8 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spinner: { marginRight: 4 },
  stateText: { fontSize: 15, fontWeight: '600' },
  relayText: { fontSize: 12 },
  errorText: { fontSize: 12 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legIcon: { fontSize: 14, width: 16, textAlign: 'center' },
  legLabel: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnPrimary: {},
  btnSecondary: { borderWidth: 1, backgroundColor: 'transparent' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
