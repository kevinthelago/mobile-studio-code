import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { TunnelClient, TunnelCallbacks } from './tunnel';
import {
  AutomationSummary, FleetStreamStatus, McpServerInfo, McpToolInfo,
  PairingDiagnostics, PairingPayload, PaneState, TunnelConnectionState,
} from './types';
import { KEYS, getSecret, setSecret } from './storage';
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
  /** T3 — per-leg pairing diagnostics (relayReach / roomJoin / handshake / auth). */
  diagnostics: PairingDiagnostics;

  connect: (payload: PairingPayload) => Promise<void>;
  disconnect: () => void;
  /** Last-used pairing, loaded from storage — offered as a one-tap reconnect. */
  lastConnection: PairingPayload | null;
  focusPane: (paneId: string) => void;
  sendInput: (paneId: string, data: string) => void;
  sendResize: (paneId: string, cols: number, rows: number) => void;
  /** Releases the active pane back to minimized state, returning to the grid */
  unfocusPane: () => void;
  /** T6b — Call after FCM token is obtained/rotated so it is included in future auth handshakes */
  setFcmToken: (fcmToken: string) => void;

  // ── Plan sync ─────────────────────────────────────────────────────────────
  planSyncStatus: PlanSyncStatus;
  planConflicts: PlanConflict[];
  resolvePlanConflict: (projectId: string, resolution: ConflictResolution) => void;

  // ── Phase-3: fleet coordination (F1) ──
  fleetStreams: FleetStreamStatus[];
  sendFleetDirective: (streamId: string, text: string) => void;
  sendCoordAskResponse: (questionId: string, answer: string) => void;

  // ── Phase-3: automation (A1) ──
  automations: AutomationSummary[];
  sendAutomationToggle: (automationId: string, enabled: boolean) => void;
  sendAutomationTrigger: (automationId: string, params: Record<string, unknown>) => void;

  // ── Phase-3: MCP server visibility (M1) ──
  mcpServers: McpServerInfo[];
  mcpTools: Record<string, McpToolInfo[]>; // serverId → tools
  requestMcpList: () => void;
};

const TunnelContext = createContext<TunnelValue | null>(null);

export function useTunnel(): TunnelValue {
  const ctx = useContext(TunnelContext);
  if (!ctx) throw new Error('useTunnel must be used inside TunnelProvider');
  return ctx;
}

const NULL_DIAGNOSTICS: PairingDiagnostics = {
  relayReach: null, roomJoin: null, handshake: null, auth: null, failReason: null,
};

export function TunnelProvider({ children }: { children: React.ReactNode }) {
  const [connectionState, setConnectionState] = useState<TunnelConnectionState>('disconnected');
  const [panes, setPanes] = useState<Record<string, PaneState>>({});
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [lastConnection, setLastConnection] = useState<PairingPayload | null>(null);
  const [diagnostics, setDiagnostics] = useState<PairingDiagnostics>(NULL_DIAGNOSTICS);
  const [planSyncStatus, setPlanSyncStatus] = useState<PlanSyncStatus>('idle');
  const [planConflicts, setPlanConflicts] = useState<PlanConflict[]>([]);
  // Phase-3 state
  const [fleetStreams, setFleetStreams] = useState<FleetStreamStatus[]>([]);
  const [automations, setAutomations] = useState<AutomationSummary[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([]);
  const [mcpTools, setMcpTools] = useState<Record<string, McpToolInfo[]>>({});

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
      // T3 — propagate per-leg diagnostics into React state
      onDiagnosticsChange: setDiagnostics,
      getLocalPlanManifest: () => buildLocalManifest(),
      onDesktopPlanManifest: (manifest, now) => {
        coordinator.onDesktopManifest(manifest, now).catch((e) => {
          console.warn('[planSync] reconciliation error', e);
          setPlanSyncStatus('error');
        });
      },
      onPlanPull: (bundle) => {
        coordinator.onPlanPull(bundle).catch((e) => {
          console.warn('[planSync] onPlanPull error', e);
        });
      },
      onPlanAck: (projectId) => {
        coordinator.onPlanAck(projectId);
      },
      // Phase-3 callbacks
      onFleetStatus: setFleetStreams,
      onAutomationList: setAutomations,
      onMcpServerList: setMcpServers,
      onMcpToolList: (serverId, tools) =>
        setMcpTools((prev) => ({ ...prev, [serverId]: tools })),
    };
    const client = new TunnelClient(callbacks);
    clientRef.current = client;

    // Load saved pairing + FCM token. Do NOT auto-connect — a down desktop
    // must not block the app; the user reconnects via the one-tap button.
    (async () => {
      const [pairingJson, fcm] = await Promise.all([
        // Stored under TUNNEL_URL for backwards-compat; contains full PairingPayload JSON
        getSecret(KEYS.TUNNEL_URL),
        getSecret(KEYS.FCM_TOKEN),
      ]);
      if (fcm) {
        fcmTokenRef.current = fcm;
        client.updateFcmToken(fcm);
      }
      if (pairingJson) {
        try {
          const saved = JSON.parse(pairingJson) as PairingPayload;
          if (saved.relayUrl && saved.room && saved.hostPubKey && saved.psk) {
            setLastConnection(saved);
          }
        } catch { /* corrupt stored value — ignore */ }
      }
    })();

    return () => { client.disconnect(); };
  }, []);

  const connect = useCallback(async (payload: PairingPayload) => {
    await setSecret(KEYS.TUNNEL_URL, JSON.stringify(payload));
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
      clientRef.current?.minimisePane(current);
    }
    setActivePaneId(null);
  }, []);

  // T6b — FCM token obtained or rotated: persist + push to the client.
  const setFcmToken = useCallback((fcmToken: string) => {
    fcmTokenRef.current = fcmToken;
    clientRef.current?.updateFcmToken(fcmToken);
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
      console.warn('[planSync] resolveConflict error', e);
    });
  }, []);

  // ── Phase-3 senders ──────────────────────────────────────────────────────
  const sendFleetDirective = useCallback(
    (streamId: string, text: string) =>
      clientRef.current?.sendMsg({ type: 'fleet_directive', streamId, text }),
    [],
  );
  const sendCoordAskResponse = useCallback(
    (questionId: string, answer: string) =>
      clientRef.current?.sendMsg({ type: 'coord_ask_response', questionId, answer }),
    [],
  );
  const sendAutomationToggle = useCallback(
    (automationId: string, enabled: boolean) =>
      clientRef.current?.sendMsg({ type: 'automation_toggle', automationId, enabled }),
    [],
  );
  const sendAutomationTrigger = useCallback(
    (automationId: string, params: Record<string, unknown>) =>
      clientRef.current?.sendMsg({ type: 'automation_trigger', automationId, params }),
    [],
  );
  const requestMcpList = useCallback(
    () => clientRef.current?.sendMsg({ type: 'mcp_request_list' }),
    [],
  );

  const orderedPaneIds = useMemo(() => {
    return Object.values(panes)
      .sort((a, b) => {
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
    diagnostics,
    connect,
    disconnect,
    lastConnection,
    focusPane,
    sendInput,
    sendResize,
    unfocusPane,
    setFcmToken,
    planSyncStatus,
    planConflicts,
    resolvePlanConflict,
    fleetStreams,
    sendFleetDirective,
    sendCoordAskResponse,
    automations,
    sendAutomationToggle,
    sendAutomationTrigger,
    mcpServers,
    mcpTools,
    requestMcpList,
  };

  return (
    <TunnelContext.Provider value={value}>{children}</TunnelContext.Provider>
  );
}
