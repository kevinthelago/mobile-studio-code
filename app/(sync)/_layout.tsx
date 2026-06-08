import React from 'react';
import { Stack } from 'expo-router';

// Conflict-resolution flow — a full-screen takeover with its own internal views.
export default function SyncLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="sync" />
    </Stack>
  );
}
