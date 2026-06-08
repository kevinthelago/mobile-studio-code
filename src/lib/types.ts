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
  | { type: 'plan_sync_ack'; projectId: string };

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
  | { type: 'pane_set_state'; paneId: string; state: PaneStreamingState }
  | { type: 'pane_focus'; paneId: string }
  | { type: 'pane_input'; paneId: string; data: string }
  | { type: 'pane_resize'; paneId: string; cols: number; rows: number }
  // ── Planner sync (mobile is the merge authority) ──
  | { type: 'plan_sync_manifest_request' }
  | { type: 'plan_sync_pull'; projectId: string; paths: string[] }
  | { type: 'plan_sync_push'; projectId: string; title: string; files: Record<string, string> };

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
