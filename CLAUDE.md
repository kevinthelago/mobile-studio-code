# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This file is the authoritative project reference for the AI agent.
> Read it at the start of any new session before touching code.

---

## Commands

```bash
# Start dev server (use Expo Go or a dev build on device)
npx expo start

# Type-check (no tests exist — this is the primary correctness gate)
npx tsc --noEmit

# EAS builds (requires EAS CLI and login)
eas build --platform ios --profile development   # dev client build
eas build --platform ios --profile preview        # internal TestFlight
eas build --platform ios --profile production     # App Store

# OTA updates
eas update --branch preview   # push to preview channel
eas update --branch main      # push to production channel

# Tunnel crypto self-tests (Node, no device) — see src/lib/noise/README.md
npm run test:noise            # Noise round-trip + imposter-key rejection
npm run test:noise:interop    # replay noise-vectors.json, assert byte-equality with snow
npm run test:tunnel           # handshake + transport framing round-trip in-process
```

`tsc --noEmit` is the primary local correctness gate (run it before every PR). There is
no UI test suite; the `test:*` scripts above cover only the tunnel crypto/transport.

---

## What This App Is

**Mobile Studio Code (MSC)** is an AI-first mobile IDE for iOS, built with Expo / React Native.
It lets a developer work on a GitHub repository entirely from an iPhone — browsing files,
editing code, committing, and — most importantly — directing an embedded Claude AI agent
to do the heavy lifting.

MSC runs in two complementary modes:

- **Standalone** — the app works fully on its own. All git is done over the GitHub
  REST API (clone = tree + blobs, push = `PUT /contents`), and the embedded Claude
  agent (`agent.ts`) edits files locally in the Expo sandbox. No desktop required.
- **Tunneled** — the app can pair with a desktop running **base-studio-code** to
  mirror and drive that desktop's live Claude terminal sessions, and to surface the
  desktop's project-planning views (the **Plan** tab). The link is an
  **end-to-end-encrypted Noise IK tunnel relayed through a blind Cloudflare Worker**
  — *not* a direct WebSocket connection to a server on the desktop. Pairing is a
  QR scan; losing the tunnel degrades cleanly back to standalone. See
  `src/lib/noise/README.md` and the "Tunnel & multi-session" section below.

The guiding principle: **the AI should be able to do everything. The user should only have
to describe intent.**

---

## Ethos

### Simplicity above all
The user is on a phone. Small screen, no keyboard, no mouse, no terminal. Every feature
must justify its existence by being genuinely useful in that context. Complexity is the
enemy. If a workflow requires more than two taps from the user, ask whether the AI can
absorb that complexity instead.

### AI is the primary actor
The user sets direction. Claude executes. Browsing, editing, committing — all of it can
and should be driven through the chat interface. The manual tabs (Files, Find, Edit, Run,
Git, Plan) exist as power-user overrides, not the primary workflow. When the tunnel is
connected, the user may be steering *several* Claude sessions at once (on the desktop):
the SessionStrip chips and the session-switcher overlay make that multi-session model
glanceable, and a session "awaiting input" floats to the top.

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
| No native git | Pull and push are implemented as raw GitHub API calls (tree fetch + blob download / `PUT /contents`). No `git diff`, no merge tooling, no rebase. |
| New files can only be pushed if they already exist on remote (have a SHA) | A `write_file` on a brand-new path sets `sha: null` in the manifest; the push call uses `PUT /contents` without a SHA which creates the file. **However**, if the push tool reports `not_found` for a new file it means the manifest SHA sync failed — the only recovery is to ensure the file gets a valid remote SHA first. |
| No file system access outside Expo's sandbox | All repo files live under `expo-file-system`'s `documentDirectory`. Nothing persists outside the app sandbox. |
| iOS only (portrait) | Tablet and Android are not supported. Landscape is disabled. |
| No background execution | Agent runs, sync operations, and the tunnel socket must run while the app is in the foreground. Desktop-side "awaiting input" arrives as a push (FCM) so the user can return. |
| Expo managed workflow | No custom native modules without ejecting. All native capability comes from Expo SDK packages. |
| Tunnel is relayed, not direct | The desktop is usually not reachable on the LAN; the tunnel dials a Cloudflare Worker relay and runs Noise IK over it. The relay is a blind byte pipe — it never sees plaintext. There is no "connect to a server on the desktop" path. |

---

## Tunnel & multi-session (Noise relay)

