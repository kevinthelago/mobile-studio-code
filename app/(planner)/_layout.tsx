import React from 'react';
import { Stack } from 'expo-router';

// The planner is a full-screen takeover with its own internal 4-tab chrome,
// so this stack just hosts the single index screen with no native header.
export default function PlannerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="planner" />
    </Stack>
  );
}
