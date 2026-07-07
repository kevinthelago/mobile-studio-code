export type ChatRole = 'user' | 'assistant';

export type TextBlock = { type: 'text'; text: string };
export type ImageBlock = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
};
export type ToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};
export type ToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

export type ChatMessage = {
  role: ChatRole;
  content: string | ContentBlock[];
};

export type AttachedImage = {
  uri: string; // local file URI for preview
  base64: string; // base64-encoded data for API
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
};

export type ChatTurn =
  | { kind: 'user'; text: string; images?: AttachedImage[] }
  | { kind: 'assistant'; text: string }
  | {
      kind: 'tool';
      name: string;
      input: Record<string, unknown>;
      result?: string;
      isError?: boolean;
    }
  // System notes — emitted by the optimizer when it compacts or evicts.
  // Rendered subtly so the user knows context was reshaped without it being
  // a noisy chat turn.
  | { kind: 'note'; text: string };

export type FileEntry = {
  sha: string | null;
  modified: boolean;
};

export type Manifest = {
  repo: string;
  branch: string;
  syncedAt: number;
  files: Record<string, FileEntry>;
};

export type PersistedChat = {
  turns: ChatTurn[];
  history: ChatMessage[];
  updatedAt: number;
};

export type PendingOperation = {
  history: ChatMessage[];
  startedAt: number;
  // Set when checkpoints come from a task-scoped agent run. On resume we
  // discard the checkpoint if it belongs to a task other than the active one.
  taskId?: string;
};

// One unit of work. Tasks own a chat scope: turns and history are isolated
// from other tasks so the agent's context window stays focused. A task may
// optionally link to a GitHub issue, which the agent can read on demand
// without keeping the issue body in conversation history.
export type LinkedIssue = {
  number: number;
  title: string;
  url: string;
};

export type Task = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  linkedIssue: LinkedIssue | null;
  turns: ChatTurn[];
  history: ChatMessage[];
};

// Listing-only summary stored in the task index — full task body lives in
// its own file so we don't pay a serialization cost just to render the picker.
export type TaskSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  linkedIssue: LinkedIssue | null;
  turnCount: number;
};

export type TaskIndex = {
  version: 1;
  tasks: TaskSummary[];
  activeTaskId: string | null;
};

export type RetryStatus = {
  attempt: number;
  delayMs: number;
  error: string;
} | null;

export type CancelSignal = { cancelled: boolean };

// ── Tunnel / base-studio-code protocol ──────────────────────────────────────

/**
 * Tunnel wire-contract version (base-studio-code#2497). Sent in the `auth` frame
 * (`protocolVersion`) and echoed by the desktop in `auth_ok`.
 *
 * Mismatch policy: ACCEPT, but surface — neither side rejects on a version mismatch
 * (unknown frame types are tolerated); the client compares the echoed desktop version
 * against its own and warns that some frames may be missing/ignored.
 *
 * v1 (implicit — no version on the wire) → v2: adds `store_state`, the auth/auth_ok
 * `protocolVersion`, the optional `PaneDescriptor.kind`, and pins the plan_sync frames
 * to the desktop's Rust (bsc-tunnel) shapes.
 *
 * Post-v2 additive changes ride WITHIN v2 (no bump — both sides ignore unknown fields /
 * frame types, so an optional-field or new-frame addition breaks neither peer):
 * `auth_ok.inputGranted` + the `input_grant_changed` frame (base-studio-code#2511).
 */
export const TUNNEL_PROTOCOL_VERSION = 2;

export type PaneStatus = 'running' | 'idle' | 'awaiting_input' | 'error';

export type PaneStreamingState = 'streaming' | 'minimized' | 'dormant';

/** What kind of desktop session a pane is (contract v2). The fleet director rides as
 *  `worker`. Optional on the wire — a pre-v2 desktop omits it (treat as `console`). */
export type PaneKind = 'console' | 'worker' | 'planner' | 'designer' | 'triage';

export type PaneDescriptor = {
  id: string;
  cwd: string;
  name: string;
  status: PaneStatus;
  kind?: PaneKind;
};

/** The desktop PTY's grid dimensions for a pane (columns × rows of cells). */
export type PaneSize = { cols: number; rows: number };

export type PaneSessionState = {
  paneId: string;
  status: PaneStatus;
  currentTask: string;
  lastActivity: string; // ISO timestamp
  prompt: string | null; // populated when status === 'awaiting_input'
};

// ── Live planning session (PT1, #934 / #985 / #986 / #987; mobile #1245) ──
//
// Distinct from the async `plan_sync_*` file-reconciliation path (which is
// unchanged). The desktop is the single source of truth: it emits `plan_state`
// (full snapshot, replayed on connect), `plan_status` (cheap header, replayed),
// and `plan_event` (transient deltas, fire-and-forget, NOT replayed). The phone
// MIRRORS these read-only and DRIVES via `plan_advance`/`plan_confirm`/`plan_chat`.
// Wire shapes are pinned in src/lib/tunnel/tunnelProtocol.fixtures.json (byte-identical
// to the desktop's copy) and exercised by tunnelProtocol.fixtures.test.ts. Field names
// are camelCase; the `type` discriminator is snake_case.

