import { utf8ToBytes } from '@noble/hashes/utils.js';
import {
  PaneSize, PaneState, PaneStreamingState, PairingPayload, PlanSyncManifestEntry,
  TunnelClientMessage, TunnelConnectionState, TunnelServerMessage,
} from './types';

/** A server→phone frame narrowed to one `type` (e.g. PlanFrame<'plan_state'>). */
type PlanFrame<T extends TunnelServerMessage['type']> = Extract<TunnelServerMessage, { type: T }>;
import { NoiseSession } from './tunnel/noise';
import { attachPaneSize, createPaneState } from './tunnel/paneSize';
import { buildPaneInput } from './tunnel/input';
import {
  TunnelLifecycleStatus, decideReconnect, deriveLifecycleStatus,
} from './tunnel/reconnect';

export type TunnelCallbacks = {
  onConnectionStateChange: (state: TunnelConnectionState) => void;
  /** Coarse derived status for the UI banner: connecting/connected/reconnecting/offline (#217). */
  onLifecycleChange?: (status: TunnelLifecycleStatus) => void;
  onPanesChange: (panes: Record<string, PaneState>) => void;
  onUserRequest: (paneId: string, prompt: string) => void;
  /** A planner-sync manifest arrived from the desktop (reconcile-on-connect). */
  onSyncManifest?: (projects: PlanSyncManifestEntry[]) => void;
  // ── Live planning session (read-only mirror; replayed on connect, #1245) ──
  /** Full live-planning snapshot — replaces the mirrored project state wholesale. */
  onPlanState?: (frame: PlanFrame<'plan_state'>) => void;
  /** Cheap header (active stage + status label) — replayed on connect. */
  onPlanStatus?: (frame: PlanFrame<'plan_status'>) => void;
  /** Transient planning delta — fire-and-forget, applied incrementally. */
  onPlanEvent?: (frame: PlanFrame<'plan_event'>) => void;
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
  // `destroyed` doubles as the deliberate-disconnect flag: disconnect() sets it,
  // connect() clears it, and the reconnect policy never redials while it's set.
  private destroyed = false;
  private noise: NoiseSession | null = null;
  private handshakeDone = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  // ── Auto-reconnect bookkeeping (#217; policy lives in tunnel/reconnect.ts) ──
  /** auth_ok reached at least once this connect() session → drops auto-redial. */
  private everConnected = false;
  /** Retries burned since the last successful auth (drives the backoff). */
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLifecycle: TunnelLifecycleStatus | null = null;

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
    this.everConnected = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.openSocket();
  }

  disconnect() {
    this.destroyed = true;
    this.clearReconnectTimer();
    this.closeSocket();
    this.setConnectionState('disconnected');
  }

  /**
   * Redial immediately if a session dropped (e.g. on app foreground, where a
   * backgrounded iOS app's armed backoff timer may never have fired). No-op
   * when the user disconnected, the session never established, or a socket
   * attempt is already in flight — a socket that silently died in the
   * background still reports 'connected' here; its onclose fires shortly after
   * resume and takes the normal drop path instead.
   */
  reconnectNow() {
    if (this.destroyed || !this.payload) return;
    if (this.reconnectTimer != null) {
      this.clearReconnectTimer();
      this.openSocket();
      return;
    }
    const inFlight = this.connectionState === 'connected'
      || this.connectionState === 'connecting'
      || this.connectionState === 'authenticating';
    if (!inFlight && this.everConnected) this.openSocket();
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
    // Diagnostics: validate the QR encoding at runtime — hostPubKey must decode to
    // 32 bytes (standard base64) and psk must be 32 bytes (64 hex chars). A wrong
    // base64 variant or psk encoding shows up here before the handshake even runs.
    try {
      const pk = b64decode(this.payload.hostPubKey);
      const pskBytes = this.payload.psk.replace(/[^0-9a-fA-F]/g, '').length / 2;
      console.log(`tunnel pairing: relay=${base} room.len=${this.payload.room.length} hostPubKey=${pk.length}B psk=${this.payload.psk.length}hex(${pskBytes}B) → dial ${url}`);
      if (pk.length !== 32) console.log(`tunnel WARN: hostPubKey decoded to ${pk.length}B (expected 32) — wrong base64 variant?`);
      if (pskBytes !== 32) console.log(`tunnel WARN: psk is ${pskBytes}B (expected 32 / 64 hex chars)`);
    } catch (e) { console.log('tunnel pairing decode check failed:', (e as Error)?.message); }
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
        void this.failWithDiagnosis(ws);
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
        const msg1 = this.noise.startHandshake();
        ws.send(toArrayBuffer(msg1));
        console.log(`tunnel→ handshake msg1 sent (${msg1.length}B), awaiting msg2`);
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
      this.handshakeDone = false;
      this.noise = null;
      if (this.destroyed) return;
      // An established session auto-reconnects with backoff; a first connect
      // that never established drops to disconnected so the user can choose to
      // reconnect from the pairing screen (see decideReconnect).
      this.handleDrop('disconnected');
    };
  }

  /**
   * Common drop path: schedule an auto-reconnect when the policy allows it,
   * otherwise settle on `fallback` ('disconnected' for a plain close, 'error'
   * for a failed handshake/transport) and leave reconnecting to the user.
   */
  private handleDrop(fallback: 'disconnected' | 'error') {
    const decision = decideReconnect({
      userClosed: this.destroyed,
      everConnected: this.everConnected,
      attempt: this.reconnectAttempt,
    });
    if (!decision.reconnect) {
      this.setConnectionState(fallback);
      return;
    }
    this.reconnectAttempt = decision.attempt;
    console.log(`tunnel reconnect: attempt ${decision.attempt} in ${decision.delayMs}ms`);
    // Arm the timer BEFORE emitting state so the derived lifecycle reads
    // 'reconnecting' (not a transient 'offline') in the same tick.
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, decision.delayMs);
    this.setConnectionState('disconnected');
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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

  // ── Live planning drive frames (steer the desktop's live session, #1245) ──
  // The desktop is the source of truth and gates these the same as pane_input;
  // a dropped frame reconciles on the next plan_state, so they are fire-and-forget.
  /** Advance / jump the live planner to a stage. */
  planAdvance(projectId: string, stageKey: string) {
    this.send({ type: 'plan_advance', projectId, stageKey });
  }

  /** Confirm a plan section in the live planner. */
  planConfirm(projectId: string, section: string) {
    this.send({ type: 'plan_confirm', projectId, section });
  }

  /** Send a chat turn into the live planner session. */
  planChat(projectId: string, text: string) {
    this.send({ type: 'plan_chat', projectId, text });
  }

  /** Push a refreshed FCM registration token mid-session (tokens rotate). */
  refreshFcmToken(fcmToken: string) {
    this.fcmToken = fcmToken;
    this.send({ type: 'set_fcm_token', fcmToken });
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

  /**
   * Tear down after a handshake/transport failure. An established session
   * auto-retries with backoff; a first connect that never established surfaces
   * 'error' (with the diagnosis) and stays manual.
   */
  private failConnection(reason: string) {
    console.log(`tunnel connect failed: ${reason}`);
    this.closeSocket();
    this.handshakeDone = false;
    this.noise = null;
    if (!this.destroyed) this.handleDrop('error');
  }

  /**
   * On a connect timeout, probe the relay's /health so the error tells the user
   * WHICH leg failed: relay unreachable vs. relay-OK-but-desktop-never-joined vs.
   * reached-desktop-but-auth-stalled. (Distinguishes "couldn't reach the relay"
   * from "the desktop isn't running / paired" — they need different fixes.)
   */
  private async failWithDiagnosis(ws: WebSocket) {
    if (ws !== this.ws || !this.payload) return;
    const url = this.payload.relayUrl;
    const room = this.payload.room;
    const healthy = await this.probeRelayHealth(url);
    if (ws !== this.ws) return; // superseded while probing
    let reason: string;
    if (!healthy) {
      reason = `Couldn't reach the relay at ${url}. Check the relay URL and your network, then rescan the QR.`;
    } else if (!this.handshakeDone) {
      reason = `Reached the relay, but the desktop never joined room ${room}. Make sure base-studio-code is running and showing this pairing, then rescan the QR.`;
    } else {
      reason = 'Reached the desktop but pairing didn’t complete (the secret may be stale). Rescan the QR.';
    }
    this.failConnection(reason);
  }

  /** GET <relay>/health (ws→http). Returns true iff it responds as the MSC relay. */
  private async probeRelayHealth(wsUrl: string): Promise<boolean> {
    const httpUrl = wsUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/+$/, '') + '/health';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(httpUrl, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) { console.log(`tunnel /health ${httpUrl} → HTTP ${res.status}`); return false; }
      const j = await res.json().catch(() => null) as { ok?: boolean; service?: string } | null;
      console.log('tunnel /health:', JSON.stringify(j));
      return !!(j && (j.ok === true || j.service === 'msc-tunnel-relay'));
    } catch (e) {
      console.log(`tunnel /health ${httpUrl} failed:`, (e as Error)?.message);
      return false;
    }
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
      case 'plan_state':
        console.log(`tunnel← plan_state ${msg.projectId} stage=${msg.currentStage} sections=${msg.confirmedSections.length} files=${msg.files.length} msgs=${msg.messages.length} runs=${msg.pipelineRuns.length}`); break;
      case 'plan_event':
        console.log(`tunnel← plan_event ${msg.projectId} kind=${msg.kind}`); break;
      case 'plan_status':
        console.log(`tunnel← plan_status ${msg.projectId} stage=${msg.currentStage} status=${msg.status}`); break;
    }
  }

  private handleMessage(msg: TunnelServerMessage) {
    this.logInbound(msg);
    switch (msg.type) {
      case 'auth_ok': {
        this.clearConnectTimeout();
        this.everConnected = true;
        this.reconnectAttempt = 0; // fresh backoff schedule for the next drop
        this.setConnectionState('connected');
        // Re-assert streaming state for the active pane after reconnect. (The
        // auth frame already re-carried the FCM token, and the desktop replays
        // full state on connect — no incremental catch-up needed.)
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

      // Live planning session — forwarded to the LivePlan reducer (read-only mirror).
      case 'plan_state':
        this.cb.onPlanState?.(msg);
        break;

      case 'plan_status':
        this.cb.onPlanStatus?.(msg);
        break;

      case 'plan_event':
        this.cb.onPlanEvent?.(msg);
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
    this.emitLifecycle();
  }

  /**
   * Every lifecycle transition passes through setConnectionState (drops arm
   * the retry timer before emitting; redials emit 'connecting'), so deriving
   * here — deduped — is sufficient.
   */
  private emitLifecycle() {
    const status = deriveLifecycleStatus({
      wireState: this.connectionState,
      everConnected: this.everConnected,
      retryPending: this.reconnectTimer != null,
      userClosed: this.destroyed,
    });
    if (status === this.lastLifecycle) return;
    this.lastLifecycle = status;
    console.log(`tunnel lifecycle=${status}`);
    this.cb.onLifecycleChange?.(status);
  }

  private emitPanes() {
    this.cb.onPanesChange({ ...this.panes });
  }
}
