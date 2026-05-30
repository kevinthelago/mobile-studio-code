import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { SessionProvider, useSession } from '../src/lib/session';
import { TunnelProvider, useTunnel } from '../src/lib/TunnelContext';
import { ApiKeyPromptProvider } from '../src/lib/ApiKeyContext';
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
    // No onboarding gate: land in the tabs by default. /repo and /settings are
    // reachable modals; anything else falls back to the tabs.
    const top = segments[0];
    const known = top === '(tabs)' || top === 'repo' || top === 'settings';
    if (!known) router.replace('/(tabs)');
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
      {/* Layered backdrop, bottom → top:
          1. themed solid color (t.bg)
          2. animated Orbs
          3. a frosted blur that softens the bg + Orbs
          Every screen renders transparent on top, so the whole app shares this
          one ambient, blurred backdrop. pointerEvents=none lets taps fall
          through to the screen content above. */}
      <Orbs />
      <BlurView
        intensity={t.light ? 28 : 40}
        tint={t.light ? 'light' : 'dark'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <StatusBar style={t.light ? 'dark' : 'light'} />
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
      // Push notifications are an auxiliary feature (tunnel user-request alerts).
      // FCM setup can fail on a real device for reasons outside the app's control
      // (APNs not yet configured, no network, denied permission) — none of which
      // should crash app startup. Degrade gracefully if it throws.
      try {
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
      } catch (err) {
        console.warn('[fcm] push notification setup failed; continuing without it', err);
      }
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
      <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <ApiKeyPromptProvider>
          <TunnelProvider>
            <FcmBootstrap />
            <ThemedFrame>
              <StageGate>
                <InnerStack />
              </StageGate>
            </ThemedFrame>
          </TunnelProvider>
        </ApiKeyPromptProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  content: { flex: 1, backgroundColor: 'transparent' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
