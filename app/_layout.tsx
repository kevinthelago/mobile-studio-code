import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemeProvider as NavThemeProvider, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/lib/session';
import { TunnelProvider, useTunnel } from '../src/lib/TunnelContext';
import { ThemeProvider, useTheme } from '../src/theme';
import { Orbs } from '../src/components/ui/Orbs';
import { PlannerSyncProvider } from '../src/lib/planner/PlannerSyncContext';
import {
  initFcm, subscribeFcm, getInitialNotificationPaneId, onNotificationOpened,
} from '../src/lib/fcm';

// Dark navigation theme with a transparent background so the ThemedFrame (theme
// bg + ambient Orbs) shows through behind every screen rather than React
// Navigation's default light-grey background.
const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent' },
};

// Holds the UI on a spinner until secrets + any saved manifest have loaded,
// then renders the app. Navigation isn't gated — the app boots into the tabs
// (Run screen) and the repo picker / planner are reached on demand.
function StageGate({ children }: { children: React.ReactNode }) {
  const { stage } = useSession();
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
    // Transparent navigation background so the dark ThemedFrame + Orbs show
    // through behind every screen, instead of React Navigation's default
    // light-grey theme background (the iOS "grey bleed-through"). This restores
    // the intent of the old `screenBackgroundColor: t.bg` fix, which is no
    // longer a valid native-stack option under React Navigation v7.
    <NavThemeProvider value={NAV_THEME}>
      <Stack
        screenOptions={{
          headerShown: false,
          // Keep screen content transparent so the orbs/theme bg show through.
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="repo" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="(planner)" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="(sync)" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <TunnelProvider>
          <PlannerSyncProvider>
            <FcmBootstrap />
            <ThemedFrame>
              <StageGate>
                <InnerStack />
              </StageGate>
            </ThemedFrame>
          </PlannerSyncProvider>
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
