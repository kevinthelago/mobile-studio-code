# Mobile Studio Code — Testing & Navigation Guide

A walkthrough for testing **Mobile Studio Code (MSC)**, the iOS app that lets you
work on a GitHub repository — and drive Claude — entirely from an iPhone, plus
pair with the **base-studio-code** desktop to monitor live Claude sessions.

> Platform: **iOS only, portrait**. There is no terminal/shell on device — all
> git operations go through the GitHub REST API. Distributed via **TestFlight**.

---

## 1. Prerequisites

Before you can do anything useful you need three things:

| Need | Why | Where to get it |
|---|---|---|
| **TestFlight build installed** | The app ships via TestFlight (not Expo Go — it has native Firebase/push modules) | TestFlight invite → install "Mobile Studio Code" |
| **GitHub Personal Access Token (PAT)** | All repo browse/commit/push goes through the GitHub API | github.com → Settings → Developer settings → PAT with **`repo`** scope |
| **Anthropic API key** | Powers the in-app Claude chat/agent and the planner | console.anthropic.com → API keys (starts with `sk-ant-`) |

To exercise the **tunnel / Sessions** features you also need **base-studio-code**
running on a desktop, showing its pairing QR code.

---

## 2. First-launch / onboarding flow

The app is **stage-gated** (`app/_layout.tsx`): it decides where to drop you
based on what's configured.

1. **Loading** — brief spinner while secrets, the repo manifest, and the task
   index load from device storage.
2. **Setup** (`app/setup.tsx`) — shown until both credentials are saved:
   - Enter the **GitHub PAT** → it's verified against the GitHub API on save.
   - Enter the **Anthropic API key** → verified on save.
   - **Continue** enables only once both verify. Keys are stored securely
     (`expo-secure-store`).
3. **Repo picker** (`app/repo.tsx`) — once credentials exist but no repo is
   loaded:
   - Enter `owner/repo` and an optional branch (defaults to `main`).
   - **Download repo** fetches the full file tree + manifest (progress shown).
   - Also hosts the **theme picker**, a **"Plan a project"** entry into the
     Planner, and **"Sign out and reset credentials."**
4. **Ready** — lands in the main tab navigator.

**Tester checklist:** invalid PAT/key are rejected on save; Continue stays
disabled until both verify; a successful repo download opens the Files tab.

---

## 3. The six bottom tabs

Defined in `app/(tabs)/_layout.tsx`. A persistent **SessionStrip**
(`src/components/ui/SessionStrip.tsx`) appears as a thin bar at the top of
**every** tab once a tunnel is connected — horizontally scrollable chips, one per
desktop session, color-coded by status; tapping a chip jumps to the Run tab
focused on that session.

### 3.1 Files (`index.tsx`)
Repo file browser. Header shows repo name + file/modified counts. Real-time
name **search**, a **Recents** section (open + modified files), and a
collapsible **folder tree**. Tap a file → opens it in **Edit**.

### 3.2 Find (`find.tsx`)
Full-text search across the repo. Scope filters (**All / Modified / by
extension**), case-sensitivity toggle (**Aa**), live "scanning X/Y" status.
Tap a match → opens that file in **Edit**.
*(Bounded for performance: scans up to ~400 files, ~200 matches.)*

### 3.3 Edit (`edit.tsx`) — the primary workspace
- **Top half:** the open file. Read-only **syntax-highlighted** view; tap the
  **pen** to switch to an editable plain-text mode. A dirty dot + **Save**
  appear when changed.
- **Bottom half:** the **Claude chat/agent** (Claude Sonnet 4.6). Type intent,
  optionally **attach an image** (📎), and Claude reads/edits files via tools.
  Tool calls and results render inline. History is **per task**.

### 3.4 Run (`run.tsx`) — "Sessions" / desktop tunnel
- **Not paired:** a **QR scanner** ("point at the QR in base-studio-code") with a
  manual URL + token fallback.
- **Paired:** a **grid of sessions** (panes) from the desktop — each card shows
  name, status dot (green=running, amber=awaiting input, red=error, grey=idle),
  current task, last activity, and an "input needed" badge.
- **Focused on a pane:** live **terminal** output streaming from the desktop; an
  amber banner + input bar appear when the pane is awaiting your input.

