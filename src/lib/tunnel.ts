import {
  AutomationSummary, FleetStreamStatus, McpServerInfo, McpToolInfo,
  PairingDiagnostics, PairingLegStatus, PairingPayload,
  PaneState, PaneStreamingState, TunnelClientMessage,
  TunnelConnectionState, TunnelServerMessage,
} from './types';
import type { PlanBundle, PlanSyncManifest } from './planBundle/types';

export type TunnelCallbacks = {
  onConnectionStateChange: (state: TunnelConnectionState) => void;
  onPanesChange: (panes: Record<string, PaneState>) => void;
  onUserRequest: (paneId: string, prompt: string) => void;
  // ── T3 — per-leg diagnostics ────────────────────────────────────────────
  onDiagnosticsChange?: (diag: PairingDiagnostics) => void;
  // ── Plan sync callbacks (planBundle protocol) ───────────────────────────
  /** Return the mobile's current sync manifest just before it is sent. */
  getLocalPlanManifest?: () => Promise<PlanSyncManifest>;
  /** Desktop sent its sync manifest — mobile reconciles from here. */
  onDesktopPlanManifest?: (manifest: PlanSyncManifest, now: number) => void;
  /** Desktop pushed a plan bundle to mobile (fulfilling a plan_request or proactive). */
  onPlanPull?: (bundle: PlanBundle) => void;
  /** Desktop acknowledged a plan bundle we pushed. */
  onPlanAck?: (projectId: string) => void;
  // ── Phase-3 callbacks ───────────────────────────────────────────────────
  onFleetStatus?: (streams: FleetStreamStatus[]) => void;
  onCoordEvent?: (streamId: string, kind: string, payload: Record<string, unknown>) => void;
  onAutomationList?: (automations: AutomationSummary[]) => void;
  onAutomationRunEvent?: (automationId: string, event: string, payload: Record<string, unknown>) => void;
  onMcpServerList?: (servers: McpServerInfo[]) => void;
  onMcpToolList?: (serverId: string, tools: McpToolInfo[]) => void;
};

// T5b — exponential backoff constants
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_FACTOR = 2;

/** Maximum PTY output chars buffered per pane before oldest chars are dropped */
const OUTPUT_BUFFER_MAX = 50_000;

const NULL_DIAGNOSTICS: PairingDiagnostics = {
  relayReach: null, roomJoin: null, handshake: null, auth: null, failReason: null,
};

export class TunnelClient {
  private ws: WebSocket | null = null;
  private payload: PairingPayload | null = null;
  private fcmToken: string | undefined;
  private backoffMs = BACKOFF_BASE_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  private connectionState: TunnelConnectionState = 'disconnected';
  private panes: Record<string, PaneState> = {};
  private activePaneId: string | null = null;
  private diagnostics: PairingDiagnostics = { ...NULL_DIAGNOSTICS };
  private readonly cb: TunnelCallbacks;

  constructor(callbacks: TunnelCallbacks) {
    this.cb = callbacks;
  }

  connect(payload: PairingPayload, fcmToken?: string) {
    this.payload = payload;
    if (fcmToken !== undefined) this.fcmToken = fcmToken;
    this.destroyed = false;
    this.backoffMs = BACKOFF_BASE_MS;
    this.clearReconnectTimer();
    this.resetDiagnostics();
    this.openSocket();
  }

  disconnect() {
    this.destroyed = true;
    this.clearReconnectTimer();
    this.ws?.close();
    this.ws = null;
    this.setConnectionState('disconnected');
  }

  /** T6b — update FCM token; stored and included in next auth frame. */
  updateFcmToken(token: string) {
    this.fcmToken = token;
  }

  focusPane(paneId: string) {
    if (this.activePaneId && this.activePaneId !== paneId) {
      this.setPaneStreamingState(this.activePaneId, 'minimized');
      this.send({ type: 'pane_set_state', paneId: this.activePaneId, state: 'minimized' });
    }
    this.activePaneId = paneId;
    this.setPaneStreamingState(paneId, 'streaming');
    this.send({ type: 'pane_set_state', paneId, state: 'streaming' });
    this.send({ type: 'pane_focus', paneId });
  }

  /** Transitions a pane to minimized without switching focus to another pane. */
  minimisePane(paneId: string) {
    this.setPaneStreamingState(paneId, 'minimized');
    this.send({ type: 'pane_set_state', paneId, state: 'minimized' });
    if (this.activePaneId === paneId) this.activePaneId = null;
  }

