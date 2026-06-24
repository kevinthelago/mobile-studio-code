import React from 'react';
import { Stack } from 'expo-router';

// Live planning mirror — a full-screen, read-only view of the desktop's live
// planning session, with input-gated drive actions (advance / confirm / chat).
export default function LiveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="live" />
    </Stack>
  );
}
