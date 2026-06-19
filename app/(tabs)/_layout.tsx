import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';
import { SessionStrip } from '../../src/components/ui/SessionStrip';

// Land on the Run (tunneling/sessions) tab when entering the app, while keeping
// Files first in the tab bar. The tab-bar order still follows the Tabs.Screen
// declaration order below.
export const unstable_settings = { initialRouteName: 'run' };

// Native scene background is painted by the ThemedFrame in app/_layout.tsx;
// the installed expo-router doesn't accept sceneContainerStyle here so we
// don't try to set it again at the tab navigator level.
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Files' }} />
        <Tabs.Screen name="find" options={{ title: 'Find' }} />
        <Tabs.Screen name="edit" options={{ title: 'Edit' }} />
        <Tabs.Screen name="run" options={{ title: 'Run' }} />
        <Tabs.Screen name="git" options={{ title: 'Git' }} />
        <Tabs.Screen name="github" options={{ title: 'Pulse' }} />
      </Tabs>
      {/* Persistent session strip — absolutely positioned, does not affect tab layouts */}
      <SessionStrip />
    </View>
  );
}