### 3.5 Git (`git.tsx`)
- **Branch header** (tap to open the branch switcher).
- **Pull** (↓) / **Push** (↑, enabled only when files are modified) / **Switch**
  (→ repo picker).
- **Modified files** list with M/A badges (tap → Edit).
- **Commit**: message box + **Draft with Claude** (AI-writes the message from the
  diff + linked issue), and a **Commit · N** button. If the active task links a
  GitHub issue, you can tag the commit **Refs #** / **Fixes #**.

### 3.6 Pulse (`github.tsx`)
A GitHub **repo analytics dashboard** for the active repo — commit velocity
charts, a branch graph, language breakdown, and stat rings. Handles
**auth-error / rate-limit / offline** states with pull-to-refresh.

---

## 4. Secondary surfaces (beyond the tabs)

### Planner (`app/(planner)/planner.tsx`)
A full-screen **project-planning** flow launched from the repo picker's
**"Plan a project."** Pick a **blueprint**, edit its sections, **chat** to flesh
out the plan, see a **Grade** (readiness) and **Preview**, then **Publish** —
which can hand the plan off to the desktop over the tunnel. Requires the
Anthropic key.

### Fleet (`app/(fleet)/fleet.tsx`)
A **fleet view** of the connected desktop's Claude workers — one card per
session with status and coordination inbox. Populated from the tunnel; some
fields stay blank until the desktop emits the corresponding data stream.

### Automations (`app/(automations)/automations.tsx`) — ⚠️ stub
Intended to show **schedules** and **hook analytics** from the desktop. Currently
a **placeholder**: it renders empty and prompts you to "connect to
base-studio-code on the Sessions tab." No live data yet (pending desktop-side
frames). Testers should expect this screen to be empty.

---

## 5. End-to-end test flows

**A. Clone & browse**
Setup → save PAT + key → repo picker → `owner/repo` → Download → Files tab →
expand folders, search, open a file.

**B. Edit + Claude**
Files → tap a file → Edit → pen to edit → Save when dirty. In chat, ask Claude
to make a change; watch it read/edit via tools and reply.

**C. Commit & push**
Git tab → review modified files → **Draft with Claude** (or type a message) →
**Commit · N** → optionally **Pull** first. Verify the commit lands on GitHub.

**D. Pair with desktop & monitor sessions**
Desktop: show pairing QR. App: Run tab → scan QR (or manual URL+token) → sessions
grid appears → tap a session → watch live output → answer input prompts via the
amber banner. The SessionStrip now shows chips on every tab.

**E. Notifications** *(needs the desktop sending pushes + APNs key in Firebase)*
When a desktop session needs input, you get a push. **Foreground:** a banner
appears. **Background/quit:** the OS banner; tapping it deep-links to the Run tab
focused on that session.

**F. Plan a project**
Repo picker → "Plan a project" → pick a blueprint → chat to refine → check
Grade/Preview → Publish (optionally hand off to the connected desktop).

**G. Repo / branch switching & reset**
Git → branch header to switch branches (dirty-tree warning), or **Switch** for a
different repo. Repo picker → **Sign out and reset credentials** clears
everything back to Setup.

---

## 6. Known limitations & "expected" gaps

- **iOS only, portrait.** No Android, no landscape.
- **No on-device shell.** "Run" is a *remote* session monitor via the tunnel, not
  a local terminal.
- **Automations screen is a stub** — empty until desktop frames land.
- **Fleet** cards are partially populated pending desktop data streams.
- **New files** can only be pushed via the GitHub create-content API; there is no
  delete-file capability in-app yet.
- **No in-app diff view** — the Git tab lists *which* files changed, not the
  line-level diff.
- **Notifications require setup on both ends**: the APNs auth key uploaded to
  Firebase, and base-studio-code actually sending the push.

---

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Stuck on Setup | A key failed verification — re-enter; PAT needs `repo` scope, key starts with `sk-ant-` |
| Repo won't download | PAT lacks access to that repo, or wrong `owner/repo`/branch |
| Push disabled | No modified files, or you're not authenticated |
| Pulse shows rate-limit/auth error | GitHub API rate limit or PAT scope — wait for reset / re-check token |
| QR pairing fails | base-studio-code not reachable on the network, or stale token — rescan |
| No push notification | APNs key not in Firebase, permission denied, or desktop didn't send one |
| Sessions tab empty after pairing | Desktop has no active panes, or the tunnel dropped — reconnect |
