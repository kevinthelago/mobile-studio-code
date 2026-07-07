import React from 'react';
import { router } from 'expo-router';
import { ProvidersScreen } from '../../src/components/ProvidersScreen';

/**
 * Providers (#218) — "connect a model", moved out of the retired Run tab's
 * pairing surface into the More corner. Reuses the existing ProvidersScreen.
 */
export default function ProvidersRoute() {
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  return <ProvidersScreen onBack={back} onConnected={back} />;
}
