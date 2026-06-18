import React from 'react';
import { Stack } from 'expo-router';

export default function AutomationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="automations" />
    </Stack>
  );
}
