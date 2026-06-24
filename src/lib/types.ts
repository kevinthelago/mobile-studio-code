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

export type PaneStatus = 'running' | 'idle' | 'awaiting_input' | 'error';

export type PaneStreamingState = 'streaming' | 'minimized' | 'dormant';

export type PaneDescriptor = {
  id: string;
  cwd: string;
  name: string;
  status: PaneStatus;
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

/** Messages sent from base-studio-code desktop → mobile */
export type TunnelServerMessage =
  | { type: 'auth_ok' }
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
  // ── Planner sync (see docs/planner-sync-protocol.md) ──
  | { type: 'plan_sync_manifest'; projects: PlanSyncManifestEntry[] }
  | { type: 'plan_sync_files'; projectId: string; files: Record<string, string> }
  | { type: 'plan_sync_ack'; projectId: string }
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

/** One project's manifest in a plan_sync_manifest frame (relpath → content hash). */
export type PlanSyncManifestEntry = {
  projectId: string;
  title: string;
  updatedAt: number;
  files: Record<string, string>;
};

/** Messages sent from mobile → base-studio-code desktop */
export type TunnelClientMessage =
  | { type: 'auth'; token: string; fcmToken?: string }
  // Refreshed FCM registration token (tokens rotate); updates the desktop's push
  // target mid-session. Allowed even while view-only.
  | { type: 'set_fcm_token'; fcmToken: string }
  | { type: 'pane_set_state'; paneId: string; state: PaneStreamingState }
  | { type: 'pane_focus'; paneId: string }
  | { type: 'pane_input'; paneId: string; data: string }
  | { type: 'pane_resize'; paneId: string; cols: number; rows: number }
  // ── Planner sync (mobile is the merge authority) ──
  | { type: 'plan_sync_manifest_request' }
  | { type: 'plan_sync_pull'; projectId: string; paths: string[] }
  | { type: 'plan_sync_push'; projectId: string; title: string; files: Record<string, string> }
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
