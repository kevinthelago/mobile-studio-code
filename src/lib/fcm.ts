import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  requestPermission,
  registerDeviceForRemoteMessages,
  isDeviceRegisteredForRemoteMessages,
  onTokenRefresh,
  onMessage,
  getInitialNotification,
  onNotificationOpenedApp,
  AuthorizationStatus,
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

export type FcmTokenCallback = (token: string) => void;
export type UserRequestCallback = (paneId: string, prompt: string) => void;

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
    // iOS must register with APNs before a token can be fetched; calling
    // getToken first throws `messaging/unregistered`.
    if (!isDeviceRegisteredForRemoteMessages(m)) {
      await registerDeviceForRemoteMessages(m);
    }
    return await getToken(m);
  } catch (e) {
    console.warn('FCM init failed (continuing without push):', e);
    return null;
  }
}

/**
 * Subscribes to FCM token refreshes and foreground messages.
 * Returns a cleanup function to unsubscribe.
 */
export function subscribeFcm(
  onToken: FcmTokenCallback,
  onUserRequest: UserRequestCallback,
): () => void {
  const m = messaging();
  const unsubToken = onTokenRefresh(m, onToken);
  const unsubForeground = onMessage(m, async (remote) => {
    handleRemoteMessage(remote, onUserRequest);
  });

  return () => {
    unsubToken();
    unsubForeground();
  };
}

/**
 * Checks if the app was opened from a notification tap (cold start or
 * background). Returns the paneId from the payload if so, otherwise null.
 */
export async function getInitialNotificationPaneId(): Promise<string | null> {
  try {
    const initial = await getInitialNotification(messaging());
    if (initial?.data?.type === 'user_request') {
      return (initial.data.paneId as string) ?? null;
    }
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
  handler: (paneId: string) => void,
): () => void {
  return onNotificationOpenedApp(messaging(), (remote) => {
    if (remote.data?.type === 'user_request' && remote.data?.paneId) {
      handler(remote.data.paneId as string);
    }
  });
}

function handleRemoteMessage(
  remote: FirebaseMessagingTypes.RemoteMessage,
  onUserRequest: UserRequestCallback,
) {
  if (remote.data?.type === 'user_request' && remote.data?.paneId) {
    const paneId = remote.data.paneId as string;
    const prompt = (remote.data.prompt as string) ?? '';
    onUserRequest(paneId, prompt);
  }
}
