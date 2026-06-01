import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';
import { SessionStrip } from '../../src/components/ui/SessionStrip';
import { MONO_FAMILY } from '../../src/theme';

// Tunnel-first: the app opens on the Run tab, which shows the QR pairing view
// when no desktop is connected. (When a tunnel is already paired, Run shows the
// live session grid instead.)
export const unstable_settings = { initialRouteName: 'run' };

// Native scene background is painted by the ThemedFrame in app/_layout.tsx;
// the installed expo-router doesn't accept sceneContainerStyle here so we
// don't try to set it again at the tab navigator level.
export default function TabsLayout() {
  // Gate the redesign surface on the JetBrains Mono load so monospace chrome
  // never flashes a system fallback. We render once the font is ready OR errors
  // (never strand the app on a font failure); theme.ts also kicks off the load
  // app-wide for the pre-tabs onboarding screens.
  const [fontsLoaded, fontError] = useFonts({ [MONO_FAMILY]: JetBrainsMono_400Regular });
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          // Transparent tab scenes so the ThemedFrame's bg + Orbs + blur show
          // through (screens render transparent). Without this, the navigator's
          // default white scene background covers the themed backdrop.
          sceneStyle: { backgroundColor: 'transparent' },
        }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Files' }} />
        <Tabs.Screen name="find" options={{ title: 'Find' }} />
        <Tabs.Screen name="edit" options={{ title: 'Edit' }} />
        <Tabs.Screen name="run" options={{ title: 'Run' }} />
        <Tabs.Screen name="git" options={{ title: 'Git' }} />
        <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      </Tabs>
      {/* Persistent session strip — absolutely positioned, does not affect tab layouts */}
      <SessionStrip />
    </View>
  );
}
