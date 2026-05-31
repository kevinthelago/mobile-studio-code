# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This file is the authoritative project reference for the AI agent.
> Read it at the start of any new session before touching code.

---

## Commands

```bash
# Start dev server (use Expo Go or a dev build on device)
npx expo start

# Type-check (the first correctness gate)
npx tsc --noEmit

# Unit tests (jest-expo) — covers the standalone agent + push logic
npm test

# Noise/tunnel transport self-tests (pure node, no device needed)
npm run test:noise && npm run test:noise:interop \
  && npm run test:noise:vectors && npm run test:tunnel

# EAS builds (requires EAS CLI and login)
eas build --platform ios --profile development   # dev client build
eas build --platform ios --profile preview        # internal TestFlight
eas build --platform ios --profile production     # App Store

# OTA updates
eas update --branch preview   # push to preview channel
eas update --branch main      # push to production channel
```

Local correctness gate: `tsc --noEmit`, then `npm test` (jest-expo unit tests),
then the Noise/tunnel self-tests above. There is no device-level E2E harness;
the standalone release scenario (clone → agent edit → commit → verify on GitHub)
is run manually — see [`docs/standalone-e2e.md`](docs/standalone-e2e.md).

---

## What This App Is

**Mobile Studio Code (MSC)** is an AI-first mobile IDE for iOS, built with Expo / React Native.
It lets a developer work on a GitHub repository entirely from an iPhone — browsing files,
editing code, committing, and — most importantly — directing an embedded Claude AI agent
to do the heavy lifting.

The guiding principle: **the AI should be able to do everything. The user should only have
to describe intent.**

---

## Architecture: standalone-first, optional tunnel

> **MSC is a fully standalone IDE.** This is the primary mode and it must always
> work on its own. Every feature on the standalone path talks directly to two
> services and nothing else:
>
> - **GitHub** — over the REST API (clone, pull, push, issues) using the user's PAT.
> - **Anthropic Claude** — over the Anthropic API using the user's API key.
>
> A phone with those two credentials is a complete IDE: clone a repo, let the
> agent edit it, commit, and verify the change on GitHub. **No desktop, server,
> or companion process is ever required for the core workflow.** When changing
> the standalone core (`agent.ts`, `github.ts`, `session.tsx`, the tabs), the bar
> is that the app still works end-to-end with the tunnel disabled and no desktop
> present — that is the release gate (see [`docs/standalone-e2e.md`](docs/standalone-e2e.md)).

The **desktop tunnel** is an **optional, additive** capability layered on top, not
a dependency:

- It lets the phone pair with and mirror a desktop Studio Code session (the **Run**
  tab and the desktop-backed **Plan** surface). Pairing is QR/scan-based and the
  transport is an end-to-end-encrypted Noise IK channel (`src/lib/tunnel.ts`,
  `noiseSession.ts`, `noise/`, `tunnelPairing.ts`, `TunnelContext.tsx`).
- It **degrades gracefully**: if no desktop is paired, the network is down, or
  pairing fails, the app stays fully usable in standalone mode. Tunnel-dependent
  surfaces (Run, Plan) show an "offline / pair to enable" empty state rather than
  blocking anything. Push notifications (FCM) are likewise auxiliary and fail open.
- Tunnel code is isolated behind `TunnelContext`/`useTunnel()`; the standalone
  path never imports it. Never make a standalone feature depend on the tunnel.

---

## Ethos

### Simplicity above all
The user is on a phone. Small screen, no keyboard, no mouse, no terminal. Every feature
must justify its existence by being genuinely useful in that context. Complexity is the
enemy. If a workflow requires more than two taps from the user, ask whether the AI can
absorb that complexity instead.

### AI is the primary actor
The user sets direction. Claude executes. Browsing, editing, committing — all of it can
and should be driven through the chat interface. The manual tabs (Files, Edit, Git) exist
as power-user overrides, not the primary workflow.

