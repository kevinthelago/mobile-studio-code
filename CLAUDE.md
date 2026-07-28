# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This file is the authoritative project reference for the AI agent.
> Read it at the start of any new session before touching code.

---

## Commands

```bash
# Start dev server (use Expo Go or a dev build on device)
npx expo start

# The two correctness gates — run BOTH before pushing
npx tsc --noEmit          # or: npm run typecheck
npm test                  # tsx --test "src/**/*.test.ts"

# EAS builds (requires EAS CLI and login)
eas build --platform ios --profile development   # dev client build
eas build --platform ios --profile preview        # internal TestFlight
eas build --platform ios --profile production     # App Store

# OTA updates
eas update --branch preview   # push to preview channel
eas update --branch main      # push to production channel
```

**There is a real test suite — ~51 files, 500+ tests, run with `npm test`.** It is fast (a
couple of seconds) and RN-free: tests run under `tsx --test`, so a module a test imports must
not pull in `react-native`. That is why pure logic lives in `src/lib/**` and why, for example,
the stage-status colour map sits in `lib/planner/colors.ts` rather than in the component that
renders it — a `.tsx` cannot be imported from a `.ts` test.

CI (`.github/workflows/ci.yml`) runs four jobs on every PR: `install` → `typecheck` · `test` ·
`export`. The `test` job is the enforcement arm of the payload-parity harness (#246); without it
the contract fixtures were developer-local only.

---

## What This App Is

**Mobile Studio Code (MSC)** is an iOS companion to the **base-studio-code** desktop app, built
with Expo / React Native. It ships to the App Store as `base-studio-code` (see `app.json`).

It is primarily a **read-only mirror**. The desktop publishes its state over an encrypted Noise
tunnel as `store_state` frames; the phone renders them. Five tabs — **Glance · Planner · Skills ·
UI · Automations** — plus session chat, an alerts inbox, and a local project planner.

Three things it can actually *do*, as opposed to display:

1. **Session chat** — the one sanctioned mutation path into the desktop's panes.
2. **The local planner** (`app/(planner)/planner.tsx`) — fully local project planning that can
   sync to the desktop.
3. **A GitHub repo client** — `app/repo.tsx` plus `lib/github.ts` / `lib/agent.ts`, surviving from
   the app's origin as a standalone mobile IDE. Still wired, no longer the centre of gravity.

The guiding principle is unchanged: **the AI should be able to do everything. The user should only
have to describe intent.**

> **When the desktop is not paired, every mirror tab is empty.** `lib/mirror/demoData.ts` supplies
> representative demo projections so first run is exercisable (#250 — an App Store review
> requirement); real frames take over the moment a desktop connects.

---

## Ethos

### Simplicity above all
The user is on a phone. Small screen, no keyboard, no mouse, no terminal. Every feature
must justify its existence by being genuinely useful in that context. Complexity is the
enemy. If a workflow requires more than two taps from the user, ask whether the AI can
absorb that complexity instead.

### AI is the primary actor
The user sets direction. Claude executes. The mirror tabs show what the desktop is doing; when
the user wants something *done*, the path is chat — `app/(sessions)/chat.tsx` against an
addressable desktop session.

### Read-only until proven otherwise
The phone mirrors; it does not edit the desktop's state. Every new surface starts read-only. A
mutation needs a deliberate frame on the wire (`plan_confirm`, session input) — never a local
write that hopes to be reconciled later.

### Trust the agent loop
The repo-client agent (`lib/agent.ts`) has ten tools: `list_directory`, `read_file`, `grep_file`,
`write_file`, `push_changes`, `pull_changes`, `read_remote_file`, `resolve_conflict`,
`read_issue`, `comment_on_issue`. They are intentionally minimal. New capability should be added
as an agent tool before it is added as UI.

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

Only the load-bearing paths. When this disagrees with the tree, the tree wins — and fix this file.

```
/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx               # Root layout: theme, tunnel, mirror, live-plan, alerts providers
│   ├── repo.tsx                  # GitHub repo picker + PAT entry
│   ├── (tabs)/                   # The five-tab mirror shell; lands on Glance
│   │   ├── _layout.tsx           #   tab defs + custom BottomTabBar + AlertToast overlay
│   │   ├── index.tsx             #   Glance    — domain "glance"
│   │   ├── plan.tsx              #   Planner   — renders (planner)/planner embedded (NOT a mirror)
│   │   ├── skills.tsx            #   Skills    — domain "skills"
│   │   ├── ui.tsx                #   UI        — segmented: "components" + "themes"
│   │   └── automations.tsx       #   Automations — segmented: "automations" + "mcp"
│   ├── (sessions)/               # roster.tsx + chat.tsx — the ONE mutation path into the desktop
│   ├── (alerts)/inbox.tsx        # Notification inbox (domain "alerts", FCM deep links)
│   ├── (more)/                   # more · connection (pairing/QR) · providers · theme · security
│   ├── (planner)/planner.tsx     # Local project planner (PlannerContext + pipelines)
│   └── (sync)/sync.tsx           # Planner file-reconcile conflict editor (plan_sync_* path)
│
├── src/
│   ├── lib/
│   │   ├── tunnel.ts             # TunnelClient: Noise transport, frame decode, mutation senders
│   │   ├── TunnelContext.tsx     # Provider + useTunnel()
│   │   ├── tunnel/               # Transport internals — ALL pure + unit-tested
│   │   │   ├── noise.ts pairing.ts reconnect.ts input.ts paneSize.ts
│   │   │   ├── storeState.ts     #   store_state + store_state_chunk reassembly (rev-keyed)
│   │   │   ├── livePlan.ts       #   plan_state / plan_event reducer → the LIVE plan
│   │   │   ├── LivePlanContext.tsx
│   │   │   ├── *.fixtures.json   #   CONTRACT: byte-identical with base-studio-code
│   │   │   └── *.fixtures.test.ts#   the parity harness (frame + payload) — see below
│   │   ├── mirror/               # Mirrored state → view models
│   │   │   ├── MirrorContext.tsx #   useMirrorDomain(domain) → { data, rev, synced }
│   │   │   ├── payload.ts        #   selector contract: NEVER throw on missing/extra/mistyped
│   │   │   ├── state.ts demoData.ts feed.ts themeMap.ts
│   │   │   └── securityView.ts automationsView.ts mcpView.ts
│   │   ├── pages/                # Per-domain page selectors (pure, React-free)
│   │   │   ├── glancePage.ts skillsPage.ts designPage.ts orgPage.ts
│   │   │   └── blueprintsPage.ts plannerBoard.ts        ← currently ORPHANED (see Tech Debt)
│   │   ├── graph/                # Pure graph engine: layout, cycles, routing, org + glance adapters
│   │   ├── kit/                  # Design-system port: spec resolve, baseline JSON specs
│   │   ├── planner/              # Local planner: context, pipelines, publish, colors, sync
│   │   ├── sessions/             # roster, layout, input gating, nav
│   │   ├── alerts/               # AlertsContext, model, FCM routing, read state
│   │   ├── providers/            # Multi-provider LLM clients (anthropic, google, openai-compatible)
│   │   ├── agent.ts github.ts fs.ts tasks.ts session.tsx storage.ts   # the repo-client half
│   │   └── types.ts              # Wire types + STORE_DOMAINS
│   │
│   ├── components/
│   │   ├── shell/                # MirrorScaffold (domain → synced/awaiting/demo), headers
│   │   ├── glance/ skills/ design/ automations/ security/ sessions/   # one mirror per domain
│   │   ├── kit/                  # SpecHost / KitRenderer — renders baseline JSON specs
│   │   ├── graph/                # GraphCanvas (RN-SVG), drill-back
│   │   ├── planner/              # Local planner UI (several files here are ORPHANED)
│   │   └── ui/                   # Primitives: Surface, Tag, Btn, BottomTabBar, ThemePicker…
│   └── theme.ts                  # THEMES.dark / THEMES.light + useTheme()
│
├── .github/workflows/            # ci.yml (install·typecheck·test·export) · preview.yml · update.yml
├── app.json                      # Expo config — display name "base-studio-code"
└── CLAUDE.md                     # This file
```

---

## Key Data Flows

### Boot
`app/_layout.tsx` mounts the provider stack (theme → tunnel → mirror → live plan → alerts) and
holds a spinner only until secrets load. The app lands on **Glance**. There is no onboarding and
no launch gate: pairing happens on demand from **More → Connection**, repo selection from
`/repo`.

### The mirror path (how nearly every screen gets its data)
```
desktop  ──store_state {domain, rev, json}──▶  tunnel.ts
                                                  │  (over-cap domains arrive as
                                                  │   store_state_chunk and are reassembled
                                                  │   by tunnel/storeState.ts, keyed by rev)
                                                  ▼
                                        MirrorContext  ──useMirrorDomain(d)──▶  MirrorScaffold
                                                                                     │
                                                        lib/pages/*.ts selector  ◀────┘
                                                                                     │
                                                                     component renders the VM
```
`STORE_DOMAINS` (`lib/types.ts`) is the vocabulary: `glance`, `plan`, `org`, `blueprints`,
`skills`, `components`, `themes`, `automations`, `mcp`, `alerts`, `security`.

**Selectors must never throw** on a missing, extra, or mistyped field (`lib/mirror/payload.ts`).
A drifted payload must degrade to a blank section, never a crash, on a phone in the field.

### The live plan (a SEPARATE path — do not confuse it with the `plan` domain)
`plan_state` / `plan_event` **frames** → `tunnel/livePlan.ts` (pure reducer, keyed by projectId)
→ `LivePlanContext` → `BlueprintStageBar` / `(planner)/planner.tsx`. It uses its own status
vocabulary (`SectionRenderStatus`), not the `plan` domain's `StageStatus`. **The `plan` store
domain currently has no consumer at all.**

### Contract parity (the thing that keeps mobile and desktop honest)
Two fixture files are **byte-identical** with base-studio-code (verified by git blob hash), and
two test files decode them into our typed models and deep-equal back:

- `tunnelProtocol.fixtures.json` — FRAME shapes.
- `storePayloads.fixtures.json` — per-domain PAYLOAD shapes (#246). Generated desktop-side from
  the real builders. **Layer A** re-encodes only the fields we read (an unknown field fails the
  deep-equal; a missing required field throws by name). **Layer B** smoke-tests that the
  canonical payload yields a non-degenerate view — per field, never just "not empty" — because a
  tolerant selector renders a blank page rather than failing.

A domain is either in `DECODERS` (reconciled) or in `PENDING_DOMAINS` with its issue number.
**Moving a domain from `PENDING_DOMAINS` into `DECODERS` is the definition of done for its
issue.** Changing a fixture is a coordinated two-repo PR pair.

### Session chat (the one mutation path)
`(sessions)/roster.tsx` lists addressable desktop panes; `chat.tsx` streams one and sends input,
subject to the desktop's input grant (`tunnel/inputGrant`, `sessions/inputGate.ts`).

---

## Known Issues & Tech Debt

### Orphaned code — read this before starting any issue

**24 source files are unreachable from any `app/` route.** They compile, they have passing
tests, and nothing renders them. This is the single biggest trap in the repo: issues get written
against them and the work lands somewhere no user can see. It has already happened — see #236
and the plan half of #245, both invalidated by `54c13fb` (2026-07-25), which removed the Planner
tab's segment strip and orphaned every surface it mounted.

**Before implementing an issue, confirm its target is reachable:**

```bash
# does anything import it?
grep -rn "ComponentName" --include=*.tsx --include=*.ts src app
```

Currently orphaned:

| Area | Files |
|---|---|
| planner UI | `BlueprintsSection` `LivePlanBoard` `ChatTab` `PlanTab` `PlannerChrome` `PreviewTab` `atoms` |
| page selectors | `blueprintsPage.ts` `plannerBoard.ts` · `orgPage.ts` *(deliberate — built for #233's Teams segment)* |
| repo-client leftovers | `github/BranchGraph` `github/LanguageBar` `github/charts` `diff.ts` `githubCache.ts` `githubPulse.ts` `syntax.ts` |
| other | `fleet/CoordInboxCard` `fleet/WorkerCard` `ui/IssueLinkSheet` `ui/TaskSheet` `ui/TopPill` `planner/seed.ts` `screens/GraphDemoScreen.tsx` |

Test-only files (`tunnel/fixtureDecode.ts`, the `*.fixtures.json`, `graph/vitestShim.ts`) are
also unreachable from `app/` — that is correct and expected.

### Live traps

- **Tests must not import React Native.** `npm test` runs under `tsx --test`. Put logic that
  needs testing in `src/lib/**`, not in a `.tsx`.
- **`src/lib/pages/designPage.ts` is not plain ASCII** — `grep` reports it as a binary file. Use
  `grep -a`, or the Read tool.
- **Desktop `tech`/`hue` values are CSS** (`var(--accent)`, `oklch(...)`). React Native can parse
  neither. Never bind a mirrored colour string to a `color` prop without normalising it.
- **Sync against base-studio-code `develop`, not `main`.** `main` is far behind; every contract
  reference our code cites exists only on `develop`.
- **`plan` is exempt from the payload harness** (`UNPROJECTED_DOMAINS`) — it is published by the
  planner, not `useStoreProjector`.

### Platform limits (unchanged)

- **No delete-file tool** — the agent can write files but not remove them.
- **No branch creation** — the app works on whatever branch was selected at clone time.
- **New-file push** relies on `PUT /contents` creating the path; if the manifest SHA desyncs,
  recovery requires a pull first.
