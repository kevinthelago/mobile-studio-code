// Holds the read-only mirror of the desktop's live planning session(s) (#1245).
//
// Registers a single handler on the tunnel that receives every plan_state / plan_status /
// plan_event frame and folds it into the pure LivePlan reducer, keyed by projectId. The
// mirror is rebuilt wholesale on each `plan_state` and nudged by `plan_event` deltas, so a
// reconnect (which replays plan_state) self-heals. Drive actions pass straight through to
// the tunnel; the desktop is the source of truth, so any optimistic effect reconciles on the
// next snapshot. The registry is cleared at the start of each new connection attempt so a
// reconnect doesn't keep projects the desktop has since dropped.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTunnel } from '../TunnelContext';
import type { LivePlanState } from '../types';
import {
  applyPlanState, applyPlanStatus, applyPlanEvent, type LivePlanRegistry,
} from './livePlan';

export interface LivePlanValue {
  /** Every mirrored project, most-recently-updated first. */
  projects: LivePlanState[];
  /** Look up one project's mirror, or undefined if not seen yet. */
  getProject: (projectId: string) => LivePlanState | undefined;
  /** Whether any live-planning frame has arrived this connection. */
  hasLiveSession: boolean;
  // Drive (desktop is the source of truth; optimistic UI reconciles on next plan_state).
  advance: (projectId: string, stageKey: string) => void;
  confirm: (projectId: string, section: string) => void;
  chat: (projectId: string, text: string) => void;
}

const LivePlanContext = createContext<LivePlanValue | null>(null);

export function useLivePlan(): LivePlanValue {
  const ctx = useContext(LivePlanContext);
  if (!ctx) throw new Error('useLivePlan must be used inside LivePlanProvider');
  return ctx;
}

export function LivePlanProvider({ children }: { children: React.ReactNode }) {
  const { connectionState, setPlanHandler, planAdvance, planConfirm, planChat } = useTunnel();
  const [registry, setRegistry] = useState<LivePlanRegistry>({});

  // Fold each incoming planning frame into the reducer.
  useEffect(() => {
    setPlanHandler((frame) => {
      setRegistry((reg) => {
        switch (frame.type) {
          case 'plan_state': return applyPlanState(reg, frame, Date.now());
          case 'plan_status': return applyPlanStatus(reg, frame, Date.now());
          case 'plan_event': return applyPlanEvent(reg, frame);
          default: return reg;
        }
      });
    });
    return () => setPlanHandler(null);
  }, [setPlanHandler]);

  // Start each new connection from a clean slate so replay rebuilds the truth and a
  // reconnect doesn't retain a project the desktop no longer has. The last view lingers
  // while disconnected/errored (better than a blank screen for a read-only mirror).
  useEffect(() => {
    if (connectionState === 'connecting') setRegistry({});
  }, [connectionState]);

  const projects = useMemo(
    () => Object.values(registry).sort((a, b) => b.updatedAt - a.updatedAt),
    [registry],
  );
  const getProject = useCallback((projectId: string) => registry[projectId], [registry]);

  const value: LivePlanValue = {
    projects,
    getProject,
    hasLiveSession: projects.length > 0,
    advance: planAdvance,
    confirm: planConfirm,
    chat: planChat,
  };

  return <LivePlanContext.Provider value={value}>{children}</LivePlanContext.Provider>;
}
