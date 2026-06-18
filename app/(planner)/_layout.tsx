import React from 'react';
import { Stack } from 'expo-router';
import { PlannerProvider } from '../../src/lib/planner/PlannerContext';

// The planner is a full-screen takeover with its own internal chrome, so this
// stack just hosts the single screen with no native header. PlannerProvider
// scopes the project store + persistence to this route group.
export default function PlannerLayout() {
  return (
    <PlannerProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="planner" />
      </Stack>
    </PlannerProvider>
  );
}