The tunnel lets the phone observe and drive Claude sessions running on a paired
desktop (**base-studio-code**). It is **not** a desktop WebSocket server the phone
connects to directly — that older framing is obsolete.

- **Transport.** Mobile is the Noise **initiator** (`role=guest`); the desktop is the
  **responder** (`role=host`). Both dial a Cloudflare Worker relay
  (`wss://…/connect?room=<room>&role=…`); the relay's Durable Object forwards frames
  verbatim between the two peers and can read nothing. Crypto is
  `Noise_IK_25519_ChaChaPoly_BLAKE2s`. Full spec: `src/lib/noise/README.md`.
- **Pairing.** The desktop shows a QR (Settings → Mobile) carrying `{relayUrl, room,
  hostPubKey, psk}` (`TunnelPairing` in `types.ts`). The phone scans it (Run tab or
  Plan pairing), learns the desktop's static public key out-of-band, runs the
  handshake, and sends `auth { token: psk }` as the first in-session frame. The
  pairing is persisted (secure store) and auto-reconnects on launch.
- **Sessions.** Each desktop pane is mirrored as a `PaneState`. The Run tab is the
  session surface: a grid of panes (status, current task, last output) and a focused
  "terminal" view (live PTY output + input). The persistent SessionStrip + the
  session-switcher overlay let you jump between panes from any tab.
- **Plan.** The Plan tab mirrors the desktop's project-planning views (projects →
  board → issue → scoping) over the same tunnel, plus an offline pairing screen.
- **Disconnect vs. unpair.** Disconnect is transient (auto-reconnects next launch);
  unpair permanently forgets the desktop (clears only the two tunnel secrets) and
  returns to standalone with all local repo/keys/tasks intact.

State lives in `TunnelContext` (`src/lib/TunnelContext.tsx`), wrapping the
`TunnelClient` (`src/lib/tunnel.ts`) and the Noise session framing
(`src/lib/noiseSession.ts`).

---

## Folder Structure

