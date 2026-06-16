import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

export type FcmTokenCallback = (token: string) => void;
export type UserRequestCallback = (paneId: string, prompt: string) => void;

// iOS suppresses an FCM banner while the app is in the foreground, so the OS
// never displays an incoming user_request push if MSC is open. We surface it
// ourselves as a local notification (see presentUserRequest); this handler is
// what lets a foregrounded local notification actually show as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
    // Show a visible banner while foregrounded (iOS won't on its own), then
    // forward the pane state to the caller.
    if (remote.data?.type === 'user_request' && remote.data?.paneId) {
      await presentUserRequest(remote);
    }
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

/**
 * Presents a local heads-up notification for a foreground user_request. Title
 * and body come from the push's `notification` block when present, falling
 * back to the prompt text. The paneId rides in the notification data so a tap
 * can route to the right pane (see onNotificationResponse).
 */
async function presentUserRequest(remote: FirebaseMessagingTypes.RemoteMessage) {
  const paneId = remote.data?.paneId as string;
  const prompt = (remote.data?.prompt as string) ?? '';
  const title = remote.notification?.title ?? 'Claude needs you';
  const body = remote.notification?.body ?? prompt ?? 'A session is waiting for your input.';
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { type: 'user_request', paneId } },
    trigger: null, // deliver immediately
  });
}

/**
 * Registers a handler for taps on a locally-presented foreground notification
 * (see presentUserRequest). Mirrors onNotificationOpened, which handles taps
 * on OS-rendered notifications while backgrounded. Returns a cleanup function.
 */
export function onNotificationResponse(
  handler: (paneId: string) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      type?: string;
      paneId?: string;
    };
    if (data?.type === 'user_request' && data.paneId) {
      handler(data.paneId);
    }
  });
  return () => sub.remove();
}
