import { Tabs } from 'expo-router';
import React from 'react';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Set native screen background so the UIViewController doesn't bleed grey
        screenBackgroundColor: t.bg,
        contentStyle: { backgroundColor: 'transparent' },
      }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Files' }} />
      <Tabs.Screen name="find" options={{ title: 'Find' }} />
      <Tabs.Screen name="edit" options={{ title: 'Edit' }} />
      <Tabs.Screen name="run" options={{ title: 'Run' }} />
      <Tabs.Screen name="git" options={{ title: 'Git' }} />
      <Tabs.Screen name="files" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