### Trust the agent loop
The agent has tools: `list_directory`, `read_file`, `write_file`, `read_issue`,
`comment_on_issue`. These are intentionally minimal. New capability should be added as
agent tools before it is added as UI.

### Invisible complexity
Context optimisation, retry logic, session checkpointing, conflict resolution — none of
this should surface to the user unless something genuinely requires their attention.
Errors should be actionable, not technical.

---

## Platform Constraints

> These are hard limitations of working on iPhone only. Every engineering decision must
> account for them.

| Constraint | Impact |
|---|---|
| No terminal / shell access | Cannot run `git`, `npm`, `node`, or any CLI tool. All git ops go through the GitHub REST API. |
| No native git | Pull and push are implemented as raw GitHub API calls. Push uses the Git Data API (blobs → tree → commit → ref) to land all changed files in one atomic commit; pull fetches the remote tree and downloads changed blobs. No `git diff`, no merge tooling, no rebase. |
| New files carry `sha: null` until first push | A `write_file` on a brand-new path records `sha: null` in the manifest. The atomic push creates the file as part of the new tree (no per-file SHA needed) and stamps the manifest with the blob SHA GitHub returns. A `sha: null` file whose path *already* exists on the remote is reported as a `sha_mismatch` (pull first); a `404` from the Git Data API is a token/branch/repo problem, not a missing-file one. |
| No file system access outside Expo's sandbox | All repo files live under `expo-file-system`'s `documentDirectory`. Nothing persists outside the app sandbox. |
| iOS only (portrait) | Tablet and Android are not supported. Landscape is disabled. |
| No background execution | Agent runs and sync operations must complete while the app is in the foreground. |
| Expo managed workflow | No custom native modules without ejecting. All native capability comes from Expo SDK packages. |

---

## Folder Structure

Entry point is `expo-router/entry` (see `package.json` `main`); there is no
`App.tsx`. The app lands directly in the tabs — there is **no onboarding gate**.
Credentials are requested just-in-time: the agent/push paths prompt for the
Anthropic key (`ApiKeyContext`) or GitHub PAT when first needed.

