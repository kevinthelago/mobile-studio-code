# Mobile Studio Code

A mobile IDE built with Expo and React Native — write, edit, and ship code from your iOS device.

---

## Status

[![Expo Preview](https://img.shields.io/github/actions/workflow/status/LutherShawn/mobile-studio-code/expo-preview.yml?label=Expo%20Preview&logo=expo&logoColor=white)](https://github.com/LutherShawn/mobile-studio-code/actions/workflows/expo-preview.yml)
[![Issue Branch Check](https://img.shields.io/github/actions/workflow/status/LutherShawn/mobile-studio-code/issue-branch-check.yml?label=Issue%20Check&logo=github)](https://github.com/LutherShawn/mobile-studio-code/actions/workflows/issue-branch-check.yml)
[![GitHub Issues](https://img.shields.io/github/issues/LutherShawn/mobile-studio-code?logo=github)](https://github.com/LutherShawn/mobile-studio-code/issues)
[![GitHub PRs](https://img.shields.io/github/issues-pr/LutherShawn/mobile-studio-code?logo=github)](https://github.com/LutherShawn/mobile-studio-code/pulls)

---

## 📦 Latest Preview Build

> Preview bundles are built automatically on every PR to `main`.  
> Find the latest artifact on the Actions page:

**[⬇️ Download Latest Preview Bundle →](https://github.com/LutherShawn/mobile-studio-code/actions/workflows/expo-preview.yml)**

1. Open the latest successful run
2. Scroll to **Artifacts** → download `expo-preview-pr-N`
3. Unzip and serve: `npx serve dist/`
4. Open Expo Go → enter the local URL

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
| Merge | Issue auto-closes, artifact is uploaded |

### Issue Templates
- [✨ Feature](https://github.com/LutherShawn/mobile-studio-code/issues/new?template=feature.md)
- [🐛 Bug](https://github.com/LutherShawn/mobile-studio-code/issues/new?template=bug.md)
- [🔧 Chore](https://github.com/LutherShawn/mobile-studio-code/issues/new?template=chore.md)

---

## Getting Started

```bash
npm install
npx expo start
```

Requires [Expo Go](https://expo.dev/client) on your iOS device.

---

## Tech Stack

| | |
|---|---|
| Framework | Expo SDK 54 / React Native 0.81 |
| Router | expo-router |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Language | TypeScript |
