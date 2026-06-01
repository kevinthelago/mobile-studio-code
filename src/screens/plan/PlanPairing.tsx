import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { parseTunnelPairing } from '../../lib/tunnelPairing';
import { Card } from '../../components/ui/Card';
import { Btn } from '../../components/ui/Btn';
import { ClaudeBadge, DARK_ON_ACCENT } from './planShared';
import { TAB_BAR_HEIGHT } from './nav';

// Plan's tunnel-offline state. Plan mirrors the project-planning surface hosted
// in base-studio-code on the desktop, read over the Noise relay; with no live
// tunnel there is nothing to mirror. The desktop shows the pairing QR (Settings
// → Mobile), so on mobile the primary action is to scan it — that camera flow
// already lives on the Run tab, so we route there rather than duplicate the
// scanner here. Pasting a pairing code is wired directly to useTunnel().connect.
export function PlanPairing() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connect, connectionState } = useTunnel();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const connecting = connectionState === 'connecting' || connectionState === 'authenticating';

  const handlePaste = useCallback(() => {
    setError(null);
    const pairing = parseTunnelPairing(token.trim());
    if (!pairing) {
      setError('Paste the full pairing code shown under the QR in base-studio-code.');
      return;
    }
    connect(pairing);
  }, [token, connect]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: t.elev, borderColor: t.borderStrong }]}>
            <Text style={[styles.heroGlyph, { color: t.accent, fontFamily: t.fontMono }]}>⇋</Text>
          </View>
          <Text style={[styles.heroTitle, { color: t.fg, fontFamily: t.fontMono }]}>Pair with desktop</Text>
          <Text style={[styles.heroBody, { color: t.fgMuted }]}>
            Plan reads from the project-planning host running in base-studio-code on your
            desktop. Open the desktop app, then scan the QR or paste the pairing code below.
          </Text>
        </View>

        {/* Scan CTA */}
        <Card style={styles.scanCard}>
          <ClaudeBadge size={40} radius={10} />
          <Text style={[styles.scanLabel, { color: t.fgMuted, fontFamily: t.fontMono }]}>
            scan from Settings → Mobile on desktop
          </Text>
          <Btn variant="primary" onPress={() => router.navigate('/(tabs)/run' as never)} style={styles.scanBtn}>
            Scan QR code
          </Btn>
        </Card>

        {/* divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: t.borderColor }]} />
          <Text style={[styles.dividerText, { color: t.fgDim, fontFamily: t.fontMono }]}>or paste code</Text>
          <View style={[styles.dividerLine, { backgroundColor: t.borderColor }]} />
        </View>

        <View style={styles.pasteRow}>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder='{"relayUrl":"wss://…","room":"…",…}'
            placeholderTextColor={t.fgDim}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.pasteInput, {
              color: t.fg, backgroundColor: t.elev, borderColor: t.borderColor, fontFamily: t.fontMono,
            }]}
          />
          <Btn variant="primary" onPress={handlePaste} disabled={connecting}>
            {connecting
              ? <ActivityIndicator size="small" color={DARK_ON_ACCENT} />
              : 'pair'}
          </Btn>
        </View>

        {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}

        <Card style={styles.statusCard} background={t.elev}>
          <View style={[styles.statusDot, { backgroundColor: t.warn }]} />
          <View style={styles.flex1}>
            <Text style={[styles.statusText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
              No host paired yet.
            </Text>
            <Text style={[styles.statusSub, { color: t.fgDim, fontFamily: t.fontMono }]}>
              Pairing connects over the Noise relay tunnel.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 24, gap: 18 },

  hero: { alignItems: 'center', gap: 6 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 14, marginBottom: 8,
    alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth,
  },
  heroGlyph: { fontSize: 22 },
  heroTitle: { fontSize: 18, fontWeight: '600' },
  heroBody: { fontSize: 12.5, textAlign: 'center', lineHeight: 19, marginHorizontal: 6 },

  scanCard: { alignItems: 'center', gap: 12, padding: 18, borderRadius: 8 },
  scanLabel: { fontSize: 10.5, textAlign: 'center' },
  scanBtn: { alignSelf: 'stretch' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 10 },

  pasteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pasteInput: {
    flex: 1, minHeight: 44, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, textAlignVertical: 'top',
    letterSpacing: 0.3,
  },
  error: { fontSize: 12, textAlign: 'center' },

  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 10.5 },
  statusSub: { fontSize: 9.5, marginTop: 2 },
});
