# Planner Sync Protocol (base-studio-code ⇄ Mobile)

Cross-device sync for the local **Project Planner**, over the existing Noise tunnel.
This is the **contract** both apps implement; the mobile reference lives in
`src/lib/planner/sync/` and the shared cases in `plannerCore.fixtures.json`.

## 0. What's synced

Each app runs the planner locally; a "project" is a plan (blueprint + discovery docs +
`phases.json`/`issues.json`/`fleet.json`/…). Frames are JSON inside the Noise envelope,
`type`-tagged, camelCase — like the `pane_*` messages.

- **Synced:** the plan's files + structure.
- **Device-local, never synced:** the planner conversation and pipeline run states.

## 1. Model — conflict-aware 3-way reconcile

Both sides edit independently and clocks don't agree, so sync is keyed off **content**,
not timestamps:

- Each side keeps, per project, the **base**: the canonical file map as of the last
  successful sync (the merge ancestor).
- Reconcile compares **base / local / remote** per file. Non-overlapping edits
  **auto-merge**; only overlapping edits conflict.
- **MSC (mobile) is the merge authority** — it owns the conflict editor. Desktop ships
  its state, serves files, and applies the merged result. Conflicts are resolved on
  mobile *before* the push, so they never appear on the wire.

## 2. Canonical file map (the contract)

A project reduces to `{ relpath → content }`. Both apps must produce **byte-identical**
content or every line looks "changed."

**File set**
- One file per non-empty section. Filename rule: a bare topic key → `${key}.md`
  (`goal`→`goal.md`); a key with an extension is verbatim (`issues.json`,
  `automations.md`). Empty sections produce no file (state lives in `plan.json`).
- `plan.json`:
  ```json
  { "schema": 1, "blueprintId": "default", "title": "My project",
    "sections": { "goal": "confirmed", "issues.json": "confirmed", "context": "surfaced" } }
  ```
  `sections` = section key → lifecycle state (`surfaced|drafted|confirmed|skipped`).
  The blueprint is referenced by id (each app reconstructs it from its library).

**Serialization**
- **Markdown:** CRLF/CR→`\n`; strip per-line trailing whitespace; collapse trailing
  blank lines; single trailing `\n` (empty → empty string).
- **JSON:** `JSON.stringify(sortKeysDeep(v), null, 2) + "\n"` (keys sorted recursively).
- **Hash:** FNV-1a 32-bit over the canonical string, lowercase hex8:
  `h=0x811c9dc5; per charCode c: h^=c; h=(h*0x01000193)>>>0`.

**Stable ids:** the planner mints a short, stable `id` on every issue/phase/stream and
never renumbers it — the structured JSON merge keys on it.

## 3. Merge semantics

- `issues.json` / `phases.json` / `fleet.json` / `skills.json` / `repos.json` →
  **structured merge by `id`**: per id, one-sided change wins, identical change is fine,
  same-id-different is an element conflict; element add/remove sync. **If any element
  lacks an `id`, fall back to text merge** of the canonical JSON.
- Everything else (markdown, `plan.json`) → **line diff3**.
- **Deletions are local-only (v1):** within reconcile, an absent file = "no change from
  that side", never a propagated delete (a lingering copy is acceptable). Array-*element*
  removal inside a JSON file is a content edit and does sync.

Mobile reference: `canonical.ts`, `diff3.ts`, `jsonMerge.ts`, `merge.ts`, `reconcile.ts`.

## 4. Wire protocol (frames inside Noise)

Contract v2 (base-studio-code#2497) pinned these to the DESKTOP's Rust (`bsc-tunnel`)
shapes — the desktop replays, mobile reconciles. Byte shapes are pinned in the shared
`tunnelProtocol.fixtures.json`.

1. **Manifest** (desktop→mobile): **one frame per project**, replayed unprompted right
   after `auth_ok` (no request needed on connect) and re-broadcast when the desktop's
   plan changes. A targeted single-project refresh can be requested with
   `{ "type": "plan_sync_manifest_request", "projectId": "proj-…" }` (the projectId is
   REQUIRED — the v1 broadcast request no longer exists on the wire):
   ```json
   { "type": "plan_sync_manifest", "projectId": "proj-…",
     "files": { "goal.md": "cd617b34", "plan.json": "…" } }
   ```
   `files` = relpath → canonical-content hash. The tunnel client accumulates the
   per-project frames and delivers the full known set to the reconcile coordinator
   (debounced), preserving the multi-project semantics.
2. **Pull** (mobile→desktop): `{ "type": "plan_sync_pull", "projectId": "…", "paths": [...] }`
   → `{ "type": "plan_sync_files", "projectId": "…",
        "files": [ { "relpath": "goal.md", "content": "…\n" } ] }`
   (files travel as `{relpath, content}` arrays; the client converts to a map).
3. **Push** (mobile→desktop): the **full canonical merged map** for the project:
   `{ "type": "plan_sync_push", "projectId": "…",
      "files": [ { "relpath": "…", "content": "…" } ] }` — **no title on the wire** (v2).
   Desktop replaces the project's synced files with exactly this map, reconstructs its
   hub state, sets **base = this map**, keeps device-local data, and acks:
   `{ "type": "plan_sync_ack", "projectId": "…", "applied": true }`. Mobile sets its
   base on an `applied: true` ack (an `applied: false` ack rejects the push promise).

New-on-one-side projects flow the same way (pulled, then pushed back so both set base).
Re-running a sync is idempotent (3-way handles a stale base). **No conflict frames** —
conflicts are resolved on mobile before the push.

## 5. Desktop responsibilities

- Map the hub (`~/.base-studio-code/projects/<key>/…`) ↔ the canonical file map +
  `plan.json`, using the exact serialization in §2.
- Keep a per-project **base** snapshot; serve manifest + files; apply push + ack.
- Mint stable `id`s on issues/phases/streams in the planner template.

## 6. Shared fixture

`plannerCore.fixtures.json` (mirrored in both repos) pins canonical serialization,
merge, reconcile, and round-trip cases. Both test suites validate against it; a shape
change on either side turns the other red.

## 7. Out of scope (v1)

Propagated deletions/tombstones; desktop-initiated merges; base-divergence recovery
beyond re-merge; GitHub as a transport.

## 8. Acceptance

- Pair → manifests exchange → projects reconcile by stable id.
- Non-overlapping edits auto-merge silently; an overlap raises a conflict on mobile only;
  after resolution both devices hold identical files + base.
- A locally-built plan on either device lands on the other.
- Both implementations pass the shared fixture.
