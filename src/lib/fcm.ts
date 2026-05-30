import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

export type FcmTokenCallback = (token: string) => void;
export type UserRequestCallback = (paneId: string, prompt: string) => void;

/**
 * Requests notification permission and returns the FCM device token.
 * Returns null if permission is denied.
 */
export async function initFcm(): Promise<string | null> {
  const status = await messaging().requestPermission();
  const granted =
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL;
  if (!granted) return null;
  // iOS requires the device to be registered for remote messages (APNs) before
  // a token can be fetched — calling getToken() first throws
  // [messaging/unregistered]. On Android this is a no-op.
  if (!messaging().isDeviceRegisteredForRemoteMessages) {
    await messaging().registerDeviceForRemoteMessages();
  }
  return messaging().getToken();
}

/**
 * Subscribes to FCM token refreshes and foreground messages.
 * Returns a cleanup function to unsubscribe.
 */
export function subscribeFcm(
  onToken: FcmTokenCallback,
  onUserRequest: UserRequestCallback,
): () => void {
  const unsubToken = messaging().onTokenRefresh(onToken);

  const unsubForeground = messaging().onMessage(async (remote) => {
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
  const initial = await messaging().getInitialNotification();
  if (initial?.data?.type === 'user_request') {
    return (initial.data.paneId as string) ?? null;
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
  return messaging().onNotificationOpenedApp((remote) => {
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