```
/
├── app/                        # Expo Router file-based routing
│   ├── _layout.tsx             # Root layout: theme, session, nav guards, ambient Orbs background
│   ├── setup.tsx               # Onboarding: GitHub PAT + Anthropic API key entry
│   ├── repo.tsx                # Repo picker: search GitHub repos, clone (download) selected repo
│   └── (tabs)/                 # Main app — 6-tab bottom navigator (Files·Find·Edit·Run·Git·Plan)
│       ├── _layout.tsx         # Tab defs + custom BottomTabBar + SessionStrip overlay;
│       │                       #   gates render on JetBrains Mono font load. Opens on Run.
│       ├── index.tsx           # Files tab — collapsible folder tree, search, recents
│       ├── find.tsx            # Find tab — full-text search across repo files
│       ├── edit.tsx            # Edit tab — code viewer/editor + Claude chat dock (main chat)
│       ├── run.tsx             # Run tab — tunnel surface: QR pairing → session grid → terminal
│       ├── git.tsx             # Git tab — pull/push, changed files list, AI commit message draft
│       ├── plan.tsx            # Plan tab — thin host for src/screens/plan (tunneled planning)
│       ├── files.tsx           # Hidden route (href: null) — legacy/unused
│       └── settings.tsx        # Hidden route (href: null) — surfaced via SettingsScreen
│
├── src/
│   ├── lib/                    # Core logic (no UI)
│   │   ├── agent.ts            # Agent loop: tool definitions, tool runner, system prompt builder,
│   │   │                       #   retry logic (exponential backoff), iteration cap (25), checkpoint
│   │   │                       #   saves between iterations
│   │   ├── anthropic.ts        # Raw Anthropic API client: streaming chat, commit message drafting
│   │   ├── contextOptimizer.ts # Context window management: stale read eviction, history compaction
│   │   │                       #   (summarises old turns when history exceeds ~60k chars)
│   │   ├── errorBus.ts         # Global error event bus (lightweight pub/sub)
│   │   ├── fs.ts               # All file system access via expo-file-system: read, write, manifest
│   │   │                       #   I/O, task index I/O, pending checkpoint I/O
│   │   ├── gitClient.ts        # (Minimal) git utility helpers
│   │   ├── github.ts           # GitHub REST API: verify PAT, download repo (tree + blobs),
│   │   │                       #   pull (diff remote tree vs manifest), push modified files,
│   │   │                       #   fetch issues, post comments
│   │   ├── TunnelContext.tsx   # Tunnel state provider: connection state, panes, pairing,
│   │   │                       #   focus/input/resize, disconnect/unpair, FCM token
│   │   ├── tunnel.ts           # TunnelClient — relay dial + Noise handshake + pane protocol
│   │   ├── tunnelPairing.ts    # Parse/validate the QR pairing payload (TunnelPairing)
│   │   ├── noiseSession.ts     # Noise transport framing over the relay WebSocket
│   │   ├── noise/              # Pure-JS Noise IK (state machine, CSPRNG, interop vectors) — see README.md
│   │   ├── ansi.ts             # ANSI strip + last-N-lines helpers for PTY output
│   │   ├── color.ts            # hexAlpha() — rgba tint helper (approximates the design's color-mix)
│   │   ├── llm.ts              # Legacy LLM wrapper (predates agent.ts; used by ChatScreen)
│   │   ├── session.tsx         # SessionProvider + useSession hook — single source of truth for:
│   │   │                       #   auth state, manifest, open file, pull/push, task management,
│   │   │                       #   chat/agent lifecycle, retry + cancel signals
│   │   ├── storage.ts          # Secure key-value store (expo-secure-store) for PAT + API key
│   │   ├── syntax.ts           # Regex-based syntax highlighting token parser
│   │   ├── tasks.ts            # Task CRUD helpers: create, bootstrap, migrate legacy chat,
│   │   │                       #   patch index entries
│   │   └── types.ts            # All shared TypeScript types (ChatMessage, Manifest, Task,
│   │                           #   LinkedIssue, ToolDefinition, etc.)
│   │
│   ├── components/
│   │   ├── ui/                 # Shared UI primitives
│   │   │   ├── PageHeader.tsx      # Redesign github-style header (crumbs + title + meta + right)
│   │   │   ├── Card.tsx            # Bordered panel primitive (.msc-card)
│   │   │   ├── Tag.tsx             # Monospace pill (default/amber/green/info/warn)
│   │   │   ├── SectionLabel.tsx    # Uppercase section header (count + action/hint)
│   │   │   ├── Btn.tsx             # Text button (default/primary/ghost × md/sm)
│   │   │   ├── SessionStrip.tsx    # Persistent session chips + tunnel indicator + ▦ switcher
│   │   │   ├── SessionSwitcher.tsx # Session-switcher drawer overlay (panes grouped by project)
│   │   │   ├── BottomTabBar.tsx    # Custom 6-tab bar with Claude avatar shortcut to chat
│   │   │   ├── ClaudeAvatar.tsx    # Animated Claude "orb" avatar shown in tab bar + chat
│   │   │   ├── IconBtn.tsx         # Pressable icon button
│   │   │   ├── Icons.tsx           # SVG icon components
│   │   │   ├── IssueLinkSheet.tsx  # Bottom sheet for linking a GitHub issue to a task
│   │   │   ├── Orbs.tsx            # Ambient animated background blobs (theme-aware)
│   │   │   ├── Surface.tsx         # Glass/blur surface card primitive
│   │   │   ├── TaskSheet.tsx       # Bottom sheet for task management (create, switch, archive)
│   │   │   ├── ThemePicker.tsx     # Theme selection UI
│   │   │   ├── TokenText.tsx       # Syntax-highlighted text renderer (uses syntax.ts tokens)
│   │   │   └── TopPill.tsx         # Top status pill (branch name, modified count, etc.)
│   │   ├── CodeLine.tsx        # Single line of syntax-highlighted code
│   │   ├── CodeView.tsx        # Scrollable code viewer built from CodeLine rows
│   │   ├── IconBtn.tsx         # (duplicate root-level copy — prefer ui/ version)
│   │   ├── Surface.tsx         # (duplicate root-level copy — prefer ui/ version)
│   │   └── TabIcons.tsx        # Tab bar icon definitions
│   │
│   ├── screens/
│   │   ├── plan/               # Plan tab — PlanRoot navigator + 5 sub-screens (projects,
│   │   │                       #   board, issue, scoping, pairing) + planData/planShared/nav
│   │   ├── ChatScreen.tsx      # Legacy standalone chat screen (uses llm.ts, not agent.ts)
│   │   └── SettingsScreen.tsx  # Settings UI: theme picker, auth reset, repo clear
│   │
│   ├── data/                   # Static data / assets (contents not examined)
│   ├── theme.ts                # Theme definitions + redesign tokens; fontMono = JetBrains Mono
│   │                           #   (loaded via @expo-google-fonts/jetbrains-mono)
│   ├── theme/                  # Theme sub-module (index re-exports)
│   ├── ThemeContext.tsx         # Legacy ThemeContext (predates theme.ts; used by ChatScreen)
│   └── codeContent.ts          # Static code sample (used in onboarding/demo)
│
├── .github/
│   ├── ISSUE_TEMPLATE/         # GitHub issue templates
│   ├── pull_request_template.md
│   └── workflows/
│       ├── expo-preview.yml        # ✅ canonical name
│       ├── expo_preview.yml        # ⚠️  old underscore name — to be deleted
│       ├── issue-branch-check.yml  # ✅ canonical name
│       ├── issue_branch_check.yml  # ⚠️  old underscore name — to be deleted
│       └── .gitkeep
│
├── App.tsx                     # Expo entry point (delegates to app/_layout.tsx via router)
├── app.json                    # Expo config: name "Mobile Studio Code", bundle ID, plugins
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── babel.config.js             # Babel config
└── CLAUDE.md                   # This file
```

