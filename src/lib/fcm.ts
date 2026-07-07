import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  requestPermission,
  registerDeviceForRemoteMessages,
  onTokenRefresh,
  onMessage,
  getInitialNotification,
  onNotificationOpenedApp,
  AuthorizationStatus,
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { parsePushTap, type PushTap } from './alerts/model';

export type FcmTokenCallback = (token: string) => void;
export type UserRequestCallback = (paneId: string, prompt: string) => void;
/** A #2498 alert push received while the app is foregrounded. */
export type AlertPushCallback = (
  kind: string,
  title: string,
  body: string,
  paneId?: string,
) => void;

// Single messaging instance via the modular API (the namespaced `messaging()`
// API is deprecated and removed in the next major).
function messaging() {
  return getMessaging(getApp());
}

/**
 * Requests notification permission and returns the FCM device token, or null
 * if permission is denied or push isn't available (e.g. a simulator without
 * APNs). Never throws — push is optional, so failures degrade gracefully.
 */
export async function initFcm(): Promise<string | null> {
  try {
    const m = messaging();
    const status = await requestPermission(m);
    const granted =
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL;
    if (!granted) return null;
    try {
      return await getToken(m);
    } catch (e) {
      // Only register if the device isn't registered yet. This avoids the
      // "registerDeviceForRemoteMessages is not required" warning that fires
      // when auto-registration is enabled, while still handling the case where
      // it's disabled (getToken throws `messaging/unregistered`).
      if (String((e as Error)?.message ?? e).includes('unregistered')) {
        await registerDeviceForRemoteMessages(m);
        return await getToken(m);
      }
      throw e;
    }
  } catch (e) {
    // Push is optional: a build without the aps-environment entitlement (e.g. a
    // dev build with push not yet provisioned) fails here — degrade quietly.
    console.warn('Push unavailable (continuing without it):', (e as Error)?.message ?? e);
    return null;
  }
}

/**
 * Subscribes to FCM token refreshes and foreground messages. Foreground
 * messages fan out by `data.type`: `user_request` (#219) and `alert` (#2498 —
 * banner title/body from the notification block, kind/paneId from data).
 * Returns a cleanup function to unsubscribe.
 */
export function subscribeFcm(
  onToken: FcmTokenCallback,
  onUserRequest: UserRequestCallback,
  onAlert: AlertPushCallback,
): () => void {
  const m = messaging();
  const unsubToken = onTokenRefresh(m, onToken);
  const unsubForeground = onMessage(m, async (remote) => {
    handleRemoteMessage(remote, onUserRequest, onAlert);
  });

  return () => {
    unsubToken();
    unsubForeground();
  };
}

/**
 * Checks if the app was opened from a notification tap (cold start). Returns
 * the parsed tap (`user_request` or `alert`) if so, otherwise null — the
 * caller routes it (see alerts/model.ts `alertTarget`).
 */
export async function getInitialNotificationTap(): Promise<PushTap | null> {
  try {
    const initial = await getInitialNotification(messaging());
    return parsePushTap(initial?.data);
  } catch (e) {
    console.warn('getInitialNotification failed:', e);
  }
  return null;
}

/**
 * Registers a handler for when the user taps a notification while the app
 * is backgrounded (not quit). Returns a cleanup function.
 */
export function onNotificationOpened(
  handler: (tap: PushTap) => void,
): () => void {
  return onNotificationOpenedApp(messaging(), (remote) => {
    const tap = parsePushTap(remote.data);
    if (tap) handler(tap);
  });
}

function handleRemoteMessage(
  remote: FirebaseMessagingTypes.RemoteMessage,
  onUserRequest: UserRequestCallback,
  onAlert: AlertPushCallback,
) {
  const tap = parsePushTap(remote.data);
  if (!tap) return;
  if (tap.type === 'user_request') {
    const prompt = (remote.data?.prompt as string) ?? '';
    onUserRequest(tap.paneId, prompt);
    return;
  }
  onAlert(
    tap.kind,
    remote.notification?.title ?? '',
    remote.notification?.body ?? '',
    tap.paneId,
  );
}