```
/
├── app/                        # Expo Router file-based routing
│   ├── _layout.tsx             # Root layout: Theme/Session/ApiKey/Tunnel providers,
│   │                           #   ambient Orbs + frosted backdrop, FCM bootstrap, StageGate
│   ├── repo.tsx                # Repo picker (modal): search GitHub repos, clone (download) one
│   ├── settings.tsx            # Settings (modal): theme, credentials reset, repo clear, tunnel
│   └── (tabs)/                 # Main app — bottom tab navigator (6 tabs)
│       ├── _layout.tsx         # Tab definitions + custom BottomTabBar
│       ├── index.tsx           # Files tab — collapsible folder tree, filter, recents
│       ├── find.tsx            # Find tab — full-text search across repo files
│       ├── edit.tsx            # Edit tab — code viewer/editor + the Claude chat dock
│       ├── git.tsx             # Git tab — pull/push, changed files, AI commit message draft
│       ├── run.tsx             # Run tab — tunnel/sessions UI (pairing + pane grid + terminal).
│       │                       #   TUNNEL-OWNED; requires a paired desktop, else an empty state
│       └── plan.tsx            # Plan tab — desktop-tunneled planning surface (empty state offline)
│
├── src/
│   ├── lib/                    # Core logic (no UI)
│   │   │  # ── Standalone core (works with no desktop) ──
│   │   ├── agent.ts            # Agent loop: tool defs, runTool(), system prompt builder,
│   │   │                       #   retry (exponential backoff), iteration cap (25), checkpoints
│   │   ├── anthropic.ts        # Raw Anthropic API client: streaming chat, commit message drafting
│   │   ├── contextOptimizer.ts # Context window mgmt: stale read eviction, history compaction
│   │   ├── github.ts           # GitHub REST API: verify PAT, download repo, pull, atomic push
│   │   │                       #   (Git Data API), issues + comments
│   │   ├── session.tsx         # SessionProvider + useSession — source of truth for manifest,
│   │   │                       #   open file, pull/push, tasks, chat/agent lifecycle
│   │   ├── fs.ts               # expo-file-system access: read/write, manifest + task I/O, checkpoints
│   │   ├── tasks.ts            # Task CRUD helpers (create, bootstrap, patch index)
│   │   ├── storage.ts          # Secure key-value store (expo-secure-store) for PAT + API key
│   │   ├── ApiKeyContext.tsx   # Just-in-time Anthropic API key prompt provider
│   │   ├── errorBus.ts         # Global error event bus (lightweight pub/sub)
│   │   ├── syntax.ts / ansi.ts / color.ts  # Highlighting tokens, ANSI parsing, color helpers
│   │   ├── types.ts            # All shared TypeScript types
│   │   │  # ── Tunnel (OPTIONAL, additive — not part of standalone) ──
│   │   ├── TunnelContext.tsx   # useTunnel(): pairing/session state; gates Run + Plan surfaces
│   │   ├── tunnel.ts           # Relay-aware tunnel client
│   │   ├── tunnelPairing.ts    # Scan-to-pair handshake
│   │   ├── noiseSession.ts     # Noise IK session wrapper
│   │   ├── noise/              # Pure-JS Noise IK protocol implementation
│   │   └── fcm.ts              # Firebase Cloud Messaging (auxiliary push alerts; fails open)
│   │
│   ├── components/
│   │   ├── ui/                 # Shared UI primitives (the canonical set)
│   │   │   ├── PageHeader.tsx / Card.tsx / Tag.tsx / SectionLabel.tsx / Btn.tsx  # redesign chrome
│   │   │   ├── BottomTabBar.tsx     # Custom tab bar with Claude avatar shortcut to chat
│   │   │   ├── ClaudeAvatar.tsx     # Animated Claude "orb" avatar
│   │   │   ├── IconBtn.tsx / Surface.tsx / TopPill.tsx  # legacy primitives still in use
│   │   │   ├── Orbs.tsx             # Ambient animated background blobs (theme-aware)
│   │   │   ├── SessionStrip.tsx     # Multi-session chips (tunnel)
│   │   │   ├── ApiKeyModal.tsx      # API key entry modal (used by ApiKeyContext)
│   │   │   ├── IssueLinkSheet.tsx   # Bottom sheet for linking a GitHub issue to a task
│   │   │   ├── TaskSheet.tsx        # Bottom sheet for task management
│   │   │   └── ThemePicker.tsx      # Theme selection UI
│   │   └── TabIcons.tsx        # Tab bar icon definitions
│   │
│   └── theme.ts                # Theme definitions + ThemeProvider/useTheme (5 themes)
│
├── scripts/                    # Pure-node self-tests (run via npm run test:noise* / test:tunnel)
├── docs/                       # Architecture/handoff docs (standalone-e2e, redesign-status, …)
├── design/                     # Redesign source (HTML/JSX mockups + CSS tokens)
├── plugins/                    # Expo config plugins (e.g. Firebase Podfile)
│
├── .github/
│   ├── ISSUE_TEMPLATE/         # GitHub issue templates
│   ├── pull_request_template.md
│   └── workflows/              # ci.yml, expo-preview.yml, preview.yml, update.yml
│
├── src/lib/__tests__/          # jest-expo unit tests (agent write_file, github push)
├── jest.config.js              # Jest config (jest-expo preset, node environment)
├── app.json                    # Expo config: name "Mobile Studio Code", bundle ID, plugins
├── eas.json                    # EAS build/update profiles
├── package.json / tsconfig.json / babel.config.js / metro.config.js
└── CLAUDE.md                   # This file
```

---

## Key Data Flows

