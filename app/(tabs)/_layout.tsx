import { Tabs } from 'expo-router';
import React from 'react';
import { useTheme } from '../../src/theme';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Use the actual theme bg, not transparent — the native RNSScreen
        // layer ignores 'transparent' on iOS but will honour a real colour,
        // preventing the white flash between tabs.
        contentStyle: { backgroundColor: t.bg },
      }}
      tabBar={(props) => <BottomTabBar {...props} />}
      sceneContainerStyle={{ backgroundColor: t.bg }}
    >
      <Tabs.Screen name="index" options={{ title: 'Files' }} />
      <Tabs.Screen name="find" options={{ title: 'Find' }} />
      <Tabs.Screen name="edit" options={{ title: 'Edit' }} />
      <Tabs.Screen name="run" options={{ title: 'Run' }} />
      <Tabs.Screen name="git" options={{ title: 'Git' }} />
    </Tabs>
  );
}
