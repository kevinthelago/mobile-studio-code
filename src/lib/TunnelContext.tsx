import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import { TunnelClient, TunnelCallbacks } from './tunnel';
import {
  PaneState, PairingPayload, PlanSyncManifestEntry, TunnelConnectionState, TunnelServerMessage,
} from './types';
import { TunnelLifecycleStatus } from './tunnel/reconnect';
import { KEYS, getSecret, setSecret } from './storage';
import { parsePairingPayload } from './tunnel/pairing';
import type { StoreStateMap } from './tunnel/storeState';

/** A live-planning frame (server → phone): full snapshot, header, or transient delta. */
export type PlanFrame =
  | Extract<TunnelServerMessage, { type: 'plan_state' }>
  | Extract<TunnelServerMessage, { type: 'plan_status' }>
  | Extract<TunnelServerMessage, { type: 'plan_event' }>;

export type TunnelValue = {
  connectionState: TunnelConnectionState;
  /**
   * Coarse derived status for a connection banner (#217):
   * connecting / connected / reconnecting (auto-retry in progress) / offline.
   */
  lifecycleStatus: TunnelLifecycleStatus;
  panes: Record<string, PaneState>;
  activePaneId: string | null;
  /** Pane IDs ordered: awaiting_input (most recent first), then by last activity */
  orderedPaneIds: string[];
  /** The desktop's tunnel protocol version from auth_ok (contract v2). `null` before a
   *  connection / for a pre-v2 desktop; compare with TUNNEL_PROTOCOL_VERSION to warn. */
  desktopProtocolVersion: number | null;
  /** Mirrored desktop store projections (contract v2): domain → last {rev, json}.
   *  Replayed on connect, updated on every store_state frame. */
  storeState: StoreStateMap;
  /** Register a handler fired on every accepted store_state frame (after `storeState`
   *  updates), with the touched domain + the full map. */
  setStoreStateHandler: (fn: ((domain: string, storeState: StoreStateMap) => void) | null) => void;

  connect: (payload: PairingPayload) => Promise<void>;
  disconnect: () => void;
  /** Last-used pairing, loaded from storage — offered as a one-tap reconnect. */
  lastConnection: PairingPayload | null;
  focusPane: (paneId: string) => void;
  sendInput: (paneId: string, data: string) => void;
  sendResize: (paneId: string, cols: number, rows: number) => void;
  /** Releases the active pane back to minimized state, returning to the grid */
  unfocusPane: () => void;
  /** Call after FCM token is obtained so it is included in future auth handshakes */
  setFcmToken: (fcmToken: string) => void;

  // ── Planner sync (reconcile-on-connect; see docs/planner-sync-protocol.md) ──
  /** Targeted single-project manifest refresh (v2: the desktop REQUIRES a projectId).
   *  Reconcile-on-connect needs no request — the desktop replays every manifest after auth. */
  syncRequestManifest: (projectId: string) => void;
  syncPull: (projectId: string, paths: string[]) => Promise<Record<string, string>>;
  /** Push the agreed canonical map (v2 wire: {relpath, content} entries, no title). */
  syncPush: (projectId: string, files: Record<string, string>) => Promise<void>;
  /** Register the handler for incoming desktop manifests (the sync hook uses this). */
  setSyncManifestHandler: (fn: ((projects: PlanSyncManifestEntry[]) => void) | null) => void;

  // ── Live planning session (read-only mirror + drive; #1245) ──
  /** Register the handler fed every plan_state / plan_status / plan_event frame. */
  setPlanHandler: (fn: ((frame: PlanFrame) => void) | null) => void;
  /** Drive: advance / jump the desktop's live planner to a stage. */
  planAdvance: (projectId: string, stageKey: string) => void;
  /** Drive: confirm a plan section in the desktop's live planner. */
  planConfirm: (projectId: string, section: string) => void;
  /** Drive: send a chat turn into the desktop's live planner session. */
  planChat: (projectId: string, text: string) => void;
};

const TunnelContext = createContext<TunnelValue | null>(null);

export function useTunnel(): TunnelValue {
  const ctx = useContext(TunnelContext);
  if (!ctx) throw new Error('useTunnel must be used inside TunnelProvider');
  return ctx;
}