  sendInput(paneId: string, data: string) {
    this.send({ type: 'pane_input', paneId, data });
  }

  sendResize(paneId: string, cols: number, rows: number) {
    this.send({ type: 'pane_resize', paneId, cols, rows });
  }

  getActivePaneId() { return this.activePaneId; }

  getPanes() { return this.panes; }

  getDiagnostics(): PairingDiagnostics { return { ...this.diagnostics }; }

  /** Send any client message (used for Phase-3 senders). */
  sendMsg(msg: TunnelClientMessage) { this.send(msg); }

  // ── Plan sync public API (planBundle protocol) ────────────────────────────

  sendPlanSyncManifest(manifest: PlanSyncManifest) {
    this.send({ type: 'plan_sync_manifest', manifest });
  }

  sendPlanPush(bundle: PlanBundle) {
    this.send({ type: 'plan_push', bundle });
  }

  sendPlanRequest(projectId: string, fileKeys?: string[]) {
    this.send({ type: 'plan_request', projectId, fileKeys });
  }

  private openSocket() {
    if (this.destroyed || !this.payload) return;
    this.setConnectionState('connecting');
    this.setDiagLeg('relayReach', 'pending');
    const wsUrl = `${this.payload.relayUrl}/room/${this.payload.room}`;
    try {
      this.ws = new WebSocket(wsUrl);
    } catch {
      this.setDiagFailed('relayReach', 'WebSocket constructor threw');
      this.scheduleReconnect(false);
      return;
    }

    this.ws.onopen = () => {
      if (this.destroyed) return;
      this.setDiagLeg('relayReach', 'ok');
      this.setDiagLeg('roomJoin', 'ok');
      this.setConnectionState('authenticating');
      this.setDiagLeg('auth', 'pending');
      this.backoffMs = BACKOFF_BASE_MS;
      this.send({ type: 'auth', token: this.payload!.psk, fcmToken: this.fcmToken });
    };

    this.ws.onmessage = (e) => {
      if (this.destroyed) return;
      try {
        const msg = JSON.parse(e.data as string) as TunnelServerMessage;
        this.handleMessage(msg);
      } catch { /* malformed frame — ignore */ }
    };

    this.ws.onerror = () => {
      // onclose always fires after onerror; reconnect logic lives there
    };

    this.ws.onclose = () => {
      if (this.destroyed) return;
      this.ws = null;
      this.setConnectionState('disconnected');
      this.scheduleReconnect(false);
    };
  }

