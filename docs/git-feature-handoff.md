# Git Feature Handoff — Mobile Studio Code

## Purpose
This document is a complete briefing for a new Claude session to pick up and
finish the Git features in this Expo/React-Native app. Read it top to bottom
before touching any code.

---

## 1. Project Overview

**Mobile Studio Code** is a fully mobile-native IDE that runs on iOS (Expo
managed workflow). There is **no terminal, no shell, no `git` binary**. All git
operations must go through the **GitHub REST / Git Data API** over HTTPS.

Key constraint baked into every design decision:
> _This app runs on a phone. `exec`, `spawn`, `child_process`, and any shell
> command are unavailable. Every file operation uses `expo-file-system`; every
> git operation uses `fetch()` against `api.github.com`._

---

## 2. Repository Layout (relevant paths)

```
app/
  git.tsx                  ← Git tab UI (currently 100% mock data — needs wiring)
  repo.tsx                 ← Repo picker / downloader
  (tabs)/                  ← Tab navigator screens
  _layout.tsx              ← Root layout, session gate

src/
  lib/
    gitClient.ts           ← GitHub Git Data API client (push, status)
    github.ts              ← Higher-level GitHub helpers (pull, blob, issues, putFile)
    fs.ts                  ← Expo FileSystem wrappers (readText, writeText, manifest…)
    storage.ts             ← SecureStore helpers (LLM + Git settings)
    session.tsx            ← Session context (PAT, ghUser, manifest, repo state)
    types.ts               ← Shared types (Manifest, FileEntry, ChatMessage…)
    errorBus.ts            ← Global error/warning pub-sub bus
    agent.ts               ← Agentic loop (LLM → tool → loop)
    llm.ts                 ← Unified LLM client (Anthropic / OpenAI / compatible)
  screens/
    SettingsScreen.tsx     ← LLM settings UI (model, API key, provider)
  components/
    ui/                    ← Shared UI primitives (Surface, Orbs, ThemePicker…)
  theme/                   ← Design tokens, useTheme hook
```

---

## 3. Auth & Credentials

All secrets live in **iOS Keychain via `expo-secure-store`**. There are two
separate credential namespaces:

| Key | Contents | Accessor |
|-----|----------|----------|
| `llm_settings` | LLM provider, model, API key, base URL | `getLLMSettings()` / `saveLLMSettings()` in `storage.ts` |
| `git_settings` | GitHub `owner`, `repo`, `branch`, PAT `token` | `getGitSettings()` / `saveGitSettings()` in `gitClient.ts` |

**Important**: `session.tsx` also holds a `pat` (GitHub PAT) used for the _repo
download_ flow. This is the same token that should be reused in git operations —
currently `gitClient.ts` uses a *separate* `git_settings.token` field, which
creates a duplication problem (see §7 below).

---

## 4. Local File Storage

Downloaded repo files live at:
```
<FileSystem.documentDirectory>/repos/<owner>__<repo>/<path>
```
Helpers in `fs.ts`:
- `repoDir(fullName)` → absolute directory path
- `readText(absPath)` → `Promise<string>`
- `writeText(absPath, content)` → `Promise<void>`
- `readManifest(repo)` → `Promise<Manifest | null>`
- `writeManifest(m)` → `Promise<void>`

The **manifest** (`Manifest` type in `types.ts`) tracks every file with:
```ts
{
  repo: string;        // "owner/repo"
  branch: string;
  syncedAt: number;
  files: Record<string, FileEntry>;  // path → { sha, modified }
}
```
`FileEntry.modified = true` means the user has locally edited the file since the
last pull. `FileEntry.sha` is the last-known remote blob SHA — used for conflict
detection during pull and for constructing the push diff.

---

## 5. What `gitClient.ts` Already Does (and its limits)

`pushFiles(files, message)` implements the full GitHub Git Data API push:
1. GET current HEAD SHA from `refs/heads/<branch>`
2. GET commit → base tree SHA
3. POST blobs for each file
4. POST new tree (delta on base tree)
5. POST new commit
6. PATCH ref to new commit SHA

