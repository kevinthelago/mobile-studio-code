# Firebase / FCM on Android — setup & verification

This is the Android counterpart to the iOS Firebase config. iOS uses
`GoogleService-Info.plist`; Android uses `google-services.json`. Both are
**client** configs (restricted to the app's bundle/package ID), so — like the
iOS plist — `google-services.json` is committed to the repo so EAS managed
builds can copy it. The only Firebase file that must **never** be committed is an
Admin SDK **service-account** key (`*-firebase-adminsdk-*.json`), which is
ignored in `.gitignore`.

## What's already wired (code, done in #21)

- `app.json` → `android.googleServicesFile: "./google-services.json"`. The
  `@react-native-firebase/app` config plugin reads this and injects the
  `com.google.gms.google-services` Gradle plugin during prebuild — no extra
  Android plugin is needed (the `withFirebasePodfile` plugin is iOS-only).
- `@react-native-firebase/app` and `@react-native-firebase/messaging` are already
  in the `plugins` array and apply to both platforms.
- `.gitignore` un-ignores `google-services.json` so it can be tracked.

## What you must do (credential — not doable from a coding session)

1. In the [Firebase console](https://console.firebase.google.com/), open the same
   project that owns the iOS app.
2. Add an **Android app** with package name **`com.mobilestudiocode.app`** (must
   match `android.package` in `app.json` exactly).
3. Download the generated **`google-services.json`**.
4. Place it at the repo root (next to `app.json` and `GoogleService-Info.plist`):
   ```
   mobile-studio-code/google-services.json
   ```
5. Commit it (it is no longer gitignored):
   ```
   git add google-services.json
   git commit -m "chore(firebase): add Android google-services.json client config"
   ```

> Without this file, an Android EAS build (#22) will fail at prebuild with a
> "google-services.json not found" error. iOS builds are unaffected.

## Verify FCM on a real Android device (device — handed off)

1. Build and install an Android dev build on a physical device (needs #22's EAS
   Android profile):
   ```
   eas build --platform android --profile development
   ```
2. Launch the app and grant the notification permission (Android 13+ prompts at
   runtime via `expo-notifications` / `@react-native-firebase/messaging`).
3. Retrieve the device FCM token (log it on registration) and send a test message
   from **Firebase console → Messaging → "Send test message"**, or via the FCM
   HTTP v1 API using the device token.
4. **Background the app**, then send the message.
5. **Expected:** the notification is delivered and appears in the system tray
   while the app is backgrounded; tapping it opens the app.

## Acceptance criteria (issue #21)

- [x] `google-services.json` wired via `android.googleServicesFile` in `app.json`
- [ ] `google-services.json` downloaded from the console and committed *(you)*
- [ ] FCM delivers a backgrounded notification on a real Android device *(you)*
- [x] iOS Firebase path unchanged (plist, `withFirebasePodfile`, plugins intact)

## Related

- #22 — EAS Android build & submit profiles (needed to produce the Android build)
- #23 — Android feature-parity pass on a real device
