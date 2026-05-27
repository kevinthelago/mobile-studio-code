# EAS Android builds & submit

`eas.json` previously built iOS only (the `development` profile was
`ios.simulator`, and `submit` had only `ios`). This adds Android to every
profile plus an Android production submit config.

## Build profiles (in `eas.json`)

| Profile | iOS | Android | Channel | Distribution |
|---|---|---|---|---|
| `development` | simulator | **`apk`** (dev client) | — | internal |
| `preview` | (device) | **`apk`** | `preview` | internal |
| `production` | (store) | **`app-bundle`** (`.aab`) | `production` | store |

- Dev and preview produce **APKs** so they install directly on a device without
  the Play Store (`distribution: internal`).
- Production produces an **AAB**, which is what the Play Store requires.

## Commands (npm scripts)

```bash
# Android
npm run build:android:dev       # dev client APK
npm run build:android:preview   # internal preview APK
npm run build:android:prod      # production AAB
npm run submit:android          # submit production AAB to Play Store

# iOS (unchanged)
npm run build:dev | build:preview | build:prod
npm run submit
```

## Submit config

`submit.production.android` is set to `track: "internal"`,
`releaseStatus: "draft"`. The build uploads to the **internal testing track** as a
**draft** (you publish it explicitly in the Play Console — no surprise release).
Flip `releaseStatus` to `"completed"` when you want it auto-available to internal
testers (see #25).

## Handoff (account / hardware — not doable from a coding session)

1. **Google Play service account key.** `eas submit --platform android` needs a
   Play Console service-account JSON. Configure it via `eas credentials` (managed,
   recommended) or add `serviceAccountKeyPath` to `submit.production.android`.
   **Do not commit the key** — it is a server-side secret (`.gitignore` ignores
   `*-firebase-adminsdk-*.json`; keep Play keys out of the repo too).
2. **`google-services.json`** must be present for any Android build — see
   [firebase-android-setup.md](./firebase-android-setup.md) (#21).
3. **Real-device check (acceptance criterion):**
   ```bash
   npm run build:android:dev
   ```
   Install the resulting APK on a physical Android device and confirm the app
   launches and reaches the main screen. Covered more fully by #23.

## Acceptance criteria (issue #22)

- [x] `development`, `preview`, `production` profiles build an Android artifact
- [x] Production Android submit configuration exists
- [ ] An Android dev build installs and runs on a real device *(you — needs the
      Play key + `google-services.json` + hardware)*

## Related

- #21 — Android Firebase config (`google-services.json`)
- #23 — Android feature-parity pass on a real device
- #25 — Submit Android build to the Play Store internal track
