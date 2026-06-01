# MSC redesign — implementation status

The source design lives in `design/msc-redesign/` (HTML preview + JSX mockups +
CSS tokens). The redesign isn't a UI refresh — it's a product alignment around:

- A **6-tab nav** with a new **Plan** tab (vs. today's 5)
- A **multi-session model** surfaced via `SessionStrip` chips + the existing
  `TunnelContext` infrastructure
- **Per-screen restructures** matching the github-style chrome (breadcrumb
  header + meta line + scrollable body)
- **Plan** as a desktop-tunneled surface (5 sub-screens: projects → board →
  issue → scoping → pairing)

The redesign's design tokens explicitly "marry the dawn palette" — `dawn` in
`src/theme.ts` already matches at the base. This document tracks how much of the
design has landed.

## Landed (this branch — `feature/msc-redesign`)

### Foundation
- [x] Design source files tracked in `design/msc-redesign/`
- [x] **Theme tokens extended** — `Theme` gains `elev`, `elev2`, `borderStrong`,
      `accentDim`, `success`, `info`, `warn`, `danger`, `pink`. All 5 themes
      (`glass`, `dawn`, `terminal`, `paper`, `basic`) get coherent values.
      `dawn`'s tokens exactly mirror `design/msc-redesign/.../styles.css :root`.
- [x] **Plan tab registered** — `app/(tabs)/_layout.tsx`, `BottomTabBar`
      icon/label maps, new `PlanIcon` in `TabIcons.tsx`
- [x] **Plan placeholder screen** — `app/(tabs)/plan.tsx`. Two states keyed on
      `useTunnel()`: a "tunnel offline → pair via Run tab" empty state, and a
      "coming soon" state when connected. Themed via the new tokens.
- [x] `tsc --noEmit` green
- [x] **Visual primitives** under `src/components/ui/` (next section). Pure
      additive — no screen has been migrated to use them yet, so the existing
      `Surface`/`IconBtn` continue to be the only primitives in active use until
      the per-screen migrations land.

## Not yet landed (sequence)

### Visual primitives — `src/components/ui/*` ✅
- [x] `PageHeader` — crumbs + title + meta + right slot (replaces ad-hoc headers
      across screens)
- [x] `Card` — bordered panel using `theme.surface` / `theme.borderColor`
- [x] `Tag` — pill with `default | amber | green | info | warn` variants. The
      design's `color-mix(in oklch, ...)` tints are approximated with a small
      `hexAlpha()` helper that emits `rgba()` at the same 12% / 30% alpha steps.
- [x] `SectionLabel` — uppercase letter-spaced section header with `count` +
      optional `action` (pressable when `onActionPress` is supplied)
- [x] `Btn` — `default | primary | ghost` variants × `md | sm` sizes. Existing
      `IconBtn` is kept distinct for icon-only round buttons.

### Screen migrations (one PR each, target `develop`)
- [x] **Files** (`app/(tabs)/index.tsx`) — migrated to `PageHeader` +
      `SectionLabel` + `Card`. Breadcrumb header (repo › branch), `Filter files…`
      input, horizontal Recents cards, and a mono tree with folder ▾/▸ glyphs,
      current-row accent tint + left border, and modified dots. All real wiring
      (`useSession`, `buildTree`, `openFile`, recents) preserved. Added a `hint`
      prop to `SectionLabel` for the dim "tap folder to expand" helper text
      (distinct from the accent `action` affordance). Behavior note: Recents now
      hide while a filter is active (was always shown).
- [x] **Find** (`app/(tabs)/find.tsx`) — migrated to `PageHeader` + `Tag` +
      `Card`. Breadcrumb header (repo › branch › search) with the query as title
      and a `N matches · M files` meta. Search input in the `msc-input` style;
      scope chips + the case-sensitive toggle rendered as `Tag`s (amber when
      active) with an `in: <scope>` info tag; per-file groups with a mono header
      (name · count · `open ›`) and one `Card` per match line with line number +
      accent-highlighted match. All real grep wiring preserved (`grepInText`,
      scope/ext filtering, debounced scan, caps, `openFile` navigation).
      Extracted `hexAlpha` to `src/lib/color.ts` (now shared by `Tag`, Files,
      and Find).
- [x] **Edit** (`app/(tabs)/edit.tsx`) — migrated to `PageHeader` + `Tag` +
      `Card`. Breadcrumb header (dirs › filename) with a `lang · ● modified`
      meta and the save / edit-mode toggle in the right slot. The chat is now a
      bottom **dock** under the code viewport: a status header (dot + `Claude ·
      idle/working` + `N tools used` tag), a capped scroll of recent turns
      (Claude replies get an accent ◉ marker, tool calls render as `→ name(args)
      … ✓/✗` Cards), the image-preview strip, and the `›`-prefixed input bar.
      All real wiring preserved (`send`, `turns`, `chatBusy`, `saveCurrentFile`,
      `setCurrentContent`, image attach/remove, tokenized + plain editors).
      Dropped the `Surface`/`TopPill`/`ClaudeAvatar`-based chrome.
- [x] **Run** (`app/(tabs)/run.tsx`) — PaneGrid aligned to the redesign chrome:
      `PageHeader` (base-studio-code › tunnel · "N active · M awaiting input" ·
      disconnect), an all/running/awaiting/idle `Tag` count row, and `Card`
      session rows with a status dot, project `Tag`, and a 2-line preview box
      (warn-tinted + thicker left border when awaiting input). Status colors now
      resolve from theme tokens (shared with the terminal header). Unpair kept as
      a danger affordance. All tunnel wiring unchanged.
- [x] **Git** (`app/(tabs)/git.tsx`) — migrated to `PageHeader` + `SectionLabel`
      + `Card` + `Tag` + `Btn`. Breadcrumb header (repo › branch) + branch title
      + `N changed`/`clean` meta + push `Btn` in the right slot; pull / switch-repo
      ghost `Btn`s; a `Changes` section of M/A `Card` rows (tap → open in Edit);
      a `Commit message` section whose `action` slot drives draft/regenerate
      (the old "Draft with Claude"); linked-issue ref modes (refs/fixes/none) as
      `Tag`s; commit `Btn`. All real wiring preserved (`pull`/`push`/`pulling`/
      `pushing`, `anthropicDraftCommitMessage`, issue-ref composition, conflict
      reporting). **Omitted** the design's per-file `+adds/-dels` and `stage all`
      — this app tracks neither line diffs nor a staging area (see CLAUDE.md
      known issues), so they'd be fake controls.

### Plan sub-screens ✅
All five live under `src/screens/plan/`, hosted by `app/(tabs)/plan.tsx` via
`PlanRoot` — a small in-tab stack navigator gated on `useTunnel()`. The tunnel
protocol does not yet carry planning state (it only streams PTY panes — see
`src/lib/types.ts`), so the data-bearing screens render a faithful,
ready-to-wire presentation layer seeded with the design's fixtures
(`planData.ts`). Connection gating and pairing are real.
- [x] `PlanProjects` — project list, on-host vs. other-host grouping, filter,
      "plan a new project" CTA, drafting → scoping / active → board navigation
- [x] `PlanBoard` — horizontal column pager + In-progress card list (→ issue)
- [x] `PlanIssue` — labels/assignees, description, Claude subtask breakdown,
      activity feed, comment composer (KeyboardAvoidingView)
- [x] `PlanScoping` — @planner chat (markdown-lite bold), live progress strip,
      draft-milestone preview, publish/save actions, answer composer
- [x] `PlanPairing` — tunnel-offline state wired to `useTunnel().connect`
      (paste pairing code) + routes to Run for the QR scanner (single camera impl)
- Shared primitives in `planShared.tsx` (PersonAvatar, AvatarStack, LabelChip,
      ProgressBar, ClaudeBadge, StatusDot); design oklch hues approximated as hex.
      Added an optional `style` prop to `Btn` for flex layout in composers.

### SessionStrip + session-switcher overlay ✅
- [x] SessionStrip restyled to redesign chips — theme tokens, accent-tinted
      active chip, success/idle/warn/error status dots, awaiting pip, and the
      pulsing tunnel-connected indicator (`.msc-strip-tunnel`).
- [x] `SessionSwitcher` drawer (`src/components/ui/SessionSwitcher.tsx`) — drops
      from the top as a sheet, groups live panes by project (cwd basename), shows
      all/awaiting/running/idle counts, focuses a pane on tap (→ Run). The ▦
      button now opens this hub; Settings is reachable from its header.
      (Note: the desktop-only "+ new session" is omitted — mobile can't create
      sessions. "swipe ← next session" gesture is not yet wired.)

### Supporting tasks
- [x] Load **JetBrains Mono** via `@expo-google-fonts/jetbrains-mono`; every
      theme's `fontMono` now points at it. Gated on the tab surface + best-effort
      app-wide load in `theme.ts`. (Pinned `expo-font` to ~14.0.12 for SDK 54.)
- [x] Updated `CLAUDE.md` (#12) — two-mode (standalone + Noise-relay tunnel)
      framing, a "Tunnel & multi-session" section, 6-tab nav, Plan tab, the
      tunnel/plan files in the tree, the tunnel data-flow, and removed the stale
      "Run tab is a placeholder" note.
- [ ] File an epic / tracking issue on GitHub for the redesign rollout
      (`M-redesign-epic`) — left for the publish/director step (no push yet).

## How to preview the design

Serve `design/msc-redesign/` and open `MSC Redesign.html` in a browser. It
loads the JSX via Babel-standalone + React 18 UMD — no build step.

```bash
# anything that serves static files; e.g.
npx http-server design/msc-redesign --port 5173
# open http://localhost:5173/MSC%20Redesign.html
```

## Notes

- The CLAUDE.md "Run tab is a placeholder" note has been corrected (#12): `run.tsx`
  is the tunnel/sessions UI (PairingView + PaneGridView + TerminalView), now aligned
  to the redesign chrome, and CLAUDE.md documents the two-mode architecture.
- The redesign assumes the tunnel client / pairing (#15, #16) are present and used as
  a *primary* surface alongside standalone. CLAUDE.md now frames both modes — the
  Noise-relay tunnel is end-to-end-encrypted through a blind Cloudflare Worker, **not**
  a direct desktop WebSocket server.
- **Stale elsewhere (not in this stream's scope):** `.github/PROJECT_PLAN.md`'s
  Communication section still describes the tunnel as "mobile WS client ⇄ desktop WS
  **server** with token auth" — superseded by the Noise relay. Flagged for the
  planner/director rather than edited here.
