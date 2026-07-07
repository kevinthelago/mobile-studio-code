import React from 'react';
import { Stack } from 'expo-router';

/**
 * The alerts surfaces (#222): the notification inbox — the rolling list of
 * everything the fleet needed you for. Reached from the header bell on every
 * tab, the AlertToast, and FCM notification taps — NOT a sixth tab.
 */
export default function AlertsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      {/* Named `inbox` (not `index`) so this group never serializes to `/`,
          which would collide with the (tabs) group's index route. */}
      <Stack.Screen name="inbox" />
    </Stack>
  );
}