`getRemoteStatus()` fetches branch metadata and returns `{ branch, remoteUrl,
lastCommitSha, lastCommitMessage, aheadBy: 0, behindBy: 0 }`.

**Current limitations:**
- `aheadBy` / `behindBy` are always `0` — there is no local commit graph.
  "Ahead" should be derived from counting locally-modified files (`modified:true`
  in manifest). "Behind" requires comparing remote SHA against synced SHA.
- `readLocalFile()` in `gitClient.ts` reads from `FileSystem.documentDirectory`
  directly, which is inconsistent with the `fs.ts` convention.
- The `git_settings` SecureStore key duplicates the PAT already stored in the
  session. These should be unified (see §7).

---

## 6. `app/git.tsx` — Current State

The Git tab is **100% static mock data**:
```ts
const GIT_STATUS = {
  branch: 'feat/streaming',
  upstream: 'origin/feat/streaming',
  ahead: 2,
  behind: 0,
  staged: [{ path: 'app/llm/client.py', state: 'M', adds: 4, dels: 1 }],
  unstaged: [
    { path: 'app/llm/cli.py', state: 'M', adds: 12, dels: 3 },
    ...
  ],
};
```

The action buttons (Pull, Push, Sync) are `TouchableOpacity` with no `onPress`
handlers. The "Commit · 1 file" button and "Draft with Claude" button are also
inert.

There is **no import of `gitClient.ts` or `github.ts`** in `git.tsx` at all.

---

## 7. What Needs to Be Built

### 7a. Unify the PAT / token

`session.tsx` already verifies and stores the GitHub PAT (`pat` in session
context). `gitClient.ts` reads a *separate* `git_settings.token`. These should
be the same token. Options:
- Remove `token` from `GitSettings` and have `gitClient.ts` call into session
  context or pass the PAT explicitly as a parameter.
- Or: on first git operation, copy `session.pat` into `git_settings.token` if
  it is blank.

Preferred: pass `pat` explicitly or pull it from session inside the tab — don't
maintain two copies of the same secret.

### 7b. Derive real "changed files" from the Manifest

`manifest.files` has `modified: true` on every file the user has edited. That is
the ground truth for what to push. Build a function:

```ts
async function getModifiedFiles(manifest: Manifest): Promise<Array<{
  path: string;
  content: string;
  sha: string | null;   // remote blob sha (null = new file)
}>>
```

This reads each modified file from disk via `fs.readText(repoDir(manifest.repo) + path)`
and returns the payload for `pushFiles()`.

### 7c. Wire the Git tab UI

Replace mock data with live data:

1. **On mount**: call `getRemoteStatus()` (or just read from session manifest)
   to populate branch name, ahead/behind counts.
2. **Changes list**: read `manifest.files`, filter `modified: true`, display
   as the "unstaged" list. (There is no local staging area — all modified files
   are "staged" for the next push.)
3. **Push button**: 
   - Collect modified files via §7b
   - Show commit message input (already exists in UI)
   - Call `pushFiles(files, message)` from `gitClient.ts`
   - On success: mark all pushed files as `modified: false` in manifest, update
     `sha` to new blob SHA (returned by GitHub in the blob creation step)
   - Show success/error via the `errorBus`
4. **Pull button**: call `pullRepo()` from `github.ts` using session `pat` and
   `manifest`.
5. **Sync button**: Pull first, then Push (or prompt if conflicts exist).
6. **"Draft with Claude" button**: call the agent with the diff summary as
   context and ask it to write a conventional commit message.

### 7d. Git Settings UI

There is currently **no UI** for editing `git_settings` (owner, repo, branch).
The LLM settings screen (`SettingsScreen.tsx`) is a good template. Add a "Git"
section to Settings — or a standalone screen — with fields for:
- Owner (pre-filled from `manifest.repo.split('/')[0]`)
- Repo (pre-filled from `manifest.repo.split('/')[1]`)
- Branch (pre-filled from `manifest.branch`)
- Token (if separate from session PAT — see §7a)

### 7e. Ahead/Behind count