export function TunnelProvider({ children }: { children: React.ReactNode }) {
  const [connectionState, setConnectionState] = useState<TunnelConnectionState>('disconnected');
  const [lifecycleStatus, setLifecycleStatus] = useState<TunnelLifecycleStatus>('offline');
  const [panes, setPanes] = useState<Record<string, PaneState>>({});
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [lastConnection, setLastConnection] = useState<PairingPayload | null>(null);
  const [desktopProtocolVersion, setDesktopProtocolVersion] = useState<number | null>(null);
  const [storeState, setStoreState] = useState<StoreStateMap>({});
  const fcmTokenRef = useRef<string | undefined>(undefined);
  const clientRef = useRef<TunnelClient | null>(null);
  const syncManifestHandlerRef = useRef<((projects: PlanSyncManifestEntry[]) => void) | null>(null);
  const planHandlerRef = useRef<((frame: PlanFrame) => void) | null>(null);
  const storeStateHandlerRef = useRef<((domain: string, storeState: StoreStateMap) => void) | null>(null);

  useEffect(() => {
    const callbacks: TunnelCallbacks = {
      onConnectionStateChange: setConnectionState,
      onLifecycleChange: setLifecycleStatus,
      onPanesChange: setPanes,
      onUserRequest: (_paneId, _prompt) => {
        // Desktop fires the FCM push; mobile only needs to update pane state,
        // which TunnelClient already does before calling this callback.
      },
      onProtocolVersion: setDesktopProtocolVersion,
      onStoreState: (domain, map) => {
        setStoreState(map);
        storeStateHandlerRef.current?.(domain, map);
      },
      onSyncManifest: (projects) => syncManifestHandlerRef.current?.(projects),
      onPlanState: (frame) => planHandlerRef.current?.(frame),
      onPlanStatus: (frame) => planHandlerRef.current?.(frame),
      onPlanEvent: (frame) => planHandlerRef.current?.(frame),
    };
    const client = new TunnelClient(callbacks);
    clientRef.current = client;

    // Load saved pairing + FCM token, but DO NOT auto-connect. Reconnecting is
    // the user's choice (offered as a one-tap button on the pairing screen), so
    // a down desktop never leaves the app stuck on "connecting".
    (async () => {
      const [pairingJson, fcm] = await Promise.all([
        getSecret(KEYS.TUNNEL_PAIRING),
        getSecret(KEYS.FCM_TOKEN),
      ]);
      if (fcm) fcmTokenRef.current = fcm;
      if (pairingJson) {
        // Validate + normalise the persisted payload the same way as a fresh
        // scan, so a corrupt or legacy (e.g. https://) stored value can't power
        // a broken reconnect button.
        const saved = parsePairingPayload(pairingJson);
        if (saved) setLastConnection(saved);
      }
    })();

    return () => { client.disconnect(); };
  }, []);

  // Reconnect on foreground (#217): iOS suspends timers + sockets in the
  // background, so an armed backoff wait may never fire and a drop may not
  // have surfaced yet. On 'active', redial immediately if a session dropped;
  // reconnectNow() is a no-op when connected, user-disconnected, or unpaired.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clientRef.current?.reconnectNow();
    });
    return () => sub.remove();
  }, []);

  const connect = useCallback(async (payload: PairingPayload) => {
    await setSecret(KEYS.TUNNEL_PAIRING, JSON.stringify(payload));
    setLastConnection(payload);
    clientRef.current?.connect(payload, fcmTokenRef.current);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const focusPane = useCallback((paneId: string) => {
    setActivePaneId(paneId);
    clientRef.current?.focusPane(paneId);
  }, []);

  const sendInput = useCallback((paneId: string, data: string) => {
    clientRef.current?.sendInput(paneId, data);
  }, []);

  const sendResize = useCallback((paneId: string, cols: number, rows: number) => {
    clientRef.current?.sendResize(paneId, cols, rows);
  }, []);

  const unfocusPane = useCallback(() => {
    const current = clientRef.current?.getActivePaneId();
    if (current) {
      clientRef.current?.sendInput(current, ''); // flush; actual minimise via focusPane override
      // Tell the client to minimise the pane without switching to another
      clientRef.current?.minimisePane(current);
    }
    setActivePaneId(null);
  }, []);

  const setFcmToken = useCallback((fcmToken: string) => {
    fcmTokenRef.current = fcmToken;
    setSecret(KEYS.FCM_TOKEN, fcmToken).catch(() => {});
    // Push the refreshed token mid-session too; a no-op until the handshake is up,
    // in which case the next connect's auth carries it from fcmTokenRef.
    clientRef.current?.refreshFcmToken(fcmToken);
  }, []);

  const syncRequestManifest = useCallback(
    (projectId: string) => { clientRef.current?.syncRequestManifest(projectId); },
    [],
  );
  const syncPull = useCallback(
    (projectId: string, paths: string[]) =>
      clientRef.current?.syncPull(projectId, paths) ?? Promise.reject(new Error('tunnel not connected')),
    [],
  );
  const syncPush = useCallback(
    (projectId: string, files: Record<string, string>) =>
      clientRef.current?.syncPush(projectId, files) ?? Promise.reject(new Error('tunnel not connected')),
    [],
  );
  const setSyncManifestHandler = useCallback(
    (fn: ((projects: PlanSyncManifestEntry[]) => void) | null) => { syncManifestHandlerRef.current = fn; },
    [],
  );
  const setStoreStateHandler = useCallback(
    (fn: ((domain: string, storeState: StoreStateMap) => void) | null) => { storeStateHandlerRef.current = fn; },
    [],
  );
  const setPlanHandler = useCallback(
    (fn: ((frame: PlanFrame) => void) | null) => { planHandlerRef.current = fn; },
    [],
  );
  const planAdvance = useCallback((projectId: string, stageKey: string) => {
    clientRef.current?.planAdvance(projectId, stageKey);
  }, []);
  const planConfirm = useCallback((projectId: string, section: string) => {
    clientRef.current?.planConfirm(projectId, section);
  }, []);
  const planChat = useCallback((projectId: string, text: string) => {
    clientRef.current?.planChat(projectId, text);
  }, []);

  const orderedPaneIds = useMemo(() => {
    return Object.values(panes)
      .sort((a, b) => {
        // Panes awaiting user input float to the top, ordered by recency
        const aReq = a.hasUserRequest ? (a.lastUserRequestAt ?? 0) : -1;
        const bReq = b.hasUserRequest ? (b.lastUserRequestAt ?? 0) : -1;
        if (aReq !== bReq) return bReq - aReq;
        return (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
      })
      .map((p) => p.descriptor.id);
  }, [panes]);

  const value: TunnelValue = {
    connectionState,
    lifecycleStatus,
    panes,
    activePaneId,
    orderedPaneIds,
    desktopProtocolVersion,
    storeState,
    setStoreStateHandler,
    connect,
    disconnect,
    lastConnection,
    focusPane,
    sendInput,
    sendResize,
    unfocusPane,
    setFcmToken,
    syncRequestManifest,
    syncPull,
    syncPush,
    setSyncManifestHandler,
    setPlanHandler,
    planAdvance,
    planConfirm,
    planChat,
  };

  return (
    <TunnelContext.Provider value={value}>{children}</TunnelContext.Provider>
  );
}
