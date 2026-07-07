import React from 'react';
import { Stack } from 'expo-router';

/**
 * The sessions surfaces (#219): the roster of every desktop session (grouped
 * by kind) and the one reusable SessionChat. Reached from the Glance header,
 * the More menu, the Planner chat affordance, and notification taps — NOT a
 * sixth tab.
 */
export default function SessionsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      {/* Named `roster` (not `index`) so this group never serializes to `/`,
          which would collide with the (tabs) group's index route. */}
      <Stack.Screen name="roster" />
      <Stack.Screen name="chat" />
    </Stack>
  );
}
