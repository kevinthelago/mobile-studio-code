import { Tabs } from 'expo-router';
import React from 'react';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';

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
      <Tabs.Screen name="files" options={{ href: null }} />
    </Tabs>
  );
}