### Startup & credentials
There is no onboarding gate. `StageGate` in `app/_layout.tsx` only waits out the
`loading` stage (restoring persisted state), then lands in `/(tabs)`; `repo` and
`settings` are reachable modals. Credentials are requested **just-in-time** — the
agent path prompts for the Anthropic key via `ApiKeyContext`, and GitHub calls
require a stored PAT (entered from the repo/settings screens). This keeps the
standalone path usable as soon as the two keys exist, with no desktop involved.

### Agent loop (per message send)
1. User sends message via chat UI in `edit.tsx` (the main chat interface)
2. `session.tsx` → `runAgent()` in `agent.ts`
3. Agent calls Anthropic API (`anthropic.ts`), receives tool calls
4. `runTool()` executes each tool (read/write file, list dir, read/comment issue)
5. Results fed back; loop continues until `end_turn` or iteration cap (25)
6. Context optimiser trims stale reads + compacts old history as needed
7. Checkpoint saved to disk between iterations (survives app backgrounding)

### Pull / Push (GitHub API — no native git)
- **Pull**: fetch remote tree → compare SHAs vs manifest → download changed blobs →
  skip locally-modified files (surface as conflicts)
- **Push** (`pushModifiedFiles` in `github.ts`): collect `modified=true` files →
  read ref → commit → tree for a pre-flight conflict check (local parent SHA vs
  remote; a `sha: null` file conflicts iff its path already exists remotely) →
  upload each file as a blob → build a new tree off the base → create a commit →
  fast-forward the branch ref. All changed files land in **one atomic commit**;
  on success the manifest is stamped with each new blob SHA. New files need no
  per-file SHA bookkeeping. Failures are typed (`sha_mismatch`, `branch_protected`,
  `not_found`, `auth`, `other`) so callers can route the right recovery.

### Task system
Each task has isolated `turns` (UI display) and `history` (Anthropic API messages).
Switching tasks gives the agent a completely fresh context window. Tasks persist to
`{repoDir}/.msc-tasks/{taskId}.json`; the index lives at `{repoDir}/.msc-tasks.json`.

---

## Development Workflow

This repo follows the **base-studio-code** conventions:

- Every change maps to a GitHub Issue, and each issue maps to exactly one branch.
- **Branch naming**: `{issue-number}-{short-description}` — e.g. `14-sha-null-push-test`,
  `12-document-standalone-architecture`. (This matches base-studio-code; it is **not**
  the older `issue-{n}/slug` form.)
- Branch from `develop`; open the PR against `develop` with `Closes #N`. Only `develop`
  merges to `main`. Keep branches focused on the single issue's minimum change.
- Local gate before pushing: `tsc --noEmit` → `npm test` → the Noise/tunnel self-tests.

---

## Known Issues & Tech Debt

- **No delete-file tool**: The agent can write files but cannot delete them. Removing a
  file from a repo requires manual action (or a future `delete_file` tool).
- **No branch creation**: The app works on whatever branch was selected at clone time.
  Creating or switching branches is not possible from within the app.
- **No diff view**: The Git tab shows which files changed but not what changed within them.
- **Run tab requires a paired desktop**: `app/(tabs)/run.tsx` is the tunnel/sessions UI
  (pairing + pane grid + terminal). It is optional — with no desktop paired it shows an
  empty state and the rest of the app stays fully usable. There is no on-device code
  execution (no shell on iOS) and there never will be.
- **Plan tab is desktop-tunneled**: the `Plan` surface depends on the tunnel exposing
  planning state; offline it shows a "pair to enable" empty state. The sub-screens
  (projects → board → issue → scoping → pairing) are not all built yet.

> **Resolved (do not re-report).** Earlier drafts of this file listed tech debt
> that has since been cleared: the duplicate root-level `IconBtn`/`Surface`
> (only `src/components/ui/` remains), the legacy `ChatScreen` / `ThemeContext` /
> `llm.ts` (deleted; theming is `src/theme.ts`, the agent is `agent.ts`), and the
> underscore-named duplicate workflow files. The push path no longer uses
> `PUT /contents` — it's the atomic Git Data API flow described above.