"Ahead" = number of locally-modified files (proxy, not true commit delta).
"Behind" = compare `manifest.syncedAt` against latest remote commit timestamp
— or simply fetch `getRemoteStatus()` and compare the remote HEAD SHA against
the SHA at last sync time (stored in manifest).

### 7f. Mark modified on edit

When `app/edit.tsx` (or wherever file saves happen) writes a file to disk via
`writeText()`, it should also call `writeManifest()` with that file's entry
updated to `modified: true`. Verify this is already wired; if not, add it.

---

## 8. Data Flow Diagram

```
session.tsx
  └─ pat (GitHub PAT)
  └─ manifest (Manifest)           ← source of truth for local file state
       └─ files[path].modified     ← true = needs push
       └─ files[path].sha          ← last remote blob SHA

git.tsx (UI)
  ├─ reads manifest from useSession()
  ├─ calls getRemoteStatus() → branch info header
  ├─ Push button → getModifiedFiles() → pushFiles() → update manifest
  └─ Pull button → pullRepo() → update manifest

gitClient.ts
  ├─ pushFiles(files, message) → GitHub Git Data API
  └─ getRemoteStatus() → GitHub branches API

github.ts
  ├─ pullRepo(pat, manifest) → fetch + write files + update manifest
  ├─ putFileContent(pat, ...) → GitHub Contents API (single-file shortcut)
  └─ downloadRepo(pat, repo, branch) → initial clone

fs.ts
  └─ readText, writeText, readManifest, writeManifest, repoDir…
```

---

## 9. Constraints & Gotchas

- **No shell, no `git` binary.** Every operation is REST. Don't suggest
  `child_process`, `exec`, or any Node.js shell primitive — they do not exist
  in Expo managed workflow on iOS.
- **Binary files**: `fetchBlob` uses `atob()`. Binary files (images, compiled
  artifacts) will corrupt. The push path should skip files that are not valid
  UTF-8. The manifest already handles this — blobs that failed to decode were
  silently skipped on download.
- **Token scope**: The GitHub PAT must have the `repo` scope (or fine-grained
  `Contents: write` + `Metadata: read`). Validate this and surface a clear
  error if the token lacks scope.
- **Force push**: `pushFiles` uses `force: false` on the PATCH ref step. If the
  remote has advanced since the last pull, the push will fail with a 422. Handle
  this gracefully — tell the user to Pull first.
- **SecureStore size limit**: iOS Keychain items have a practical limit of ~2 KB
  per key. The `git_settings` JSON is tiny — this is fine.
- **Expo FileSystem paths**: always use `repoDir(manifest.repo)` as the base.
  Never construct paths manually — use the helpers in `fs.ts`.
- **`session.tsx`** is the canonical source of `manifest` and `pat`. Import
  `useSession()` in the Git tab to get both rather than re-reading SecureStore.

---

## 10. Suggested Implementation Order

1. **Read `session.tsx` fully** — understand what `useSession()` exposes.
2. **Unify PAT** (§7a) — 5-line change, unblocks everything.
3. **`getModifiedFiles()`** (§7b) — pure function, easy to test mentally.
4. **Wire Push button** (§7c, push only) — end-to-end win.
5. **Wire Pull button** (§7c, pull) — `pullRepo()` already exists in `github.ts`.
6. **Real changes list** (§7c, step 2) — replace mock `GIT_STATUS` with live manifest.
7. **Git Settings UI** (§7d) — needed before the first real push from a fresh install.
8. **Draft with Claude** (§7c, step 6) — nice-to-have, build last.

---

## 11. Files to Read Before Writing Any Code

In this order:
1. `src/lib/session.tsx` — session state, PAT, manifest
2. `src/lib/gitClient.ts` — push / status implementation
3. `src/lib/github.ts` — pull, blob, issues
4. `src/lib/fs.ts` — filesystem helpers
5. `src/lib/types.ts` — Manifest, FileEntry, ChatMessage, etc.
6. `app/git.tsx` — current mock UI to be replaced
7. `src/lib/storage.ts` — SecureStore helpers

Do **not** rely on the auto-compacted session summary for file contents — always
re-read the files above with `read_file` at the start of a new session.
