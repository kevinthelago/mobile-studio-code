import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/lib/session';
import { TunnelProvider, useTunnel } from '../src/lib/TunnelContext';
import { ThemeProvider, useTheme } from '../src/theme';
import { Orbs } from '../src/components/ui/Orbs';
import {
  initFcm, subscribeFcm, getInitialNotificationPaneId, onNotificationOpened,
} from '../src/lib/fcm';

function StageGate({ children }: { children: React.ReactNode }) {
  const { stage } = useSession();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (stage === 'loading') return;
    const inTabs = segments[0] === '(tabs)';
    const onRepo = segments[0] === 'repo';
    const onPlanner = segments[0] === '(planner)';

    if (stage === 'repo' && !onRepo && !onPlanner) router.replace('/repo');
    else if (stage === 'ready' && !inTabs && !onRepo && !onPlanner) router.replace('/(tabs)');
  }, [stage, segments, router]);

  const t = useTheme();
  if (stage === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  return <>{children}</>;
}

function ThemedFrame({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: t.bg }]}>
      <Orbs />
      <StatusBar style={t.light ? 'dark' : 'light'} />
      {/* transparent so t.bg and Orbs show through all screens */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

/**
 * Initialises Firebase Cloud Messaging on mount, pushes the token to
 * TunnelContext (which forwards it to the desktop during the auth handshake),
 * and handles deep-link routing from notification taps.
 */
function FcmBootstrap() {
  const { setFcmToken, focusPane } = useTunnel();
  const router = useRouter();

  useEffect(() => {
    let cleanupSub: (() => void) | undefined;

    (async () => {
      const token = await initFcm();
      if (token) setFcmToken(token);

      // Handle taps on notifications while the app was quit (cold start)
      const initialPaneId = await getInitialNotificationPaneId();
      if (initialPaneId) {
        focusPane(initialPaneId);
        router.navigate('/(tabs)/run' as never);
      }

      cleanupSub = subscribeFcm(
        // Token refresh — keep the desktop in sync
        (newToken) => setFcmToken(newToken),
        // Foreground user_request — pane state is already updated by TunnelClient;
        // no additional action needed here since the SessionStrip will highlight it.
        (_paneId, _prompt) => {},
      );
    })();

    // Handle taps while the app was backgrounded (not quit)
    const cleanupOpened = onNotificationOpened((paneId) => {
      focusPane(paneId);
      router.navigate('/(tabs)/run' as never);
    });

    return () => {
      cleanupSub?.();
      cleanupOpened();
    };
  }, [setFcmToken, focusPane, router]);

  return null;
}

function InnerStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Native screen bg comes from ThemedFrame; keep stack content
        // transparent so the orbs/theme bg show through. (The native-stack
        // accepts contentStyle even though Tabs doesn't.)
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="repo" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="(planner)" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <TunnelProvider>
          <FcmBootstrap />
          <ThemedFrame>
            <StageGate>
              <InnerStack />
            </StageGate>
          </ThemedFrame>
        </TunnelProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  content: { flex: 1, backgroundColor: 'transparent' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