/** One canonical section file in a planning snapshot (`plan_state.files`). */
export type PlanFile = {
  relpath: string;
  content: string;
};

/** One chat turn in the live planning session. Tool blocks are dropped desktop-side. */
export type PlanMessage = {
  role: 'user' | 'assistant';
  text: string;
  /** Epoch ms. */
  at: number;
};

/** A pipeline run's live state, projected to the phone. */
export type PlanPipelineRun = {
  id: string;
  stage: string;
  status: string;
};

/** The four `plan_event` delta kinds; the matching detail field is set per kind. */
export type PlanEventKind =
  | 'section_confirmed'
  | 'stage_advanced'
  | 'message_appended'
  | 'pipeline_run';

// ── Generic store projections (contract v2, base-studio-code#2497) ──
//
// `store_state` is the desktop's generic projection frame: the last-written state of one
// desktop store `domain` as an opaque JSON string, with a monotonically increasing
// per-domain `rev` (stale/out-of-order frames are dropped). Replayed on connect (last
// frame per domain) and broadcast on every change. The frame is domain-agnostic — the
// constants below only name the projections the desktop currently publishes.

/** The registered `store_state` domains (mirrors bsc-tunnel `store_domains::ALL`). */
export const STORE_DOMAINS = [
  'glance', 'plan', 'org', 'blueprints', 'skills',
  'components', 'themes', 'automations', 'mcp', 'alerts',
] as const;

export type StoreDomain = (typeof STORE_DOMAINS)[number];

/** The mirrored value the phone holds per store_state domain. */
export type StoreStateEntry = {
  /** Desktop's monotonically increasing revision for the domain. */
  rev: number;
  /** The opaque serialized projection (parse per domain). */
  json: string;
};

// ── Hook telemetry (read-only projection; desktop M3/#937) ──

/** One day's allow/block counts in the hook-telemetry projection. */
export type HookDayBucket = { day: string; allows: number; blocks: number };

/** Fires per hook in the projection. */
export type HookCount = { hook: string; event: string; fires: number };

/** Read-only aggregated hook-fire telemetry pushed by the desktop. */
export type HookTelemetry = {
  total: number;
  blocks: number;
  allows: number;
  /** allows / (allows + blocks), 0–100. */
  allowRate: number;
  daily: HookDayBucket[];
  perHook: HookCount[];
};

/** Messages sent from base-studio-code desktop → mobile */
export type TunnelServerMessage =
  // Echoes the desktop's protocol version (contract v2); absent from a pre-v2 desktop.
  // `inputGranted` (base-studio-code#2511) is the connect-time snapshot of the desktop's
  // view-only gate; absent from a pre-#2511 desktop (⇒ grant unknown, keep the honest
  // 'unconfirmed' input posture).
  | { type: 'auth_ok'; protocolVersion?: number; inputGranted?: boolean }
  // The desktop granted/revoked input control mid-session (base-studio-code#2511).
  // Broadcast on every toggle; NOT replayed on connect (auth_ok carries that state).
  | { type: 'input_grant_changed'; granted: boolean }
  | { type: 'pane_list'; panes: PaneDescriptor[] }
  | { type: 'pane_output'; paneId: string; data: string; coarse: boolean }
  // The desktop PTY's grid size for a pane. Sent on pairing replay (after
  // pane_list + session_state, one per pane) and whenever the desktop PTY
  // resizes. The phone adopts this size; it does not drive it.
  // Canonical shape: shared fixture serverToClient.pane_size (base-studio-code).
  | { type: 'pane_size'; paneId: string; cols: number; rows: number }
  | {
      type: 'session_state';
      paneId: string;
      status: PaneStatus;
      currentTask: string;
      lastActivity: string;
      prompt: string | null;
    }
  | { type: 'user_request'; paneId: string; prompt: string }
  // Generic store projection (contract v2) — see StoreStateEntry above.
  | { type: 'store_state'; domain: string; rev: number; json: string }
  // Read-only hook-fire telemetry (desktop M3/#937).
  | { type: 'hook_telemetry'; telemetry: HookTelemetry }
  // ── Planner sync — the DESKTOP (Rust bsc-tunnel) shapes are authoritative (v2 drift
  // fix, base-studio-code#2497): ONE project per manifest frame (relpath → content hash;
  // the desktop replays one frame per project on connect), files as {relpath, content}
  // arrays, and an explicit ack `applied` flag. ──
  | { type: 'plan_sync_manifest'; projectId: string; files: Record<string, string> }
  | { type: 'plan_sync_files'; projectId: string; files: PlanFile[] }
  | { type: 'plan_sync_ack'; projectId: string; applied: boolean }
  // ── Live planning session (read-only mirror; replayed on connect) ──
  | {
      type: 'plan_state';
      projectId: string;
      currentStage: string;
      confirmedSections: string[];
      files: PlanFile[];
      messages: PlanMessage[];
      pipelineRuns: PlanPipelineRun[];
    }
  // Transient delta — fire-and-forget, NOT replayed. The detail field set per `kind`.
  | {
      type: 'plan_event';
      projectId: string;
      kind: PlanEventKind;
      at: number;
      /** kind === 'section_confirmed'. */
      section?: string;
      /** kind === 'stage_advanced'. */
      stage?: string;
      /** kind === 'message_appended'. */
      message?: PlanMessage;
      /** kind === 'pipeline_run'. */
      run?: PlanPipelineRun;
    }
  // Cheap header update (active stage + a short status label). Replayed on connect.
  | { type: 'plan_status'; projectId: string; currentStage: string; status: string };

