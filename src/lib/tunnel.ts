import { utf8ToBytes } from '@noble/hashes/utils.js';
import {
  PaneSize, PaneState, PaneStreamingState, PairingPayload, PlanSyncManifestEntry,
  TunnelClientMessage, TunnelConnectionState, TunnelServerMessage,
} from './types';
import { NoiseSession } from './tunnel/noise';
import { attachPaneSize, createPaneState } from './tunnel/paneSize';
import { buildPaneInput } from './tunnel/input';

export type TunnelCallbacks = {
  onConnectionStateChange: (state: TunnelConnectionState) => void;
  onPanesChange: (panes: Record<string, PaneState>) => void;
  onUserRequest: (paneId: string, prompt: string) => void;
  /** A planner-sync manifest arrived from the desktop (reconcile-on-connect). */
  onSyncManifest?: (projects: PlanSyncManifestEntry[]) => void;
};

type PendingRequest<T> = { resolve: (v: T) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

/** Maximum PTY output chars buffered per pane before oldest chars are dropped */
const OUTPUT_BUFFER_MAX = 50_000;

/**
 * How long to wait for the Noise handshake + auth_ok before giving up. A stale
 * saved pairing dials a room the desktop is no longer in, so no host ever
 * answers; without this the UI spins on "authenticating" forever.
 */
const CONNECT_TIMEOUT_MS = 12_000;

/** How long to wait for a plan_sync reply (files / ack) before rejecting. */
const SYNC_REQUEST_TIMEOUT_MS = 20_000;

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
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  private connectionState: TunnelConnectionState = 'disconnected';
  private panes: Record<string, PaneState> = {};
  // Latest desktop PTY size per pane. Buffered separately from `panes` because
  // `pane_size` can replay before the pane appears in `pane_list`; the cache is
  // applied at pane creation and on every subsequent frame.
  private paneSizes: Record<string, PaneSize> = {};
  private activePaneId: string | null = null;
  // In-flight planner-sync requests, keyed by projectId (resolved by files/ack frames).
  private pendingPulls = new Map<string, PendingRequest<Record<string, string>>>();
  private pendingPushes = new Map<string, PendingRequest<void>>();
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
    this.closeSocket();
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
    this.send(buildPaneInput(paneId, data));
  }

  sendResize(paneId: string, cols: number, rows: number) {
    this.send({ type: 'pane_resize', paneId, cols, rows });
  }

  getActivePaneId() { return this.activePaneId; }

  getPanes() { return this.panes; }

  private openSocket() {
    if (this.destroyed || !this.payload) return;
    // Tear down any prior socket FIRST so its stale event handlers can't fire
    // against this new attempt. That race was the reconnect bug: the old
    // socket's late onclose nulled the new `this.ws`, so send() dropped the
    // auth frame and the UI hung on "authenticating".
    this.closeSocket();
    this.handshakeDone = false;
    this.noise = null;
    this.setConnectionState('connecting');

    const base = this.payload.relayUrl.replace(/\/+$/, '');
    const url = `${base}/connect?room=${encodeURIComponent(this.payload.room)}&role=guest`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.failConnection('could not open WebSocket');
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    // Bound the handshake/auth: a stale room (host not present) never answers.
    this.connectTimer = setTimeout(() => {
      if (ws === this.ws && this.connectionState !== 'connected') {
        this.failConnection('timed out waiting for the desktop (saved pairing may be stale — rescan the QR)');
      }
    }, CONNECT_TIMEOUT_MS);

    // Every handler guards `ws === this.ws` so a superseded socket is inert.
    ws.onopen = () => {
      if (this.destroyed || ws !== this.ws || !this.payload) return;
      this.setConnectionState('authenticating');
      try {
        // hostPubKey is standard (padded) base64 of the desktop's X25519 key.
        const rs = b64decode(this.payload.hostPubKey);
        this.noise = new NoiseSession(rs);
        ws.send(toArrayBuffer(this.noise.startHandshake()));
      } catch {
        this.failConnection('handshake init failed');
      }
    };

    ws.onmessage = (e) => {
      if (this.destroyed || ws !== this.ws || !this.noise) return;
      // Relay control/errors (bad_role/host_taken/room_full) arrive as text.
      if (typeof e.data === 'string') {
        console.log('tunnel← relay text (error):', e.data);
        this.failConnection(`relay rejected: ${e.data}`);
        return;
      }
      try {
        const frame = new Uint8Array(e.data as ArrayBuffer);
        if (!this.handshakeDone) {
          // Desktop's handshake message 2 → enter transport, then send auth
          // (the psk) as the first encrypted app frame.
          this.noise.finishHandshake(frame);
          this.handshakeDone = true;
          console.log(`tunnel handshake complete (${frame.length}B msg2) → sending auth`);
          this.send({ type: 'auth', token: this.payload!.psk, fcmToken: this.fcmToken });
        } else {
          const msg = JSON.parse(utf8Decode(this.noise.decrypt(frame))) as TunnelServerMessage;
          this.handleMessage(msg);
        }
      } catch (err) {
        console.log('tunnel decode/handle error:', (err as Error)?.message ?? err);
        this.failConnection('decode error');
      }
    };

    ws.onerror = (ev) => {
      if (ws !== this.ws) return;
      console.log('tunnel ws error:', (ev as { message?: string })?.message ?? '(no message)');
      // onclose always fires after onerror; state is set there.
    };

    ws.onclose = (ev) => {
      if (ws !== this.ws) return; // superseded socket — ignore
      const c = ev as { code?: number; reason?: string };
      console.log(`tunnel ws closed code=${c?.code ?? '?'} reason=${c?.reason || '(none)'}`);
      this.clearConnectTimeout();
      this.ws = null;
      if (this.destroyed) return;
      // No auto-reconnect — drop to disconnected so the user can choose to
      // reconnect from the pairing screen.
      this.setConnectionState('disconnected');
    };
  }

  /** Fail any in-flight sync requests (e.g. on disconnect) so callers don't hang. */
  private rejectPendingSync(reason: string) {
    for (const p of this.pendingPulls.values()) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    for (const p of this.pendingPushes.values()) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    this.pendingPulls.clear();
    this.pendingPushes.clear();
  }

  // ── Planner sync transport (mobile is the merge authority) ──
  /** Ask the desktop for its planner manifest (kicks off reconcile-on-connect). */
  syncRequestManifest() {
    this.send({ type: 'plan_sync_manifest_request' });
  }

  /** Request specific files for a project; resolves with the desktop's contents. */
  syncPull(projectId: string, paths: string[]): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingPulls.delete(projectId);
        reject(new Error(`plan_sync_pull timed out (${projectId})`));
      }, SYNC_REQUEST_TIMEOUT_MS);
      this.pendingPulls.set(projectId, { resolve, reject, timer });
      this.send({ type: 'plan_sync_pull', projectId, paths });
    });
  }

  /** Push the agreed canonical map; resolves on the desktop's ack. */
  syncPush(projectId: string, title: string, files: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingPushes.delete(projectId);
        reject(new Error(`plan_sync_push timed out (${projectId})`));
      }, SYNC_REQUEST_TIMEOUT_MS);
      this.pendingPushes.set(projectId, { resolve, reject, timer });
      this.send({ type: 'plan_sync_push', projectId, title, files });
    });
  }

  /** Detach handlers from and close the current socket without emitting state. */
  private closeSocket() {
    this.rejectPendingSync('tunnel disconnected');
    this.clearConnectTimeout();
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try { ws.close(); } catch { /* already closing */ }
  }

  private clearConnectTimeout() {
    if (this.connectTimer != null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  /** Surface a handshake/transport failure and tear down (no auto-retry). */
  private failConnection(reason: string) {
    console.log(`tunnel connect failed: ${reason}`);
    this.closeSocket();
    this.handshakeDone = false;
    this.noise = null;
    if (!this.destroyed) this.setConnectionState('error');
  }

  /** Diagnostics: summarise every inbound (server→client) frame. */
  private logInbound(msg: TunnelServerMessage) {
    switch (msg.type) {
      case 'auth_ok':
        console.log('tunnel← auth_ok'); break;
      case 'pane_list':
        console.log(`tunnel← pane_list ids=${msg.panes.map((p) => p.id).join(',') || '(none)'}`); break;
      case 'pane_output':
        console.log(`tunnel← pane_output pane=${msg.paneId} bytes=${msg.data.length}`); break;
      case 'pane_size':
        console.log(`tunnel← pane_size pane=${msg.paneId} ${msg.cols}x${msg.rows}`); break;
      case 'session_state':
        console.log(`tunnel← session_state pane=${msg.paneId} status=${msg.status}`); break;
      case 'user_request':
        console.log(`tunnel← user_request pane=${msg.paneId}`); break;
      case 'plan_sync_manifest':
        console.log(`tunnel← plan_sync_manifest projects=${msg.projects.length}`); break;
      case 'plan_sync_files':
        console.log(`tunnel← plan_sync_files ${msg.projectId} files=${Object.keys(msg.files).length}`); break;
      case 'plan_sync_ack':
        console.log(`tunnel← plan_sync_ack ${msg.projectId}`); break;
    }
  }

  private handleMessage(msg: TunnelServerMessage) {
    this.logInbound(msg);
    switch (msg.type) {
      case 'auth_ok': {
        this.clearConnectTimeout();
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
            : createPaneState(desc, {
                active: desc.id === this.activePaneId,
                size: this.paneSizes[desc.id] ?? null, // apply any buffered size
                now: Date.now(),
              });
        }
        // Drop panes no longer in the list (and their buffered sizes)
        const live = new Set(msg.panes.map((p) => p.id));
        for (const id of Object.keys(next)) {
          if (!live.has(id)) { delete next[id]; delete this.paneSizes[id]; }
        }
        this.panes = next;
        this.emitPanes();
        break;
      }

      case 'pane_size': {
        // The phone adopts the desktop's grid; it never sends pane_resize back.
        const size: PaneSize = { cols: msg.cols, rows: msg.rows };
        this.paneSizes[msg.paneId] = size;
        const updated = attachPaneSize(this.panes, msg.paneId, size);
        if (updated !== this.panes) {
          this.panes = updated;
          this.emitPanes();
        }
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

      case 'plan_sync_manifest':
        this.cb.onSyncManifest?.(msg.projects);
        break;

      case 'plan_sync_files': {
        const p = this.pendingPulls.get(msg.projectId);
        if (p) { clearTimeout(p.timer); this.pendingPulls.delete(msg.projectId); p.resolve(msg.files); }
        break;
      }

      case 'plan_sync_ack': {
        const p = this.pendingPushes.get(msg.projectId);
        if (p) { clearTimeout(p.timer); this.pendingPushes.delete(msg.projectId); p.resolve(); }
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
    // Diagnostics: log every outbound frame so it can be correlated with the
    // desktop's logs (confirms we send pane_input to a real pane id with a \r).
    // `data` is shown JSON-escaped so control bytes (e.g. \r) are visible.
    const paneId = 'paneId' in msg ? msg.paneId : '-';
    const bytes = 'data' in msg ? msg.data.length : 0;
    const preview = 'data' in msg ? ` data=${JSON.stringify(msg.data)}` : '';
    const ct = this.noise.encrypt(utf8Encode(JSON.stringify(msg)));
    console.log(`tunnel→ ${msg.type} pane=${paneId} bytes=${bytes}${preview} cipher=${ct.length}B`);
    this.ws.send(toArrayBuffer(ct));
  }

  private setConnectionState(state: TunnelConnectionState) {
    if (this.connectionState !== state) console.log(`tunnel state=${state}`);
    this.connectionState = state;
    this.cb.onConnectionStateChange(state);
  }

  private emitPanes() {
    this.cb.onPanesChange({ ...this.panes });
  }
}
