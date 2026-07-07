import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { ThemeProvider as NavThemeProvider, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular, JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { SessionProvider, useSession } from '../src/lib/session';
import { TunnelProvider, useTunnel } from '../src/lib/TunnelContext';
import { ThemeProvider, useTheme } from '../src/theme';
import { Orbs } from '../src/components/ui/Orbs';
import { PlannerSyncProvider } from '../src/lib/planner/PlannerSyncContext';
import { LivePlanProvider } from '../src/lib/tunnel/LivePlanContext';
import { MirrorProvider } from '../src/lib/mirror/MirrorContext';
import {
  initFcm, subscribeFcm, getInitialNotificationTap, onNotificationOpened,
} from '../src/lib/fcm';
import { openSessionChat } from '../src/lib/sessions/nav';
import { AlertsProvider, useAlerts } from '../src/lib/alerts/AlertsContext';
import { alertTarget, type PushTap } from '../src/lib/alerts/model';
import { openAlertTarget } from '../src/lib/alerts/nav';

// One place both tap paths (cold-start + background) route through: a
// `user_request` tap deep-links into that session's chat (#219); an #2498
// alert tap follows its resolved target (that session's chat, the Planner tab,
// or the inbox).
function routeTap(tap: PushTap) {
  if (tap.type === 'user_request') {
    openSessionChat(tap.paneId);
  } else {
    openAlertTarget(alertTarget({ kind: tap.kind, paneId: tap.paneId }));
  }
}

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
  const { setFcmToken } = useTunnel();
  const { recordFcmAlert } = useAlerts();

  useEffect(() => {
    let cleanupSub: (() => void) | undefined;

    (async () => {
      const token = await initFcm();
      if (token) setFcmToken(token);

      // Handle taps on notifications while the app was quit (cold start):
      // route by kind (#219 user_request → chat; #2498 alert → its target).
      // SessionChat's mount effect asserts focus, so no separate focusPane.
      const initialTap = await getInitialNotificationTap();
      if (initialTap) routeTap(initialTap);

      cleanupSub = subscribeFcm(
        // Token refresh — keep the desktop in sync
        (newToken) => setFcmToken(newToken),
        // Foreground user_request — pane state is already updated by
        // TunnelClient; TunnelContext surfaces the signal to the AlertToast.
        (_paneId, _prompt) => {},
        // Foreground #2498 alert push — fold into the inbox + raise the toast.
        (kind, title, body, paneId) => recordFcmAlert(kind, title, body, paneId),
      );
    })();

    // Handle taps while the app was backgrounded (not quit)
    const cleanupOpened = onNotificationOpened((tap) => routeTap(tap));

    return () => {
      cleanupSub?.();
      cleanupOpened();
    };
  }, [setFcmToken, recordFcmAlert]);

  return null;
}

function InnerStack() {
  const t = useTheme();
  // Slide-up modals get an OPAQUE content background (the theme bg) so they
  // occlude the screen beneath during the slide animation. The tabs stay
  // transparent so the ThemedFrame + Orbs show through behind them.
  const modal = { animation: 'slide_from_bottom' as const, contentStyle: { backgroundColor: t.bg } };
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
        <Stack.Screen name="repo" options={modal} />
        <Stack.Screen name="(planner)" options={modal} />
        <Stack.Screen name="(sync)" options={modal} />
        <Stack.Screen name="(more)" options={modal} />
        <Stack.Screen name="(sessions)" options={modal} />
        <Stack.Screen name="(alerts)" options={modal} />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    JetBrainsMono_400Regular, JetBrainsMono_500Medium,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <SessionProvider>
        <TunnelProvider>
          <PlannerSyncProvider>
            <LivePlanProvider>
              <MirrorProvider>
                <AlertsProvider>
                  <FcmBootstrap />
                  <ThemedFrame>
                    <StageGate>
                      <InnerStack />
                    </StageGate>
                  </ThemedFrame>
                </AlertsProvider>
              </MirrorProvider>
            </LivePlanProvider>
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
