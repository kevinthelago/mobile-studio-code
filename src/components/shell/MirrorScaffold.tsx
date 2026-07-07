import React, { type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { useMirrorDomain } from '../../lib/mirror/MirrorContext';
import { Surface } from '../ui/Surface';
import { ScreenHeader } from './ScreenHeader';

type Props = {
  /** The mirrored desktop store this page reads (see src/lib/mirror). */
  domain: string;
  title: string;
  subtitle?: string;
  /** One line describing what this page will mirror once its content lands. */
  blurb: string;
  /** Optional strip rendered between the header and the body (e.g. segments). */
  toolbar?: ReactNode;
  /** Render the synced payload. Omitted → a generic "synced" card (scaffold). */
  children?: (data: unknown, rev: number) => ReactNode;
};

/**
 * Read-only page scaffold over one mirror domain (#218). Display-only by
 * product rule — no CRUD controls here or in any page built on it; mutations
 * flow through the chat surfaces.
 *
 * States: disconnected → pair prompt · connecting → spinner ·
 * connected-but-unsynced → awaiting sync · synced → children (or a stub card).
 */
export function MirrorScaffold({ domain, title, subtitle, blurb, toolbar, children }: Props) {
  const t = useTheme();
  const { connectionState } = useTunnel();
  const { data, rev, synced } = useMirrorDomain(domain);
  const connecting = connectionState === 'connecting' || connectionState === 'authenticating';

  let body: ReactNode;
  if (synced) {
    // Once a projection has landed, keep showing it even across a reconnect.
    body = children ? children(data, rev) : (
      <EmptyCard
        title={`${title} is synced`}
        detail={`Mirroring the desktop (rev ${rev}). The full read-only view for this page lands with its content issue.`}
      />
    );
  } else if (connecting) {
    body = (
      <View style={styles.centered}>
        <ActivityIndicator color={t.accent} />
        <Text style={[styles.hint, { color: t.fgMuted }]}>Connecting to your desktop…</Text>
      </View>
    );
  } else if (connectionState === 'connected') {
    body = (
      <EmptyCard
        title="Awaiting sync"
        detail={`Connected — waiting for the desktop to push its ${domain} state. ${blurb}`}
      />
    );
  } else {
    body = (
      <EmptyCard
        title="Not connected"
        detail={`${blurb} Pair with base-studio-code on your desktop to mirror it here, read-only.`}
        action={{ label: 'Pair with desktop', onPress: () => router.push('/(more)/connection') }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} subtitle={subtitle} />
      {toolbar}
      <View style={styles.body}>{body}</View>
    </View>
  );
}

function EmptyCard({
  title, detail, action,
}: {
  title: string;
  detail: string;
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <Surface style={styles.card} radius={10}>
        <View style={styles.cardIcon}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            {/* monitor → phone mirror glyph */}
            <Path d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5V8h-2V6H5v7h6v2H4.5A1.5 1.5 0 013 13.5v-8z" fill={t.fgDim} />
            <Path d="M14.5 10h4A1.5 1.5 0 0120 11.5v7a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-7a1.5 1.5 0 011.5-1.5z" stroke={t.accent} strokeWidth={1.5} />
          </Svg>
        </View>
        <Text style={[styles.cardTitle, { color: t.fg }]}>{title}</Text>
        <Text style={[styles.cardDetail, { color: t.fgMuted }]}>{detail}</Text>
        {action && (
          <Pressable
            onPress={action.onPress}
            style={[styles.cardBtn, { borderColor: t.accent }]}
            accessibilityRole="button"
          >
            <Text style={[styles.cardBtnText, { color: t.accent }]}>{action.label}</Text>
          </Pressable>
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  hint: { fontSize: 12.5 },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 22,
    gap: 8,
  },
  cardIcon: { marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardDetail: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  cardBtn: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardBtnText: { fontSize: 13, fontWeight: '600' },
});
