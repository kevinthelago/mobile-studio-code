# Mobile Studio Code

A mobile IDE built with Expo and React Native — write, edit, and ship code from your iOS device.

---

## Status

[![EAS Update](https://img.shields.io/github/actions/workflow/status/kevinthelago/Mobile-Studio-Code/update.yml?label=EAS%20Update&logo=expo&logoColor=white)](https://github.com/kevinthelago/Mobile-Studio-Code/actions/workflows/update.yml)
[![CI](https://img.shields.io/github/actions/workflow/status/kevinthelago/Mobile-Studio-Code/ci.yml?label=CI&logo=github)](https://github.com/kevinthelago/Mobile-Studio-Code/actions/workflows/ci.yml)
[![Expo Preview](https://img.shields.io/github/actions/workflow/status/kevinthelago/Mobile-Studio-Code/expo-preview.yml?label=Expo%20Preview&logo=expo&logoColor=white)](https://github.com/kevinthelago/Mobile-Studio-Code/actions/workflows/expo-preview.yml)
[![GitHub Issues](https://img.shields.io/github/issues/kevinthelago/Mobile-Studio-Code?logo=github)](https://github.com/kevinthelago/Mobile-Studio-Code/issues)
[![GitHub PRs](https://img.shields.io/github/issues-pr/kevinthelago/Mobile-Studio-Code?logo=github)](https://github.com/kevinthelago/Mobile-Studio-Code/pulls)

---

## 📱 Run the latest in Expo Go

Every push to `main` publishes an EAS Update to the `main` channel. To open the latest build in Expo Go on your iOS device:

**Tap on iOS:** [exp://u.expo.dev/a11a7b6c-6d05-4b39-9ff1-ea694b914b66?channel-name=main](exp://u.expo.dev/a11a7b6c-6d05-4b39-9ff1-ea694b914b66?channel-name=main)

**Or scan the QR for the latest update on `main`:**
[expo.dev → branches/main](https://expo.dev/accounts/kevinthelago/projects/mobile-studio-code/branches/main)

> The deeplink is stable; the QR on the branch page always points at the most recent commit. Requires [Expo Go](https://expo.dev/client) installed.

---

## 🗂️ Task & Branch Workflow

Every change is tracked through a GitHub Issue.

```
Open Issue  →  Create Branch  →  Open PR  →  Merge  →  Issue Closes
```

| Step | Convention |
|------|-----------|
| New task | Open a GitHub Issue (use a template below) |
| Start work | Create branch `issue-{number}/short-slug` |
| Open PR | Fill in PR template — include `Closes #N` |
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
