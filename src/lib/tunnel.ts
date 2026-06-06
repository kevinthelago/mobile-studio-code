import {
  PaneState, PaneStreamingState, TunnelClientMessage,
  TunnelConnectionState, TunnelServerMessage,
} from './types';

export type TunnelCallbacks = {
  onConnectionStateChange: (state: TunnelConnectionState) => void;
  onPanesChange: (panes: Record<string, PaneState>) => void;
  onUserRequest: (paneId: string, prompt: string) => void;
};

/** Maximum PTY output chars buffered per pane before oldest chars are dropped */
const OUTPUT_BUFFER_MAX = 50_000;

export class TunnelClient {
  private ws: WebSocket | null = null;
  private url = '';
  private token = '';
  private fcmToken: string | undefined;
  private destroyed = false;

  private connectionState: TunnelConnectionState = 'disconnected';
  private panes: Record<string, PaneState> = {};
  private activePaneId: string | null = null;
  private readonly cb: TunnelCallbacks;

  constructor(callbacks: TunnelCallbacks) {
    this.cb = callbacks;
  }

  connect(url: string, token: string, fcmToken?: string) {
    this.url = url;
    this.token = token;
    this.fcmToken = fcmToken;
    this.destroyed = false;
    this.openSocket();
  }

  disconnect() {
    this.destroyed = true;
    this.ws?.close();
    this.ws = null;
    this.setConnectionState('disconnected');
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

  private openSocket() {
    if (this.destroyed) return;
    this.setConnectionState('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      // No auto-reconnect — surface the failure and let the user retry.
      this.setConnectionState('error');
      return;
    }

    this.ws.onopen = () => {
      if (this.destroyed) return;
      this.setConnectionState('authenticating');
      this.send({ type: 'auth', token: this.token, fcmToken: this.fcmToken });
    };

    this.ws.onmessage = (e) => {
      if (this.destroyed) return;
      try {
        const msg = JSON.parse(e.data as string) as TunnelServerMessage;
        this.handleMessage(msg);
      } catch { /* malformed frame — ignore */ }
    };

    this.ws.onerror = () => {
      // onclose always fires after onerror; state is set there.
    };

    this.ws.onclose = () => {
      if (this.destroyed) return;
      this.ws = null;
      // No auto-reconnect — drop to disconnected so the user can choose to
      // reconnect from the pairing screen.
      this.setConnectionState('disconnected');
    };
  }

  private handleMessage(msg: TunnelServerMessage) {
    switch (msg.type) {
      case 'auth_ok': {
        this.setConnectionState('connected');
        // Re-assert streaming state for the active pane after reconnect
        if (this.activePaneId) {
          this.send({ type: 'pane_set_state', paneId: this.activePaneId, state: 'streaming' });
          this.send({ type: 'pane_focus', paneId: this.activePaneId });
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
}
