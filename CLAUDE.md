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
```

There are no automated tests. `tsc --noEmit` is the only local correctness check.

---

## What This App Is

**Mobile Studio Code (MSC)** is an AI-first mobile IDE for iOS, built with Expo / React Native.
It lets a developer work on a GitHub repository entirely from an iPhone — browsing files,
editing code, committing, and — most importantly — directing an embedded Claude AI agent
to do the heavy lifting.

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
| No native git | Pull and push are implemented as raw GitHub API calls (tree fetch + blob download / `PUT /contents`). No `git diff`, no merge tooling, no rebase. |
| New files can only be pushed if they already exist on remote (have a SHA) | A `write_file` on a brand-new path sets `sha: null` in the manifest; the push call uses `PUT /contents` without a SHA which creates the file. **However**, if the push tool reports `not_found` for a new file it means the manifest SHA sync failed — the only recovery is to ensure the file gets a valid remote SHA first. |
| No file system access outside Expo's sandbox | All repo files live under `expo-file-system`'s `documentDirectory`. Nothing persists outside the app sandbox. |
| iOS only (portrait) | Tablet and Android are not supported. Landscape is disabled. |
| No background execution | Agent runs and sync operations must complete while the app is in the foreground. |
| Expo managed workflow | No custom native modules without ejecting. All native capability comes from Expo SDK packages. |

---

## Folder Structure

```
/
├── app/                        # Expo Router file-based routing
│   ├── _layout.tsx             # Root layout: theme, session, nav guards, ambient Orbs background
│   ├── repo.tsx                # Repo picker: search GitHub repos, clone (download) selected repo
│   └── (tabs)/                 # Main app — bottom tab navigator
│       ├── _layout.tsx         # Tab definitions + custom BottomTabBar
│       ├── index.tsx           # Files tab — collapsible folder tree, search, recents
│       ├── find.tsx            # Find tab — full-text search across repo files
│       ├── edit.tsx            # Edit tab — code viewer/editor for the currently open file
│       ├── run.tsx             # Run tab — placeholder (no terminal; reserved for future use)
│       ├── git.tsx             # Git tab — pull/push, changed files list, AI commit message draft
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
│   │   │   ├── BottomTabBar.tsx    # Custom tab bar with Claude avatar shortcut to chat
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
│   │   ├── ChatScreen.tsx      # Legacy standalone chat screen (uses llm.ts, not agent.ts)
│   │   └── SettingsScreen.tsx  # Settings UI: theme picker, auth reset, repo clear
│   │
│   ├── data/                   # Static data / assets (contents not examined)
│   ├── theme.ts                # Theme definitions (dark/light palettes, code colours, glass flag)
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
`loading` → `ready` (app usable)

`StageGate` in `app/_layout.tsx` only holds a spinner until secrets + any saved
manifest load; it does not gate navigation. The app boots into the tabs and
lands on the **Run** tab (`unstable_settings.initialRouteName` in
`app/(tabs)/_layout.tsx`). Repo selection is **not** a launch gate — the user
opens the repo picker (`/repo`) on demand from the **Git** tab (its "Switch"
action, or the "Pick a repo" button in the no-repo empty state). The repo
picker also hosts GitHub PAT entry and a "Plan a project" entry into the
planner (`/(planner)/planner`). There is no onboarding screen — credentials
are persisted via `storage.ts` and surfaced errors if missing.

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
- **Run tab is a placeholder**: `app/(tabs)/run.tsx` exists in the tab bar but there is
  no terminal or code execution capability (and cannot be — no shell on iOS).
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
