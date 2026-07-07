import React from 'react';
import { Stack } from 'expo-router';

/**
 * The "More" corner (#218): pairing/connection, providers, theme, and the
 * placeholder Security (audit) page — reached from every tab header's gear.
 */
export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="more" />
      <Stack.Screen name="connection" />
      <Stack.Screen name="providers" />
      <Stack.Screen name="theme" />
      <Stack.Screen name="security" />
    </Stack>
  );
}
