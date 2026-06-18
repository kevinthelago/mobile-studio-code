export type ChatRole = 'user' | 'assistant';

// ── Plan bundle types (re-exported for cross-module convenience) ─────────────
export type {
  PlanFileKey,
  PlanFileEntry,
  PlanProject,
  PlanBundle,
  PlanSyncManifest,
  ProjectSyncInfo,
  ReconcileResult,
  PlanConflict,
  ConflictResolution,
  PlanSyncStatus,
} from './planBundle/types';

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

/** Messages sent from base-studio-code desktop → mobile */
export type TunnelServerMessage =
  | { type: 'auth_ok' }
  | { type: 'pane_list'; panes: PaneDescriptor[] }
  | { type: 'pane_output'; paneId: string; data: string; coarse: boolean }
  // Desktop PTY grid size for a pane. Sent on pairing replay and on PTY resize.
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
  // ── Plan sync (planBundle wire names — symmetric manifest exchange) ────────
  /** Desktop's lightweight project manifest, sent on connect for reconciliation. */
  | { type: 'plan_sync_manifest'; manifest: import('./planBundle/types').PlanSyncManifest }
  /** Desktop pushing a plan bundle to mobile (either proactive or fulfilling plan_request). */
  | { type: 'plan_pull'; bundle: import('./planBundle/types').PlanBundle }
  /** Desktop confirmed it stored a plan bundle we pushed. */
  | { type: 'plan_ack'; projectId: string }
  // ── Phase-3: planning pipeline coordination (PT1) ──
  | { type: 'plan_status'; projectId: string; phase: string; status: 'idle' | 'running' | 'paused' | 'done' | 'error'; updatedAt: number }
  | { type: 'plan_event'; projectId: string; event: string; payload: Record<string, unknown> }
  // ── Phase-3: fleet coordination (F1) ──
  | { type: 'fleet_status'; streams: FleetStreamStatus[] }
  | { type: 'coord_event'; streamId: string; kind: string; payload: Record<string, unknown> }
  // ── Phase-3: automation (A1) ──
  | { type: 'automation_list'; automations: AutomationSummary[] }
  | { type: 'automation_run_event'; automationId: string; event: string; payload: Record<string, unknown> }
  // ── Phase-3: MCP server visibility (M1) ──
  | { type: 'mcp_server_list'; servers: McpServerInfo[] }
  | { type: 'mcp_tool_list'; serverId: string; tools: McpToolInfo[] };

/** Messages sent from mobile → base-studio-code desktop */
export type TunnelClientMessage =
  | { type: 'auth'; token: string; fcmToken?: string }
  | { type: 'pane_set_state'; paneId: string; state: PaneStreamingState }
  | { type: 'pane_focus'; paneId: string }
  | { type: 'pane_input'; paneId: string; data: string }
  | { type: 'pane_resize'; paneId: string; cols: number; rows: number }
  // ── Plan sync (planBundle wire names — symmetric manifest exchange) ────────
  /** Mobile's lightweight project manifest, sent on connect for reconciliation. */
  | { type: 'plan_sync_manifest'; manifest: import('./planBundle/types').PlanSyncManifest }
  /** Mobile pushing a plan bundle to the desktop hub. */
  | { type: 'plan_push'; bundle: import('./planBundle/types').PlanBundle }
  /** Mobile requesting the desktop to send a project (or specific files). */
  | { type: 'plan_request'; projectId: string; fileKeys?: string[] }
  // ── Phase-3: planning pipeline coordination (PT1) ──
  // Named plan_pipeline to distinguish from plan_request (file-sync) above.
  | { type: 'plan_pipeline'; projectId: string; action: 'run' | 'pause' | 'resume' | 'cancel' }
  | { type: 'plan_directive'; projectId: string; text: string }
  // ── Phase-3: fleet coordination (F1) ──
  | { type: 'fleet_directive'; streamId: string; text: string }
  | { type: 'coord_ask_response'; questionId: string; answer: string }
  // ── Phase-3: automation (A1) ──
  | { type: 'automation_toggle'; automationId: string; enabled: boolean }
  | { type: 'automation_trigger'; automationId: string; params: Record<string, unknown> }
  // ── Phase-3: MCP server visibility (M1) ──
  | { type: 'mcp_request_list' };

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
 * T3 — Per-leg pairing diagnostics. Each leg is populated as the connect
 * sequence progresses; null means the leg has not been attempted yet.
 * 'ok' = succeeded, 'fail' = failed, 'pending' = in progress.
 */
export type PairingLegStatus = 'pending' | 'ok' | 'fail';

export type PairingDiagnostics = {
  /** TCP/TLS connect + WebSocket upgrade to the relay. */
  relayReach: PairingLegStatus | null;
  /** Relay accepted our room-join request (no bad_role / room_full error). */
  roomJoin: PairingLegStatus | null;
  /** Noise IK handshake (msg1 sent, msg2 received and validated). */
  handshake: PairingLegStatus | null;
  /** Desktop accepted our auth frame and replied auth_ok. */
  auth: PairingLegStatus | null;
  /** Human-readable summary of the last failure (if any). */
  failReason: string | null;
};

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

/** F1 — one stream's status in a fleet_status frame. */
export type FleetStreamStatus = {
  streamId: string;
  label: string;
  status: 'idle' | 'running' | 'paused' | 'blocked' | 'done' | 'error';
  currentIssue: string | null;
  updatedAt: number;
};

/** A1 — one automation in an automation_list frame. */
export type AutomationSummary = {
  id: string;
  name: string;
  enabled: boolean;
  lastRunAt: number | null;
  status: 'idle' | 'running' | 'error';
};

/** M1 — one MCP server in an mcp_server_list frame. */
export type McpServerInfo = {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
  transport: 'stdio' | 'sse' | 'websocket';
};

/** M1 — one tool in an mcp_tool_list frame. */
export type McpToolInfo = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
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

/** One project entry in the peer's sync manifest — sent over the Noise channel. */
export type PlanSyncManifestEntry = {
  projectId: string;
  title: string;
  updatedAt: number;
  /** relpath → SHA-like hash; used to decide what to pull. */
  files: Record<string, string>;
};
