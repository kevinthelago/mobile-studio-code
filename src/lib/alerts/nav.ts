import { router } from 'expo-router';
import { openSessionChat } from '../sessions/nav';
import type { AlertTarget } from './model';

// Navigation for the alert surfaces (#222), kept in one place — the header
// bell, the inbox rows, the AlertToast, and FCM notification taps all route
// through these so every entry point lands on the SAME screen (mirroring
// sessions/nav.ts).

/** Open the alerts inbox (modal group, like the sessions roster). */
export function openAlertsInbox() {
  router.push('/(alerts)/inbox');
}

/**
 * Follow a resolved alert deep-link (see `alertTarget` in model.ts):
 * chat → that session's chat; planner → the Planner tab; inbox → the inbox.
 */
export function openAlertTarget(target: AlertTarget) {
  switch (target.type) {
    case 'chat':
      openSessionChat(target.paneId);
      break;
    case 'planner':
      router.navigate('/(tabs)/plan');
      break;
    default:
      openAlertsInbox();
  }
}
