import { utf8ToBytes } from '@noble/hashes/utils.js';
import {
  PaneState, PaneStreamingState, PairingPayload, TunnelClientMessage,
  TunnelConnectionState, TunnelServerMessage,
} from './types';
import { NoiseSession } from './tunnel/noise';

export type TunnelCallbacks = {
  onConnectionStateChange: (state: TunnelConnectionState) => void;
  onPanesChange: (panes: Record<string, PaneState>) => void;
  onUserRequest: (paneId: string, prompt: string) => void;
};

/** Maximum PTY output chars buffered per pane before oldest chars are dropped */
const OUTPUT_BUFFER_MAX = 50_000;

/** Copy a Uint8Array's exact bytes into a standalone ArrayBuffer for ws.send. */
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Decode standard (padded, +/) base64 → bytes. hostPubKey arrives this way. */
function b64decode(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array((clean.length * 6) >> 3);
  let bits = 0, val = 0, oi = 0;
  for (const ch of clean) {
    val = (val << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; out[oi++] = (val >> bits) & 0xff; }
  }
  return out.subarray(0, oi);
}

/** Decode a UTF-8 byte array to a JS string (handles multi-byte sequences). */
function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b < 0xf0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    } else {
      const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const c = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    }
  }
  return out;
}

const utf8Encode = utf8ToBytes;

export class TunnelClient {
  private ws: WebSocket | null = null;
  private payload: PairingPayload | null = null;
  private fcmToken: string | undefined;
  private destroyed = false;
  private noise: NoiseSession | null = null;
  private handshakeDone = false;

  private connectionState: TunnelConnectionState = 'disconnected';
  private panes: Record<string, PaneState> = {};
  private activePaneId: string | null = null;
  private readonly cb: TunnelCallbacks;

  constructor(callbacks: TunnelCallbacks) {
    this.cb = callbacks;
  }

  connect(payload: PairingPayload, fcmToken?: string) {
    this.payload = payload;
    this.fcmToken = fcmToken;
    this.destroyed = false;
    this.noise = null;
    this.handshakeDone = false;
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
    if (this.destroyed || !this.payload) return;
    this.setConnectionState('connecting');

    const base = this.payload.relayUrl.replace(/\/+$/, '');
    const url = `${base}/connect?room=${encodeURIComponent(this.payload.room)}&role=guest`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.setConnectionState('error');
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      if (this.destroyed || !this.payload) return;
      this.setConnectionState('authenticating');
      try {
        // hostPubKey is standard (padded) base64 of the desktop's X25519 key.
        const rs = b64decode(this.payload.hostPubKey);
        this.noise = new NoiseSession(rs);
        ws.send(toArrayBuffer(this.noise.startHandshake()));
      } catch {
        this.fail(ws);
      }
    };

    ws.onmessage = (e) => {
      if (this.destroyed || !this.noise) return;
      // Relay control/errors (bad_role/host_taken/room_full) arrive as text.
      if (typeof e.data === 'string') {
        this.fail(ws);
        return;
      }
      try {
        const frame = new Uint8Array(e.data as ArrayBuffer);
        if (!this.handshakeDone) {
          // Desktop's handshake message 2 → enter transport, then send auth
          // (the psk) as the first encrypted app frame.
          this.noise.finishHandshake(frame);
          this.handshakeDone = true;
          this.send({ type: 'auth', token: this.payload!.psk, fcmToken: this.fcmToken });
        } else {
          const msg = JSON.parse(utf8Decode(this.noise.decrypt(frame))) as TunnelServerMessage;
          this.handleMessage(msg);
        }
      } catch {
        this.fail(ws);
      }
    };

    ws.onerror = () => {
      // onclose always fires after onerror; state is set there.
    };

    ws.onclose = () => {
      if (this.destroyed) return;
      this.ws = null;
      // No auto-reconnect — drop to disconnected so the user can choose to
      // reconnect from the pairing screen.
      this.setConnectionState('disconnected');
    };
  }

  /** Surface a handshake/transport failure and close (no auto-retry). */
  private fail(ws: WebSocket) {
    this.setConnectionState('error');
    try { ws.close(); } catch { /* already closing */ }
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
    if (!this.noise || !this.handshakeDone) return;
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const ct = this.noise.encrypt(utf8Encode(JSON.stringify(msg)));
    this.ws.send(toArrayBuffer(ct));
  }

  private setConnectionState(state: TunnelConnectionState) {
    this.connectionState = state;
    this.cb.onConnectionStateChange(state);
  }

  private emitPanes() {
    this.cb.onPanesChange({ ...this.panes });
  }
}
