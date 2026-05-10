import { Tabs } from 'expo-router';
import React from 'react';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';

// Native scene background is painted by the ThemedFrame in app/_layout.tsx;
// the installed expo-router doesn't accept sceneContainerStyle here so we
// don't try to set it again at the tab navigator level.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Files' }} />
      <Tabs.Screen name="find" options={{ title: 'Find' }} />
      <Tabs.Screen name="edit" options={{ title: 'Edit' }} />
      <Tabs.Screen name="run" options={{ title: 'Run' }} />
      <Tabs.Screen name="git" options={{ title: 'Git' }} />
    </Tabs>
  );
}
