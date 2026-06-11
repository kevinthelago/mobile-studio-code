import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { TunnelClient, TunnelCallbacks, tunnelLog } from './tunnel';
import { PaneState, TunnelConnectionState, TunnelPairing } from './types';
import { parseTunnelPairing } from './tunnelPairing';
import { KEYS, getSecret, setSecret, deleteSecret } from './storage';
import {
  PlanSyncCoordinator,
  PlanConflict,
  PlanSyncStatus,
  ConflictResolution,
} from './planBundle/planSync';
import { buildLocalManifest } from './planBundle/storage';

export type TunnelValue = {
  connectionState: TunnelConnectionState;
  panes: Record<string, PaneState>;
  activePaneId: string | null;
  /** Pane IDs ordered: awaiting_input (most recent first), then by last activity */
  orderedPaneIds: string[];

  /** True when desktop pairing credentials are saved (paired), regardless of
   *  whether the socket is currently live. Drives the "Unpair" affordance. */
  hasPairing: boolean;

  connect: (pairing: TunnelPairing) => Promise<void>;
  /** Transient close — stays paired; auto-connects again on next launch. */
  disconnect: () => void;
  /** Permanent: forgets the desktop (deletes saved tunnel creds) and closes the
   *  socket. Returns to standalone. Does NOT touch repo/GitHub/Anthropic state. */
  unpair: () => Promise<void>;
  focusPane: (paneId: string) => void;
  sendInput: (paneId: string, data: string) => void;
  sendResize: (paneId: string, cols: number, rows: number) => void;
  /** Releases the active pane back to minimized state, returning to the grid */
  unfocusPane: () => void;
  /** Call after FCM token is obtained so it is included in future auth handshakes */
  setFcmToken: (fcmToken: string) => void;

  // ── Plan sync ─────────────────────────────────────────────────────────────
  planSyncStatus: PlanSyncStatus;
  planConflicts: PlanConflict[];
  resolvePlanConflict: (projectId: string, resolution: ConflictResolution) => void;
};

const TunnelContext = createContext<TunnelValue | null>(null);

export function useTunnel(): TunnelValue {
  const ctx = useContext(TunnelContext);
  if (!ctx) throw new Error('useTunnel must be used inside TunnelProvider');
  return ctx;
}

export function TunnelProvider({ children }: { children: React.ReactNode }) {
  const [connectionState, setConnectionState] = useState<TunnelConnectionState>('disconnected');
  const [panes, setPanes] = useState<Record<string, PaneState>>({});
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [hasPairing, setHasPairing] = useState(false);
  const [planSyncStatus, setPlanSyncStatus] = useState<PlanSyncStatus>('idle');
  const [planConflicts, setPlanConflicts] = useState<PlanConflict[]>([]);
  const fcmTokenRef = useRef<string | undefined>(undefined);
  const clientRef = useRef<TunnelClient | null>(null);
  const planSyncRef = useRef<PlanSyncCoordinator | null>(null);

  useEffect(() => {
    const coordinator = new PlanSyncCoordinator(
      (bundle) => clientRef.current?.sendPlanPush(bundle),
      (projectId, fileKeys) => clientRef.current?.sendPlanRequest(projectId, fileKeys),
      (manifest) => clientRef.current?.sendPlanSyncManifest(manifest),
      {
        onStatusChange: setPlanSyncStatus,
        onConflicts: setPlanConflicts,
      },
    );
    planSyncRef.current = coordinator;

    const callbacks: TunnelCallbacks = {
      onConnectionStateChange: setConnectionState,
      onPanesChange: setPanes,
      onUserRequest: (_paneId, _prompt) => {
        // Desktop fires the FCM push; mobile only needs to update pane state,
        // which TunnelClient already does before calling this callback.
      },
      getLocalPlanManifest: () => buildLocalManifest(),
      onDesktopPlanManifest: (manifest, now) => {
        coordinator.onDesktopManifest(manifest, now).catch((e) => {
          tunnelLog('plan_sync: reconciliation error', e);
          setPlanSyncStatus('error');
        });
      },
      onPlanPull: (bundle) => {
        coordinator.onPlanPull(bundle).catch((e) => {
          tunnelLog('plan_sync: onPlanPull error', e);
        });
      },
      onPlanAck: (projectId) => {
        coordinator.onPlanAck(projectId);
      },
    };
    const client = new TunnelClient(callbacks);
    clientRef.current = client;

    // Auto-connect if a pairing was saved from a previous QR scan
    (async () => {
      const [savedPairing, fcm] = await Promise.all([
        getSecret(KEYS.TUNNEL_PAIRING),
        getSecret(KEYS.FCM_TOKEN),
      ]);
      if (fcm) fcmTokenRef.current = fcm;
      const pairing = savedPairing ? parseTunnelPairing(savedPairing) : null;
      if (pairing) {
        tunnelLog('auto-connect from saved pairing');
        setHasPairing(true);
        client.connect(pairing, fcm ?? undefined);
      } else {
        tunnelLog('no saved pairing — standalone');
      }
    })();

    return () => { client.disconnect(); };
  }, []);

  const connect = useCallback(async (pairing: TunnelPairing) => {
    tunnelLog('pairing', { relay: pairing.relayUrl, room: pairing.room });
    await setSecret(KEYS.TUNNEL_PAIRING, JSON.stringify(pairing));
    setHasPairing(true);
    clientRef.current?.connect(pairing, fcmTokenRef.current);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const unpair = useCallback(async () => {
    // Forget the desktop: clear ONLY the two tunnel secrets, then close the
    // socket. Repo manifest, downloaded files, tasks, GitHub PAT, and the
    // Anthropic key are intentionally left untouched — unpair returns to
    // standalone with local repo state intact (issue #16).
    await Promise.all([
      deleteSecret(KEYS.TUNNEL_PAIRING),
      deleteSecret(KEYS.TUNNEL_URL),   // legacy LAN creds, if any linger
      deleteSecret(KEYS.TUNNEL_TOKEN),
    ]);
    tunnelLog('unpaired — cleared saved pairing, returning to standalone');
    setHasPairing(false);
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
  }, []);

  const resolvePlanConflict = useCallback((
    projectId: string,
    resolution: ConflictResolution,
  ) => {
    const coordinator = planSyncRef.current;
    if (!coordinator) return;
    const now = Date.now();
    coordinator.resolveConflict(projectId, resolution, now).catch((e) => {
      tunnelLog('plan_sync: resolveConflict error', e);
    });
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
    panes,
    activePaneId,
    orderedPaneIds,
    hasPairing,
    connect,
    disconnect,
    unpair,
    focusPane,
    sendInput,
    sendResize,
    unfocusPane,
    setFcmToken,
    planSyncStatus,
    planConflicts,
    resolvePlanConflict,
  };

  return (
    <TunnelContext.Provider value={value}>{children}</TunnelContext.Provider>
  );
}
