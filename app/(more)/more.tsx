import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { ModalHeader } from '../../src/components/shell/ModalHeader';
import { SpecHost } from '../../src/components/kit/SpecHost';

/**
 * The More menu (#218) — rendered from the `mobile.moreMenu` GeneralNode spec (the design-system port).
 * The menu structure lives as data; this screen supplies only the host wiring: each row's navigation
 * `action` and the connection row's live status-dot color via `binds`. Editing/reordering the menu is a
 * spec edit in base-studio-code, not a code change here.
 */
export default function MoreScreen() {
  const t = useTheme();
  const { connectionState } = useTunnel();
  const connColor = connectionState === 'connected' ? '#4ade80' : t.fgDim;
  const go = (href: Href) => () => router.push(href);

  return (
    <View style={styles.root}>
      <ModalHeader title="More" subtitle="Connection, appearance & account" />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <SpecHost
          id="mobile.moreMenu"
          values={{ connColor }}
          on={{
            openSessions: go('/(sessions)/roster'),
            openConnection: go('/(more)/connection'),
            openProviders: go('/(more)/providers'),
            openTheme: go('/(more)/theme'),
            openSecurity: go('/(more)/security'),
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 16 },
});
