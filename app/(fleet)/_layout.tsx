import React from 'react';
import { Stack } from 'expo-router';

export default function FleetLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="fleet" />
    </Stack>
  );
}
