import {
  PaneState, PaneStreamingState, TunnelClientMessage,
  TunnelConnectionState, TunnelPairing, TunnelServerMessage,
} from './types';
import { createInitiator, generateKeypair, type Split } from './noise/noise';
import { rng } from './noise/random';
import { base64ToBytes, openFrame, sealFrame, toBytes } from './noiseSession';

export type TunnelCallbacks = {
  onConnectionStateChange: (state: TunnelConnectionState) => void;
  onPanesChange: (panes: Record<string, PaneState>) => void;
  onUserRequest: (paneId: string, prompt: string) => void;
};

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
/** Maximum PTY output chars buffered per pane before oldest chars are dropped */
const OUTPUT_BUFFER_MAX = 50_000;

// Tagged tunnel logger. Helps debug pairing / reconnect / cert-pinning.
// Currently ON in all builds while we debug the tunnel; set to `__DEV__` once
// it's stable so release builds stay quiet. The auth token is never logged.
const TUNNEL_DEBUG = true;
export function tunnelLog(...args: unknown[]): void {
  if (TUNNEL_DEBUG) console.log('[tunnel]', ...args);
}

export class TunnelClient {
  private ws: WebSocket | null = null;
  private pairing: TunnelPairing | null = null;
  /** Desktop's Noise static public key (decoded from the QR's base64 hostPubKey). */
  private remoteStatic: Uint8Array | null = null;
  private fcmToken: string | undefined;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  // Per-socket Noise state — reset on every (re)connect, since each relay session is a
  // fresh handshake. `tx` is null until the handshake completes; sends are gated on it.
  private initiator: ReturnType<typeof createInitiator> | null = null;
  private tx: Split | null = null;

  private connectionState: TunnelConnectionState = 'disconnected';
  private panes: Record<string, PaneState> = {};
  private activePaneId: string | null = null;
  private readonly cb: TunnelCallbacks;

  constructor(callbacks: TunnelCallbacks) {
    this.cb = callbacks;
  }

  /** Pair + connect to the desktop through the relay described by the QR payload. */
  connect(pairing: TunnelPairing, fcmToken?: string) {
    this.pairing = pairing;
    this.remoteStatic = base64ToBytes(pairing.hostPubKey);
    this.fcmToken = fcmToken;
    this.destroyed = false;
    this.reconnectAttempt = 0;
    tunnelLog('connect requested', { relay: pairing.relayUrl, room: pairing.room, hasFcm: !!fcmToken });
    this.openSocket();
  }

  /** `wss://relay…/connect?room=<room>&role=guest` — the mobile is always a guest. */
  private relayConnectUrl(): string {
    const base = this.pairing!.relayUrl.replace(/\/+$/, '');
    return `${base}/connect?room=${encodeURIComponent(this.pairing!.room)}&role=guest`;
  }

  disconnect() {
    tunnelLog('disconnect requested');
    this.destroyed = true;
    this.clearReconnectTimer();
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
    if (this.destroyed || !this.pairing || !this.remoteStatic) return;
    this.setConnectionState('connecting');
    // Fresh Noise session per socket.
    this.initiator = null;
    this.tx = null;
    const url = this.relayConnectUrl();
    try {
      tunnelLog('opening socket', { url });
      this.ws = new WebSocket(url);
    } catch (e) {
      tunnelLog('socket construction failed', e);
      this.scheduleReconnect();
      return;
    }
    // Frames are raw Noise ciphertext; receive them as ArrayBuffers, not blobs.
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      if (this.destroyed || !this.ws) return;
      tunnelLog('socket open → Noise handshake (msg1)');
      this.setConnectionState('authenticating');
      this.reconnectAttempt = 0;
      // Begin the Noise IK handshake: send msg1 (e, es, s, ss) as a binary frame.
      // The desktop (responder) answers with msg2; auth follows inside the session.
      try {
        this.initiator = createInitiator(generateKeypair(rng), this.remoteStatic!, rng);
        this.ws.send(this.initiator.writeMessage1());
      } catch (e) {
        tunnelLog('handshake init failed', e);
        this.ws.close();
      }
    };

    this.ws.onmessage = (e) => {
      if (this.destroyed) return;
      const data = e.data as ArrayBuffer | string;
      if (typeof data === 'string') return; // relay only ferries binary frames
      this.onBinary(toBytes(data));
    };

    this.ws.onerror = (e) => {
      // onclose always fires after onerror; reconnect logic lives there.
      tunnelLog('socket error', (e as unknown as { message?: string })?.message ?? '');
    };

    this.ws.onclose = () => {
      if (this.destroyed) return;
      tunnelLog('socket closed');
      this.ws = null;
      this.initiator = null;
      this.tx = null;
      this.setConnectionState('disconnected');
      this.scheduleReconnect();
    };
  }

  /** A binary frame: either Noise msg2 (completing the handshake) or, once the
   *  session is up, an encrypted application message. A crypto/parse failure tears
   *  the socket down so a clean reconnect re-handshakes. */
  private onBinary(frame: Uint8Array) {
    try {
      if (!this.tx) {
        if (!this.initiator) return;
        // msg2 (e, ee, se) → transport ciphers. Then authenticate inside the session.
        tunnelLog('handshake msg2 → transport up, sending auth');
        this.tx = this.initiator.readMessage2(frame).transport;
        this.send({ type: 'auth', token: this.pairing!.psk, fcmToken: this.fcmToken });
        return;
      }
      this.handleMessage(openFrame<TunnelServerMessage>(this.tx.recv, frame));
    } catch (e) {
      tunnelLog('session frame error — dropping socket', e);
      this.ws?.close();
    }
  }

  private handleMessage(msg: TunnelServerMessage) {
    switch (msg.type) {
      case 'auth_ok': {
        tunnelLog('auth accepted');
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
        tunnelLog('pane_list', { count: msg.panes.length });
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
    // Gated on the Noise session being established — every app frame is encrypted.
    if (this.ws?.readyState === WebSocket.OPEN && this.tx) {
      try {
        this.ws.send(sealFrame(this.tx.send, msg));
      } catch (e) {
        tunnelLog('send failed — dropping socket', e);
        this.ws.close();
      }
    }
  }

  private setConnectionState(state: TunnelConnectionState) {
    if (this.connectionState !== state) tunnelLog('state →', state);
    this.connectionState = state;
    this.cb.onConnectionStateChange(state);
  }

  private emitPanes() {
    this.cb.onPanesChange({ ...this.panes });
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    tunnelLog('reconnect scheduled', { inMs: delay, attempt: this.reconnectAttempt + 1 });
    this.reconnectAttempt += 1;
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
