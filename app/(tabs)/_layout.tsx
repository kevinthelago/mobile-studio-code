import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';
import { AlertToast } from '../../src/components/alerts/AlertToast';

/**
 * The read-only mirror shell (#218): five bottom tabs —
 * Glance · Planner · Skills · UI · Automations (which folds MCP servers in as
 * a segmented page). The app lands on Glance. Pairing, providers, theme, and
 * the (coming) Security audit page live behind the header's More corner.
 * The AlertToast (#222, generalising #219) overlays every tab: a paused
 * session or any fleet alert surfaces a banner deep-linking to its target.
 */
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Glance' }} />
        <Tabs.Screen name="plan" options={{ title: 'Planner' }} />
        <Tabs.Screen name="skills" options={{ title: 'Skills' }} />
        <Tabs.Screen name="ui" options={{ title: 'UI' }} />
        <Tabs.Screen name="automations" options={{ title: 'Automations' }} />
      </Tabs>
      <AlertToast />
    </View>
  );
}
