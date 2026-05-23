import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/lib/session';
import { TunnelProvider } from '../src/lib/TunnelContext';
import { ThemeProvider, useTheme } from '../src/theme';
import { Orbs } from '../src/components/ui/Orbs';

function StageGate({ children }: { children: React.ReactNode }) {
  const { stage } = useSession();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (stage === 'loading') return;
    const inTabs = segments[0] === '(tabs)';
    const onSetup = segments[0] === 'setup';
    const onRepo = segments[0] === 'repo';

    if (stage === 'setup' && !onSetup) router.replace('/setup');
    else if (stage === 'repo' && !onRepo) router.replace('/repo');
    else if (stage === 'ready' && !inTabs && !onRepo) router.replace('/(tabs)');
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
      <Stack.Screen name="setup" options={{ animation: 'fade' }} />
      <Stack.Screen name="repo" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <TunnelProvider>
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