/** One project's manifest (relpath → content hash), as the client accumulates the
 *  per-project `plan_sync_manifest` frames. The v1 `title`/`updatedAt` fields never
 *  existed on the desktop's wire and were dropped in the v2 drift fix. */
export type PlanSyncManifestEntry = {
  projectId: string;
  files: Record<string, string>;
};

/** Messages sent from mobile → base-studio-code desktop */
export type TunnelClientMessage =
  // `protocolVersion` (contract v2): this client's TUNNEL_PROTOCOL_VERSION. Optional so
  // the shape stays valid for a pre-v2 peer; the desktop accepts any version.
  | { type: 'auth'; token: string; fcmToken?: string; protocolVersion?: number }
  // Refreshed FCM registration token (tokens rotate); updates the desktop's push
  // target mid-session. Allowed even while view-only.
  | { type: 'set_fcm_token'; fcmToken: string }
  | { type: 'pane_set_state'; paneId: string; state: PaneStreamingState }
  | { type: 'pane_focus'; paneId: string }
  | { type: 'pane_input'; paneId: string; data: string }
  | { type: 'pane_resize'; paneId: string; cols: number; rows: number }
  // ── Planner sync — desktop (Rust) shapes are authoritative (v2 drift fix):
  // manifest_request REQUIRES a projectId (the desktop replays every project's manifest
  // on connect unprompted; this frame is a targeted refresh), push sends {relpath,
  // content} arrays and carries NO title. ──
  | { type: 'plan_sync_manifest_request'; projectId: string }
  | { type: 'plan_sync_pull'; projectId: string; paths: string[] }
  | { type: 'plan_sync_push'; projectId: string; files: PlanFile[] }
  // ── Live planning drive frames (steer the desktop's live session) ──
  // Honored only when the desktop has granted input (same gate as pane_input);
  // dropped otherwise. The phone reconciles optimistic UI on the next plan_state.
  | { type: 'plan_advance'; projectId: string; stageKey: string }
  | { type: 'plan_confirm'; projectId: string; section: string }
  | { type: 'plan_chat'; projectId: string; text: string };

/**
 * The mirrored live-planning state the phone holds for one project, reduced from
 * the replayed `plan_state` + `plan_status` snapshot and incremental `plan_event`
 * deltas. A reconnecting client rebuilds this purely from the replayed snapshot —
 * it never assumes it saw earlier events. See src/lib/tunnel/livePlan.ts.
 */
export type LivePlanState = {
  projectId: string;
  currentStage: string;
  /** Short status label from plan_status (empty until the first header arrives). */
  status: string;
  confirmedSections: string[];
  files: PlanFile[];
  messages: PlanMessage[];
  pipelineRuns: PlanPipelineRun[];
  /** Epoch ms of the last frame applied (snapshot or delta); 0 before any. */
  updatedAt: number;
};

/** Per-pane runtime state held in memory on the mobile side */
export type PaneState = {
  descriptor: PaneDescriptor;
  streamingState: PaneStreamingState;
  /** Accumulated PTY output — only populated for the streaming (focused) pane */
  outputBuffer: string;
  /** Latest structured state update — populated for minimized panes */
  sessionState: PaneSessionState | null;
  /**
   * Desktop PTY grid size, from the server's `pane_size` frame. Drives the
   * terminal's render width (font is scaled so `cols` cells span the device)
   * so the desktop's line-wrapping is reproduced instead of re-wrapped. Null
   * until the first `pane_size` frame for this pane arrives.
   */
  ptySize: PaneSize | null;
  hasUserRequest: boolean;
  lastUserRequestAt: number | null;
  lastActivityAt: number | null;
};

export type TunnelConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error';

/**
 * Pairing payload encoded in the desktop's QR (raw JSON, camelCase). Per
 * base-studio-code: `relayUrl` is a wss:// base URL, `room` an opaque id,
 * `hostPubKey` STANDARD base64 of the desktop's X25519 static key, and `psk`
 * a 64-hex string used verbatim as the auth token.
 */
export type PairingPayload = {
  relayUrl: string;
  room: string;
  hostPubKey: string;
  psk: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: object;
};

export type AnthropicResponse = {
  id: string;
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
};
