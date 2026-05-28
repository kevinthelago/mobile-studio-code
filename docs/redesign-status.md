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

## Not yet landed (sequence)

### Visual primitives — `src/components/ui/*`
- [ ] `PageHeader` — crumbs + title + meta + right slot (replaces ad-hoc headers
      across screens)
- [ ] `Card` — bordered panel using `theme.surface` / `theme.borderColor`
- [ ] `Tag` — pill with variants (default / amber / green / info / warn)
- [ ] `SectionLabel` — uppercase letter-spaced section header with count + action
- [ ] `Btn` — sized + variant button (default / primary / ghost / icon)

### Screen migrations (one PR each, target `develop`)
- [ ] **Files** (`app/(tabs)/index.tsx`) — filter input, Recents row, tree with
      current/modified markers per the mockup
- [ ] **Find** (`app/(tabs)/find.tsx`) — large search input, scoping tags,
      collapsible per-file hit groups with line numbers + highlighted matches
- [ ] **Edit** (`app/(tabs)/edit.tsx`) — code view + collapsing inline chat
      dock (folds the dedicated chat into Edit; removes the separate chat screen)
- [ ] **Run** (`app/(tabs)/run.tsx`) — already implemented as PaneGrid; needs
      visual alignment (PageHeader, status chips, awaiting-input border)
- [ ] **Git** (`app/(tabs)/git.tsx`) — AI-drafted commit message card with
      branch metadata strip

### Plan sub-screens (depends on the tunnel exposing planning state)
- [ ] `PlanProjectsScreen` — project list, host vs. other-host grouping
- [ ] `PlanBoardScreen` — kanban with horizontal column pager
- [ ] `PlanIssueScreen` — issue + AI subtask breakdown
- [ ] `PlanScopingScreen` — live planning session with @planner
- [ ] `PlanPairingScreen` — wired to existing `useTunnel().connect`

### SessionStrip + session-switcher overlay
- [ ] Align SessionStrip styling with the redesign chips (status dots, awaiting
      pips, tunnel-offline state, ▦ menu glyph)
- [ ] Session-switcher drawer (drops from top, grouped per project, swipe ←
      shortcut)

### Supporting tasks
- [ ] Load **JetBrains Mono** font asset (the design uses it; `theme.fontMono`
      currently maps to Menlo)
- [ ] Update `CLAUDE.md` to describe the redesign architecture (Plan tab,
      6-tab nav, multi-session model) and replace stale references like
      "Run tab is a placeholder" — folds into issue #12
- [ ] File an epic / tracking issue on GitHub for the redesign rollout

## How to preview the design

Serve `design/msc-redesign/` and open `MSC Redesign.html` in a browser. It
loads the JSX via Babel-standalone + React 18 UMD — no build step.

```bash
# anything that serves static files; e.g.
npx http-server design/msc-redesign --port 5173
# open http://localhost:5173/MSC%20Redesign.html
```

## Notes

- The CLAUDE.md description of `app/(tabs)/run.tsx` as "Run tab is a placeholder"
  is **stale** — `run.tsx` is the fully-built tunnel/sessions UI (PairingView +
  PaneGridView + TerminalView). The redesign's Run mockup matches what already
  ships. CLAUDE.md cleanup belongs in issue #12.
- The redesign assumes the tunnel client / pairing (#15, #16) are present and
  used as the *primary* surface. That's a notable shift from the current
  standalone-first ethos documented in CLAUDE.md / issue #12. The pivot is
  intentional per the project plan's multi-agent direction.
