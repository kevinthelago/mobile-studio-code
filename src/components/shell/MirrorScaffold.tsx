import React, { type ReactNode } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { useMirrorDomain } from '../../lib/mirror/MirrorContext';
import { SpecHost } from '../kit/SpecHost';
import { ScreenHeader } from './ScreenHeader';

type Props = {
  /** The mirrored desktop store this page reads (see src/lib/mirror). */
  domain: string;
  title: string;
  subtitle?: string;
  /** One line describing what this page will mirror once its content lands. */
  blurb: string;
  /** Optional header action pill (passed through to ScreenHeader, #219). */
  headerAction?: { label: string; onPress: () => void };
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
export function MirrorScaffold({ domain, title, subtitle, blurb, headerAction, toolbar, children }: Props) {
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
      <ScreenHeader title={title} subtitle={subtitle} action={headerAction} />
      {toolbar}
      <View style={styles.body}>{body}</View>
    </View>
  );
}

/**
 * The mirror empty/zero state — rendered from a bundled GeneralNode spec (the design-system port), not
 * hand-coded. Picks the disconnected spec (with a Pair action) or the plain one by whether an action is
 * given; `title`/`detail` flow in through the spec's `binds`, the Pair handler through its `actions`,
 * and the native mirror glyph through the `mirrorIcon` Slot (a visual a data tree can't express).
 */
function EmptyCard({
  title, detail, action,
}: {
  title: string;
  detail: string;
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  const icon = (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      {/* monitor → phone mirror glyph */}
      <Path d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5V8h-2V6H5v7h6v2H4.5A1.5 1.5 0 013 13.5v-8z" fill={t.fgDim} />
      <Path d="M14.5 10h4A1.5 1.5 0 0120 11.5v7a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-7a1.5 1.5 0 011.5-1.5z" stroke={t.accent} strokeWidth={1.5} />
    </Svg>
  );
  return (
    <View style={styles.centered}>
      <SpecHost
        id={action ? 'mobile.mirrorDisconnected' : 'mobile.mirrorEmpty'}
        values={{ title, description: detail }}
        on={action ? { pair: action.onPress } : undefined}
        slots={{ mirrorIcon: icon }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  hint: { fontSize: 12.5 },
});
