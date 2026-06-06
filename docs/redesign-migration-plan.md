# Redesign Migration Plan

Maps the final redesign in `design/Mobile Studio Code/` onto the current
implementation. This is a planning document only — no code has changed.

The redesign is a faithful port of the shipped app (5 tabs, SessionStrip,
themed chrome, Edit chat, tunnel/Run states, Git issue chips). Most of it is a
**visual reconciliation** of screens that already exist. The one true
expansion is **standalone multi-provider model support** ("Connect a cloud
model"), which is treated here as a full feature.

Branch naming follows the repo convention: `{issue-number}-{short-description}`,
branched from `develop`.

GitHub issues (opened):

| Plan ID | Issue | Title |
|---|---|---|
| M1 | [#58](https://github.com/kevinthelago/mobile-studio-code/issues/58) | Provider abstraction + multi-model backend |
| M2 | [#59](https://github.com/kevinthelago/mobile-studio-code/issues/59) | Providers / "Connect a model" screen |
| M3 | [#60](https://github.com/kevinthelago/mobile-studio-code/issues/60) | Standalone agent mode (tunnel-optional) |
| M4 | [#61](https://github.com/kevinthelago/mobile-studio-code/issues/61) | GitHub PAT entry (credential gap) |
| M5 | [#62](https://github.com/kevinthelago/mobile-studio-code/issues/62) | Repo picker: Recent repos + sheet styling |
| M6 | [#63](https://github.com/kevinthelago/mobile-studio-code/issues/63) | Git: per-file diff stats |
| M7 | [#64](https://github.com/kevinthelago/mobile-studio-code/issues/64) | SessionStrip polish |
| M8 | [#65](https://github.com/kevinthelago/mobile-studio-code/issues/65) | Visual / theme-token reconciliation |
| M9 | [#66](https://github.com/kevinthelago/mobile-studio-code/issues/66) | Finalize onboarding removal |

---

## Status legend

| Mark | Meaning |
|------|---------|
| ✅ | Already implemented; design matches — visual reconciliation only |
| 🟡 | Partially implemented; design adds net-new UI on top |
| 🔴 | Net-new capability; no backend or UI exists today |

---

## Screen-by-screen mapping

| Design file | App target | State | Notes |
|---|---|---|---|
| `shell.jsx` → `Shell`, `BottomNav`, `StatusBar`, `HomeIndicator` | `app/(tabs)/_layout.tsx`, `BottomTabBar.tsx`, `app/_layout.tsx` (`ThemedFrame`) | ✅ | 5-tab structure + themed chrome already live |
| `shell.jsx` → `SessionStrip` | `src/components/ui/SessionStrip.tsx` | 🟡 | Design adds a leading **tunnel glyph** + content inset; impl pins as overlay |
| `page-files.jsx` | `app/(tabs)/index.tsx` | ✅ | Tree, recents, filter all present. Design shows file-size labels (new, cosmetic) |
| `page-find.jsx` | `app/(tabs)/find.tsx` | ✅ | Local grep, scope chips, case toggle — matches |
| `page-edit.jsx` | `app/(tabs)/edit.tsx` | ✅ | Chat turns (user/tool/note/reply), image strip, model chip — matches |
| `page-git.jsx` | `app/(tabs)/git.tsx` | 🟡 | Issue chips + Draft-with-Claude present. Design adds **per-file `+adds −dels` diff stats** (no backend) |
| `page-repo.jsx` | `app/repo.tsx` | 🟡 | Fields + theme picker present. Design adds **Recent repos** list + sheet styling |
| `page-terminal.jsx` → `Pairing/Scanner/Connecting/SessionGrid/TerminalView` | `app/(tabs)/run.tsx` | ✅ | Tunnel state machine matches |
| `page-terminal.jsx` → `Providers` + "run standalone" | — | 🔴 | **No equivalent exists** — multi-provider standalone mode |
| `themes.jsx` | `src/theme.ts` | ✅ | Same token bag. One name mismatch: `"Terminal Native"` vs `"Terminal"` |

---

## Cross-cutting gaps the design surfaces

1. **GitHub PAT entry has no home.** Onboarding was removed; the Providers
   screen only handles *LLM* keys; the repo picker assumes a PAT already
   exists. The design never shows where the GitHub token is entered. → **M4**.
2. **Git diff stats** (`+4 −1` per file) assume diff data the app doesn't
   compute. The manifest only tracks `modified: boolean` + `sha`. → **M6**.
3. **Theme name mismatch** would break `t.name === 'Terminal'` checks if the
   design tokens are copied verbatim. → **M8**.

---

## Proposed issues

### M1 — Provider abstraction + multi-model backend 🔴 (epic)
**Why:** the design lets the app run agents directly against any provider
without the desktop tunnel. Today everything is hardcoded to Anthropic
(`anthropic.ts`: `claude-sonnet-4-6` chat, `claude-haiku-4-5` drafts).

**Scope** (split into sub-issues — this is the largest and riskiest work):
- **M1a — Provider interface + Anthropic adapter parity.** Define a
  `LLMProvider`/`LLMClient` abstraction (chat, stream, tool-loop turn,
  draft-commit). Re-implement the current Anthropic path behind it so behavior
  is identical. Refactor `agent.ts` to call the abstraction, not `anthropic.ts`
  directly.
- **M1b — Tool-call normalization layer.** *Highest technical risk.* Anthropic
  `tool_use`/`tool_result` blocks differ from OpenAI `tool_calls`/`function`
  and Google `functionCall`/`functionResponse`. Normalize the agent's 10 tools
  (`list_directory`, `read_file`, `grep_file`, `write_file`, `push_changes`,
  `pull_changes`, `read_remote_file`, `resolve_conflict`, `read_issue`,
  `comment_on_issue`) into a provider-agnostic schema + per-provider
  encode/decode. Preserve the 20-iteration cap and context optimizer.
- **M1c — OpenAI adapter** (GPT-5 family).
- **M1d — Google adapter** (Gemini 2.5 Pro/Flash).
- **M1e — xAI adapter** (Grok 4).
- **M1f — Local adapter** (Ollama over HTTP; on-device/LAN endpoint).
- **M1g — Model registry + key storage.** Provider/model metadata (id, ctx
  size, "recommended" tag) and multi-key secure storage. Extend
  `storage.ts` `KEYS` with per-provider keys + selected provider/model.

**Dependencies:** none (foundational). Blocks M2, M3.
**Risk:** high — tool-use semantics vary per provider; image attachments
(Edit tab) also differ across providers.

### M2 — Providers / "Connect a model" screen 🔴
**Why:** the UI from `page-terminal.jsx` (`Providers`): provider list,
expandable model rows with radio select, context badges, "Recommended" tag,
per-provider key field / "Use this model" CTA, connected/on-device status pills.

**Scope:** new screen reachable from the Run tab pairing view via the
"or run standalone → Connect a cloud model" entry. Wire selection + key entry
to M1g storage; reflect connection status.
**Dependencies:** M1g (storage + registry).

### M3 — Standalone agent mode (tunnel-optional) 🔴
**Why:** the design reframes the desktop tunnel as *optional*. Today the Run
tab is tunnel-only and the Edit-tab agent is Anthropic-only.

**Scope:** decide and implement the standalone semantics —
- the Edit-tab agent + commit drafting use the **selected provider/model**
  (from M1/M2) instead of hardcoded Anthropic;
- the pairing screen branches cleanly between "connect to desktop" and "run
  standalone"; the SessionStrip/grid remain desktop-only.
**Open design question to resolve in this issue:** does "standalone" only
re-point the existing Edit agent, or does it also create local "sessions" that
appear in the Run grid? (Recommend: re-point the Edit agent only for v1.)
**Dependencies:** M1, M2.

### M4 — GitHub PAT entry (credential gap) 🟡
**Why:** onboarding removal left no PAT entry point. Required for repo
clone/pull/push to work at all.
**Scope:** add a PAT field — simplest home is the repo picker (above the
repo/branch fields) and/or a small Settings surface. Reuse `verifyGithubPat`.
**Dependencies:** none. **Priority:** high (app is non-functional without it).

### M5 — Repo picker enhancements 🟡
**Scope:** add the **Recent repos** list from `page-repo.jsx`; adopt the
slide-up sheet styling (grabber, rounded top). Persist recent repos.
**Dependencies:** none.

### M6 — Git diff stats / minimal diff 🔴
**Why:** design shows `+adds −dels` per modified file and implies richer diff
affordance. App has **no diff** (known tech debt); manifest lacks original
content.
**Scope:** compute line add/delete counts by diffing current local content
against the last-synced blob (store original-on-open, or fetch remote blob).
Surface counts in the Modified list. Full inline diff view is a stretch goal.
**Dependencies:** none, but touches `fs.ts`/`github.ts`/manifest. **Priority:** low.

### M7 — SessionStrip polish ✅→🟡
**Scope:** add the leading tunnel glyph + divider; verify the content-inset
behavior (`STRIP_INSET`) matches the design's down-shift. Mostly cosmetic.
**Dependencies:** none.

### M8 — Visual / token reconciliation ✅
**Scope:** apply the design's refined visuals to existing components — primary
gradient buttons (glass: `linear-gradient(135deg,#d97757,#c084fc)`), corner
radii, spacing. Fix the `"Terminal Native"` vs `"Terminal"` name so name-based
chrome checks keep working. No structural change.
**Dependencies:** none.

### M9 — Finalize onboarding removal ✅ (in progress, uncommitted)
**Scope:** commit the already-made removal of `app/setup.tsx` + the
`setup` stage from `session.tsx`/`_layout.tsx` + CLAUDE.md docs. Ensure the
credential paths from M2 (LLM keys) and M4 (GitHub PAT) cover what onboarding
used to collect.
**Dependencies:** pairs with M2 + M4.

---

## Suggested sequencing

```
Phase 0 (unblock):   M9 (commit) → M4 (PAT entry)        # app usable again
Phase 1 (foundation): M1a → M1b → M1g                     # provider core + storage
Phase 2 (providers):  M1c, M1d, M1e, M1f (parallel) → M2  # adapters + screen
Phase 3 (wire):       M3                                  # standalone mode
Phase 4 (polish):     M5, M7, M8                          # cosmetic, low risk
Phase 5 (stretch):    M6                                  # diff stats
```

## Biggest risks / decisions
- **Tool-call normalization (M1b)** is the crux. If cross-provider tool-use
  proves too lossy, fall back to Anthropic-only execution with other providers
  limited to plain chat (no agent tools) for v1.
- **Standalone semantics (M3)** need a product decision before building.
- **Multi-provider image support** — the Edit tab's screenshot attach must be
  encoded per provider; some local models won't support vision.