---

## Key Data Flows

### Session stages
`loading` → `setup` (no credentials) → `repo` (no repo selected) → `ready` (app usable)

Navigation is enforced by `StageGate` in `app/_layout.tsx`.

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
- **Push**: for each `modified=true` file in manifest → `PUT /repos/{repo}/contents/{path}`
  with the file's last-known SHA → update manifest SHA on success

### Task system
Each task has isolated `turns` (UI display) and `history` (Anthropic API messages).
Switching tasks gives the agent a completely fresh context window. Tasks persist to
`{repoDir}/.msc-tasks/{taskId}.json`; the index lives at `{repoDir}/.msc-task-index.json`.

### Tunnel pairing & session mirroring (Noise relay)
1. Desktop (base-studio-code) shows a pairing QR → phone scans it (Run tab / Plan pairing)
2. `TunnelContext.connect()` saves the pairing and dials the relay; `TunnelClient`
   runs the Noise IK handshake, then sends `auth { token: psk }`
3. Desktop streams `pane_list` / `session_state` / `pane_output` / `user_request`;
   `TunnelContext` projects these into `PaneState` and orders panes (awaiting-input first)
4. Run grid / SessionStrip / switcher render panes; focusing a pane sends `pane_focus`
   and streams live PTY output; the input bar sends `pane_input`
5. `user_request` (a session needs input) also arrives as an FCM push so the user can return
6. Connection drops → auto-reconnect from the saved pairing; unpair clears it → standalone

---

## Known Issues & Tech Debt

- **Duplicate components**: `IconBtn.tsx` and `Surface.tsx` exist at both
  `src/components/` and `src/components/ui/`. The `ui/` versions are current;
  the root-level copies are stale.
- **Legacy ChatScreen**: `src/screens/ChatScreen.tsx` uses the old `llm.ts` wrapper
  and `ThemeContext.tsx` instead of the current `theme.ts`. Not wired into the main
  tab navigation.
- **Legacy ThemeContext**: `src/ThemeContext.tsx` is a parallel theme system only used
  by `ChatScreen.tsx`. Everything else uses `src/theme.ts`.
- **Run tab is the tunnel surface** (no longer a placeholder): `app/(tabs)/run.tsx` is the
  QR-pairing → session-grid → terminal-mirror UI. There is still no *local* shell on iOS;
  the "terminal" mirrors a PTY running on the paired desktop over the Noise relay.
- **Plan data is a presentation layer**: the Plan tab's sub-screens render the design's
  fixtures (`src/screens/plan/planData.ts`) because the tunnel protocol carries only PTY
  panes today, not planning state. Connection gating and pairing are real; wire the
  fixtures to live tunnel state once the relay protocol gains a planning channel.
- **Workflow filename duplication**: Both `expo_preview.yml` / `expo-preview.yml` and
  `issue_branch_check.yml` / `issue-branch-check.yml` exist. The underscore versions
  should be removed; only the hyphenated versions are canonical.
- **New-file push limitation**: Files written by the agent that have never been on remote
  (`sha: null`) rely on the GitHub `PUT /contents` API creating them. If the manifest
  SHA state desyncs (e.g. after a failed push), recovery requires a pull first.
- **No delete-file tool**: The agent can write files but cannot delete them. Removing a
  file from a repo requires manual action (or a future `delete_file` tool).
- **No branch creation**: The app works on whatever branch was selected at clone time.
  Creating or switching branches is not possible from within the app.
- **No diff view**: The Git tab shows which files changed but not what changed within them.
