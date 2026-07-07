# Live Planning Mirror (base-studio-code → Mobile)

Mobile mirrors the desktop's **live planning session** read-only and steers it with a few
input-gated drive frames. This is **distinct** from the async file reconciliation in
[`planner-sync-protocol.md`](./planner-sync-protocol.md) (which is unchanged): that path
syncs plan *files*; this path mirrors what the planner is doing **right now**.

The wire contract is owned jointly with the desktop. The canonical fixtures live in
`src/lib/tunnel/tunnelProtocol.fixtures.json` — a **byte-identical** copy of
base-studio-code's `src/lib/tunnel/tunnelProtocol.fixtures.json`. The parity test
`src/lib/tunnel/tunnelProtocol.fixtures.test.ts` decodes every fixture into the mobile
models (`TunnelServerMessage` / `TunnelClientMessage` in `src/lib/types.ts`) and fails on
any drift in either direction, so a schema change can only land as **coordinated PRs in
both repos**. Tracking issue: #1245 (desktop PT1: #934 / #985 / #986 / #987).

## Frames

All frames are JSON inside the Noise envelope: camelCase fields, snake_case `type`.

**Server → phone** (the desktop is the single source of truth):

| `type`        | Fields | Replayed on connect? |
|---------------|--------|----------------------|
| `plan_state`  | `projectId`, `currentStage`, `confirmedSections: string[]`, `files: {relpath,content}[]`, `messages: {role,text,at}[]`, `pipelineRuns: {id,stage,status}[]` | **Yes** — full snapshot; replaces prior state wholesale. |
| `plan_status` | `projectId`, `currentStage`, `status` | **Yes** — cheap header. |
| `plan_event`  | `projectId`, `kind`, `at`, `section?`, `stage?`, `message?`, `run?` | **No** — transient, fire-and-forget delta. `kind ∈ section_confirmed \| stage_advanced \| message_appended \| pipeline_run`. |

**Phone → desktop** (input-gated — same gate as `pane_input`; dropped when not granted):

| `type`         | Fields | Meaning |
|----------------|--------|---------|
| `plan_advance` | `projectId`, `stageKey` | Advance / jump the live planner to a stage. |
| `plan_confirm` | `projectId`, `section`  | Confirm a plan section. |
| `plan_chat`    | `projectId`, `text`     | Send a chat turn into the planner session. |

## Semantics

On (re)connect the phone receives the replayed `plan_state` + `plan_status` (the full
picture), then applies incremental `plan_event` deltas. **A late/reconnecting client must
rebuild purely from the replayed snapshot — it never assumes it saw earlier events.** The
pure reducer (`src/lib/tunnel/livePlan.ts`, keyed by `projectId`) enforces this:
`applyPlanState` rebuilds wholesale; `applyPlanStatus` updates the header; `applyPlanEvent`
folds one delta. The mirror is cleared at the start of each new connection attempt so a
reconnect cannot retain a project the desktop has since dropped.

Drive frames are fire-and-forget: the desktop owns the state, so any optimistic UI must
reconcile on the next `plan_state` / `plan_event`. The mobile UI sends the frame and waits
for the desktop's echo rather than mutating the mirror locally.

`pipelineRuns` is currently always `[]` on the desktop (the planner runs no pipelines) but
is part of the contract — the mirror renders an empty list gracefully.

## Mobile implementation

- **Reducer (pure, tested):** `src/lib/tunnel/livePlan.ts` + `livePlan.test.ts`.
- **Transport:** `TunnelClient` (`src/lib/tunnel.ts`) handles the three server frames via
  `onPlanState`/`onPlanStatus`/`onPlanEvent` callbacks and exposes
  `planAdvance`/`planConfirm`/`planChat` (+ `refreshFcmToken` for `set_fcm_token`).
- **State:** `LivePlanProvider` (`src/lib/tunnel/LivePlanContext.tsx`) holds the per-project
  mirror; `TunnelContext` exposes the drive methods and the `setPlanHandler` registration.
- **UI:** `app/(live)/live.tsx` — a dedicated, read-only screen (stepper from
  `currentStage` + `confirmedSections`, section files, chat transcript, pipeline runs) with
  the three drive actions. Reachable via the **Live** shortcut on the Run tab once a
  planning frame has arrived.

## Desktop counterparts

- Frame types + store→wire mapping: `base-studio-code/src/lib/tunnel/tunnel.ts`
- Fixtures (the contract): `base-studio-code/src/lib/tunnel/tunnelProtocol.fixtures.json`
- Full protocol doc: `base-studio-code/docs/tunnel-protocol.md`
- Rust transport: `base-studio-code/src-tauri/src/tunnel.rs` · relay worker: `base-studio-code/relay/`
