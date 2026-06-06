import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { TunnelClient, TunnelCallbacks } from './tunnel';
import { PaneState, TunnelConnectionState } from './types';
import { KEYS, getSecret, setSecret } from './storage';

export type TunnelValue = {
  connectionState: TunnelConnectionState;
  panes: Record<string, PaneState>;
  activePaneId: string | null;
  /** Pane IDs ordered: awaiting_input (most recent first), then by last activity */
  orderedPaneIds: string[];

  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  /** Last-used pairing, loaded from storage — offered as a one-tap reconnect. */
  lastConnection: { url: string; token: string } | null;
  focusPane: (paneId: string) => void;
  sendInput: (paneId: string, data: string) => void;
  sendResize: (paneId: string, cols: number, rows: number) => void;
  /** Releases the active pane back to minimized state, returning to the grid */
  unfocusPane: () => void;
  /** Call after FCM token is obtained so it is included in future auth handshakes */
  setFcmToken: (fcmToken: string) => void;
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
  const [lastConnection, setLastConnection] = useState<{ url: string; token: string } | null>(null);
  const fcmTokenRef = useRef<string | undefined>(undefined);
  const clientRef = useRef<TunnelClient | null>(null);

  useEffect(() => {
    const callbacks: TunnelCallbacks = {
      onConnectionStateChange: setConnectionState,
      onPanesChange: setPanes,
      onUserRequest: (_paneId, _prompt) => {
        // Desktop fires the FCM push; mobile only needs to update pane state,
        // which TunnelClient already does before calling this callback.
      },
    };
    const client = new TunnelClient(callbacks);
    clientRef.current = client;

    // Load saved pairing + FCM token, but DO NOT auto-connect. Reconnecting is
    // the user's choice (offered as a one-tap button on the pairing screen), so
    // a down desktop never leaves the app stuck on "connecting".
    (async () => {
      const [url, token, fcm] = await Promise.all([
        getSecret(KEYS.TUNNEL_URL),
        getSecret(KEYS.TUNNEL_TOKEN),
        getSecret(KEYS.FCM_TOKEN),
      ]);
      if (fcm) fcmTokenRef.current = fcm;
      if (url && token) setLastConnection({ url, token });
    })();

    return () => { client.disconnect(); };
  }, []);

  const connect = useCallback(async (url: string, token: string) => {
    await Promise.all([
      setSecret(KEYS.TUNNEL_URL, url),
      setSecret(KEYS.TUNNEL_TOKEN, token),
    ]);
    setLastConnection({ url, token });
    clientRef.current?.connect(url, token, fcmTokenRef.current);
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
    connect,
    disconnect,
    lastConnection,
    focusPane,
    sendInput,
    sendResize,
    unfocusPane,
    setFcmToken,
  };

  return (
    <TunnelContext.Provider value={value}>{children}</TunnelContext.Provider>
  );
}