  private handleMessage(msg: TunnelServerMessage) {
    switch (msg.type) {
      case 'auth_ok': {
        this.setDiagLeg('auth', 'ok');
        this.setConnectionState('connected');
        // Re-assert streaming state for the active pane after reconnect
        if (this.activePaneId) {
          this.send({ type: 'pane_set_state', paneId: this.activePaneId, state: 'streaming' });
          this.send({ type: 'pane_focus', paneId: this.activePaneId });
        }
        // Kick off plan sync: fetch local manifest and send to desktop.
        if (this.cb.getLocalPlanManifest) {
          this.cb.getLocalPlanManifest().then((manifest) => {
            this.sendPlanSyncManifest(manifest);
          }).catch((e) => {
            console.warn('[planSync] failed to build local manifest', e);
          });
        }
        break;
      }

      case 'pane_list': {
        const next: Record<string, PaneState> = { ...this.panes };
        for (const desc of msg.panes) {
          next[desc.id] = next[desc.id]
            ? { ...next[desc.id], descriptor: desc }
            : {
                descriptor: desc,
                streamingState: desc.id === this.activePaneId ? 'streaming' : 'minimized',
                outputBuffer: '',
                sessionState: null,
                ptySize: null,
                hasUserRequest: false,
                lastUserRequestAt: null,
                lastActivityAt: Date.now(),
              };
        }
        // Drop panes no longer in the list
        const live = new Set(msg.panes.map((p) => p.id));
        for (const id of Object.keys(next)) {
          if (!live.has(id)) delete next[id];
        }
        this.panes = next;
        this.emitPanes();
        break;
      }

      case 'pane_output': {
        const pane = this.panes[msg.paneId];
        if (!pane) return;
        let buf = pane.outputBuffer + msg.data;
        if (buf.length > OUTPUT_BUFFER_MAX) buf = buf.slice(buf.length - OUTPUT_BUFFER_MAX);
        this.panes = {
          ...this.panes,
          [msg.paneId]: { ...pane, outputBuffer: buf, lastActivityAt: Date.now() },
        };
        this.emitPanes();
        break;
      }

      case 'pane_size': {
        const pane = this.panes[msg.paneId];
        if (!pane) return;
        this.panes = {
          ...this.panes,
          [msg.paneId]: { ...pane, ptySize: { cols: msg.cols, rows: msg.rows } },
        };
        this.emitPanes();
        break;
      }

      case 'session_state': {
        const pane = this.panes[msg.paneId];
        if (!pane) return;
        this.panes = {
          ...this.panes,
          [msg.paneId]: {
            ...pane,
            sessionState: {
              paneId: msg.paneId,
              status: msg.status,
              currentTask: msg.currentTask,
              lastActivity: msg.lastActivity,
              prompt: msg.prompt,
            },
            lastActivityAt: Date.now(),
          },
        };
        this.emitPanes();
        break;
      }

      case 'user_request': {
        const pane = this.panes[msg.paneId];
        if (!pane) return;
        const now = Date.now();
        this.panes = {
          ...this.panes,
          [msg.paneId]: {
            ...pane,
            hasUserRequest: true,
            lastUserRequestAt: now,
            lastActivityAt: now,
            sessionState: pane.sessionState
              ? { ...pane.sessionState, status: 'awaiting_input', prompt: msg.prompt }
              : null,
          },
        };
        this.emitPanes();
        this.cb.onUserRequest(msg.paneId, msg.prompt);
        break;
      }

      case 'plan_sync_manifest': {
        this.cb.onDesktopPlanManifest?.(msg.manifest, Date.now());
        break;
      }

      case 'plan_pull': {
        this.cb.onPlanPull?.(msg.bundle);
        break;
      }

      case 'plan_ack': {
        this.cb.onPlanAck?.(msg.projectId);
        break;
      }

      // ── Phase-3 message handling ──────────────────────────────────────────
      case 'fleet_status':
        this.cb.onFleetStatus?.(msg.streams);
        break;
      case 'coord_event':
        this.cb.onCoordEvent?.(msg.streamId, msg.kind, msg.payload);
        break;
      case 'automation_list':
        this.cb.onAutomationList?.(msg.automations);
        break;
      case 'automation_run_event':
        this.cb.onAutomationRunEvent?.(msg.automationId, msg.event, msg.payload);
        break;
      case 'mcp_server_list':
        this.cb.onMcpServerList?.(msg.servers);
        break;
      case 'mcp_tool_list':
        this.cb.onMcpToolList?.(msg.serverId, msg.tools);
        break;
      case 'plan_status':
      case 'plan_event':
        // Informational; consumers that need them register callbacks directly.
        break;
    }
  }

  private setPaneStreamingState(paneId: string, state: PaneStreamingState) {
    const pane = this.panes[paneId];
    if (!pane) return;
    this.panes = { ...this.panes, [paneId]: { ...pane, streamingState: state } };
    this.emitPanes();
  }

  private send(msg: TunnelClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private setConnectionState(state: TunnelConnectionState) {
    this.connectionState = state;
    this.cb.onConnectionStateChange(state);
  }

  private emitPanes() {
    this.cb.onPanesChange({ ...this.panes });
  }

  private resetDiagnostics() {
    this.diagnostics = { ...NULL_DIAGNOSTICS };
    this.cb.onDiagnosticsChange?.({ ...this.diagnostics });
  }

  private setDiagLeg(leg: keyof Omit<PairingDiagnostics, 'failReason'>, status: PairingLegStatus) {
    this.diagnostics = { ...this.diagnostics, [leg]: status };
    this.cb.onDiagnosticsChange?.({ ...this.diagnostics });
  }

  private setDiagFailed(leg: keyof Omit<PairingDiagnostics, 'failReason'>, reason: string) {
    this.diagnostics = { ...this.diagnostics, [leg]: 'fail' as PairingLegStatus, failReason: reason };
    this.cb.onDiagnosticsChange?.({ ...this.diagnostics });
  }

  // T5b — stale=true surfaces error (room gone); stale=false schedules backoff reconnect
  private scheduleReconnect(stale: boolean) {
    if (stale) {
      this.setConnectionState('error');
      return;
    }
    this.clearReconnectTimer();
    const delay = Math.min(this.backoffMs, BACKOFF_MAX_MS);
    this.backoffMs = Math.min(this.backoffMs * BACKOFF_FACTOR, BACKOFF_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
