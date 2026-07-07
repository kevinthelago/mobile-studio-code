import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { useMirrorDomain } from '../mirror/MirrorContext';
import { KEYS, getSecret, setSecret } from '../storage';
import {
  mergeAlerts, parseAlertsPayload, provisionalAlert, unreadCount, visibleAlerts,
  type AlertEvent,
} from './model';
import {
  EMPTY_READ_STATE, clearRead as clearReadState, markAllRead as markAllReadState,
  parseReadState, serializeReadState, type AlertReadState,
} from './readState';

/** Keep at most this many locally-minted (FCM) provisional entries. */
const PROVISIONAL_CAP = 50;

/** A foreground alert push, surfaced as the in-app AlertToast (#222). */
export type AlertToastSignal = {
  kind: string;
  title: string;
  body: string;
  paneId?: string;
  at: number;
};

export type AlertsValue = {
  /** The merged inbox (domain + provisional FCM), cleared-filtered, newest-first. */
  alerts: AlertEvent[];
  /** Alerts newer than the local read watermark. */
  unread: number;
  /** The read watermark itself — the inbox snapshots it for unread emphasis. */
  readAt: number;
  /** True once the desktop has pushed the `alerts` domain (post-#2498 + connected). */
  synced: boolean;
  /** Advance the read watermark over every current alert (inbox viewed). */
  markAllRead: () => void;
  /** Hide everything already read — local display state only. */
  clearRead: () => void;
  /** Fold a foreground FCM alert push into the inbox + raise the toast. */
  recordFcmAlert: (kind: string, title: string, body: string, paneId?: string) => void;
  /** The latest foreground alert push, for the in-app toast. */
  toast: AlertToastSignal | null;
  dismissToast: () => void;
};

const AlertsContext = createContext<AlertsValue | null>(null);

export function useAlerts(): AlertsValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used inside AlertsProvider');
  return ctx;
}

/**
 * The alerts inbox state (#222): merges the authoritative `alerts` mirror
 * domain (desktop's capped rolling inbox, replayed on connect) with
 * provisional entries minted from foreground FCM pushes (which cover the
 * gaps: disconnected relay, or a pre-domain frame race). Read/cleared
 * watermarks are device-local UX state persisted to SecureStore — the
 * display-only rule applies to APP state; read-state never leaves the phone.
 *
 * Degrades gracefully: against a pre-#2498 desktop the domain never syncs and
 * the inbox simply shows whatever FCM pushes arrive in the foreground (or
 * nothing — the empty state).
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const { data, synced } = useMirrorDomain('alerts');
  const [provisional, setProvisional] = useState<AlertEvent[]>([]);
  const [read, setRead] = useState<AlertReadState>(EMPTY_READ_STATE);
  const [toast, setToast] = useState<AlertToastSignal | null>(null);

  // Load the persisted watermarks once; failures fall back to "all unread".
  useEffect(() => {
    let cancelled = false;
    getSecret(KEYS.ALERTS_READ)
      .then((raw) => { if (!cancelled) setRead(parseReadState(raw)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const domainAlerts = useMemo(() => parseAlertsPayload(data), [data]);
  const merged = useMemo(
    () => mergeAlerts(domainAlerts, provisional),
    [domainAlerts, provisional],
  );
  const alerts = useMemo(() => visibleAlerts(merged, read.clearedAt), [merged, read.clearedAt]);
  const unread = useMemo(() => unreadCount(alerts, read.readAt), [alerts, read.readAt]);

  const markAllRead = useCallback(() => {
    setRead((prev) => {
      const next = markAllReadState(prev, alerts);
      if (next !== prev) {
        setSecret(KEYS.ALERTS_READ, serializeReadState(next)).catch(() => {});
      }
      return next;
    });
  }, [alerts]);

  const clearRead = useCallback(() => {
    setRead((prev) => {
      const next = clearReadState(prev);
      if (next !== prev) {
        setSecret(KEYS.ALERTS_READ, serializeReadState(next)).catch(() => {});
      }
      return next;
    });
  }, []);

  const recordFcmAlert = useCallback(
    (kind: string, title: string, body: string, paneId?: string) => {
      const now = Date.now();
      const entry = provisionalAlert(kind, body, paneId, now);
      setProvisional((prev) => [...prev, entry].slice(-PROVISIONAL_CAP));
      setToast({ kind, title, body, paneId, at: now });
    },
    [],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo<AlertsValue>(() => ({
    alerts,
    unread,
    readAt: read.readAt,
    synced,
    markAllRead,
    clearRead,
    recordFcmAlert,
    toast,
    dismissToast,
  }), [
    alerts, unread, read.readAt, synced,
    markAllRead, clearRead, recordFcmAlert, toast, dismissToast,
  ]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}
