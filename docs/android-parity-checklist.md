# Android feature-parity checklist (real device)

Issue #23. The app was built and verified on iOS first. This is the manual
pass that confirms each Expo capability and the agent loop behave the same on a
**physical Android device** (the emulator is not sufficient for camera/push).

Run an Android dev build and install it on a real device:

```bash
npm run build:android:dev   # needs eas.json Android profile (#22) + google-services.json (#21)
```

## Code change done in #23

- [x] **Adaptive-icon foreground asset** — `assets/adaptive-icon.png` (1024×1024,
      the Claude-orb gradient) wired via `android.adaptiveIcon.foregroundImage` in
      `app.json`. Regenerate with `node scripts/gen-adaptive-icon.js`. Verify the
      launcher icon shows the orb on a `#0b0d14` background across launcher mask
      shapes (circle, squircle, rounded square).

## On-device verification (handed off — needs hardware)

- [ ] **expo-secure-store** — onboarding stores the GitHub PAT + Anthropic API
      key; both survive an app restart (Android Keystore).
- [ ] **expo-file-system** — repo clone writes under `documentDirectory`; files
      render in the Files tab and persist across restart.
- [ ] **expo-camera** — the QR scan screen opens, the permission prompt appears,
      and a code is decoded.
- [ ] **react-native-reanimated** — Orbs background + ClaudeAvatar animate
      smoothly; no worklet/crash errors in the log.
- [ ] **Agent loop** — send a chat message; the agent reads/writes a file and
      completes a turn (Anthropic calls succeed on Android networking).
- [ ] **Tunnel client** — once #15 lands, confirm it connects on Android; until
      then confirm the app is fully usable with no tunnel (standalone).
- [ ] **Push (FCM)** — backgrounded notification delivered (see
      [firebase-android-setup.md](./firebase-android-setup.md), #21).

## Acceptance criteria (issue #23)

- [x] Adaptive-icon foreground asset added
- [ ] secure-store / file-system / camera / reanimated verified on Android *(you)*
- [ ] Agent loop and tunnel client function on Android *(you)*

## Related

- #21 — Android Firebase / FCM · #22 — EAS Android build profiles
- #13 — Standalone E2E release gate (run it on Android too)
