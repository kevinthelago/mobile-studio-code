# Kit bindings contract (mobile ↔ base-studio-code designer)

base-studio-code is the source of truth for spec **content**. This file is the source of truth for the
**wiring** each mobile surface provides — the `binds` (host state a spec reads), `actions` (host
callbacks a spec fires by name), and `slots` (native React the host fills a `Slot` with).

**A designer spec authored for one of these ids MUST use these exact key/name strings**, or it renders
but does nothing — the mobile host feeds `values`/`on`/`slots` by these names. Ids are
`mobile.<lowerCamelCase>` and are the override key (see the base-studio-code kickoff §0/§6): the export's
`id` must match the row below exactly, or the app silently keeps its placeholder.

When the designer exports a spec for one of these ids, it **replaces** the mobile placeholder of the same
id (`src/lib/kit/baseline/mobile.<id>.json`). For a NEW surface, add its row here first and agree the
contract before authoring.

Legend: **binds** `key → value the host supplies` · **actions** `name → what the host does` · **slots**
`name → native fill`.

---

## Migrated surfaces (placeholders live in `src/lib/kit/baseline/`)

### `mobile.mirrorEmpty` — `role: layout`
The mirror awaiting/synced empty state (every mirror tab). Used by `src/components/shell/MirrorScaffold.tsx`.
- **binds:** `title → string` · `description → string`
- **actions:** none
- **slots:** `mirrorIcon → the monitor→phone SVG glyph`
- primitives: `EmptyState`, `Slot`

### `mobile.mirrorDisconnected` — `role: layout`
The mirror not-connected state (adds the Pair action). Same host as above.
- **binds:** `title → string` · `description → string`
- **actions:** `pair → navigate to /(more)/connection`
- **slots:** `mirrorIcon → the monitor→phone SVG glyph`
- primitives: `EmptyState`, `Button`, `Slot`

### `mobile.moreMenu` — `role: page`
The More menu (a list of nav rows). Used by `app/(more)/more.tsx`.
- **binds:** `connColor → string` (the Connection row's `StatusDot` color; green when connected else dim)
- **actions:** `openSessions` · `openConnection` · `openProviders` · `openTheme` · `openSecurity`
  (each → `router.push` to that route)
- **slots:** none
- primitives: `Stack`, `CardListRow`, `StatusDot`

### `mobile.connectionStatus` — `role: composite`
The pairing status card. Used by `app/(more)/connection.tsx`.
- **binds:** `dotColor → string` · `title → string` · `detail → string`
- **actions:** none (the action lives in the trailing slot)
- **slots:** `trailing → Disconnect button (connected) / spinner (connecting) / nothing`
- primitives: `Box`, `Row`, `Stack`, `StatusDot`, `Text`, `Slot`

### `mobile.skillItem` — `role: composite`
One skill card, rendered per item as the host maps the mirrored skills list. Used by
`src/components/skills/SkillsLibrary.tsx`.
- **binds:** `name → string` · `status → "On"|"Off"` · `desc → string` · `kind → string` ·
  `source → string` · `scope → string` (e.g. `"2 projects"` or `""`)
- **actions:** none
- **slots:** none
- primitives: `Card`, `Row`, `Text`, `Chip`

### `mobile.skillGroup` — `role: composite`
One skill-group card, rendered per item. Same host.
- **binds:** `name → string` (already prefixed `⬡ `) · `members → string` (` · `-joined, or "No members")
- primitives: `Card`, `Text`

### `mobile.lessonItem` — `role: composite`
One pending-lesson card, rendered per item. Same host.
- **binds:** `title → string` · `sub → string` (empty when not applicable) · `seen → string`
  (e.g. `"seen 3×"` or `""`)
- primitives: `Card`, `Text`

---

## Conventions the host relies on

- **Conditional TEXT → host-computed strings, bound in.** The host passes `""` for a line that
  shouldn't show; an empty `Text` is invisible. Do NOT model conditional text as conditional nodes.
- **Conditional/variable COMPONENTS → a `Slot`** the host fills (e.g. `connectionStatus.trailing`), or a
  list primitive. A static spec has no `if`.
- **Lists → the host iterates**, rendering one spec per item with per-item `binds` (see `skillItem`).
  Author the ITEM spec, not the list; the host owns the `.map`.
- **Tokens, never raw colors** — except where the host passes a resolved color string through a `binds`
  value (`connColor`, `dotColor`), which is a deliberate host-computed value, not a spec literal.

## Primitives the mobile renderer implements today (18 + `Slot`)

`Box` · `Stack` · `Row` · `Spacer` · `Text` · `Card` · `Chip` · `StatTile` · `Button` · `EmptyState` ·
`StatusDot` · `Banner` · `SectionHeader` · `SectionLabel` · `CardListRow` · `Toggle` · `TextField` ·
`SegmentedControl`, plus `Slot` (renderer-native). A spec using anything else renders a visible
`[unimplemented primitive]` marker until mobile adds it — the coverage test (`src/lib/kit/kit.test.ts`)
fails on it, so it can't ship silently. Report needed primitives on the shared list.
