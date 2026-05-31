# Mobile Studio Code

A mobile IDE built with Expo and React Native — write, edit, and ship code from your iOS device.

**Standalone-first:** with a GitHub PAT and an Anthropic API key, MSC is a complete IDE on
its own — it talks directly to GitHub (REST) and Claude, with no desktop or server required.
Pairing with a desktop Studio Code session over the encrypted tunnel is an **optional**
add-on (the Run and Plan tabs) that degrades gracefully to standalone when no desktop is present.

---

## Status

[![EAS Update](https://img.shields.io/github/actions/workflow/status/kevinthelago/Mobile-Studio-Code/update.yml?label=EAS%20Update&logo=expo&logoColor=white)](https://github.com/kevinthelago/Mobile-Studio-Code/actions/workflows/update.yml)
[![CI](https://img.shields.io/github/actions/workflow/status/kevinthelago/Mobile-Studio-Code/ci.yml?label=CI&logo=github)](https://github.com/kevinthelago/Mobile-Studio-Code/actions/workflows/ci.yml)
[![Expo Preview](https://img.shields.io/github/actions/workflow/status/kevinthelago/Mobile-Studio-Code/expo-preview.yml?label=Expo%20Preview&logo=expo&logoColor=white)](https://github.com/kevinthelago/Mobile-Studio-Code/actions/workflows/expo-preview.yml)
[![GitHub Issues](https://img.shields.io/github/issues/kevinthelago/Mobile-Studio-Code?logo=github)](https://github.com/kevinthelago/Mobile-Studio-Code/issues)
[![GitHub PRs](https://img.shields.io/github/issues-pr/kevinthelago/Mobile-Studio-Code?logo=github)](https://github.com/kevinthelago/Mobile-Studio-Code/pulls)

---

## 📱 Run the latest in Expo Go

Every push to `main` publishes an EAS Update to the `main` channel.

**[▶️ Open the latest update on expo.dev →](https://expo.dev/accounts/kevinthelago/projects/mobile-studio-code/branches/main)**

That page has a QR code and an "Open in Expo Go" button. The link is always live — it points at whatever was last published.

If you'd rather deeplink directly, paste this into Safari on your iOS device:

```
exp://u.expo.dev/a11a7b6c-6d05-4b39-9ff1-ea694b914b66?channel-name=main
```

> GitHub's mobile renderer strips `exp://` links so they can't be tapped from this README. The https link above works from anywhere. Requires [Expo Go](https://expo.dev/client) installed.

---

## 🗂️ Task & Branch Workflow

Every change is tracked through a GitHub Issue.

```
Open Issue  →  Create Branch  →  Open PR  →  Merge  →  Issue Closes
```

| Step | Convention |
|------|-----------|
| New task | Open a GitHub Issue (use a template below) |
| Start work | Branch from `develop` as `{issue-number}-{short-description}` (e.g. `14-sha-null-push-test`) |
| Open PR | Target `develop`, fill in the PR template — include `Closes #N` |
| Merge | Issue auto-closes, EAS Update publishes |

### Issue Templates
- [✨ Feature](https://github.com/kevinthelago/Mobile-Studio-Code/issues/new?template=feature.md)
- [🐛 Bug](https://github.com/kevinthelago/Mobile-Studio-Code/issues/new?template=bug.md)
- [🔧 Chore](https://github.com/kevinthelago/Mobile-Studio-Code/issues/new?template=chore.md)

---

## Getting Started (local dev)

```bash
npm install
npx expo start --tunnel
```

Scan the QR with Expo Go. `--tunnel` works from anywhere; drop the flag if your phone is on the same Wi-Fi.

---

## Tech Stack

| | |
|---|---|
| Framework | Expo SDK 54 / React Native 0.81 |
| Router | expo-router |
| OTA updates | EAS Update (channel: `main`) |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Language | TypeScript |
