// Tunneled live-planning mirror for PT3. Subscribes to plan_status/plan_event
// messages from the desktop and exposes them to the planner UI.
//
// TODO(PT1/T5b): This hook is scaffolded but the live mirror is stub-only until
// the tunnel-mobile stream adds onPlanStatus/onPlanEvent to TunnelCallbacks and
// exposes sendPlanDirective/sendPlanPipeline on TunnelContext. Once PT1 lands,
// remove the stubs below and wire the real callbacks.

import { useCallback, useEffect, useState } from 'react';
import { useTunnel } from '../TunnelContext';
import type { TunnelConnectionState } from '../types';

// ── Mirror state types ────────────────────────────────────────────────────────

export type TunnelPlanStatus = {
  projectId: string;
  phase: string;
  /** Matches the plan_status wire type. */
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
  updatedAt: number;
};

export type TunnelPlanEvent = {
  projectId: string;
  event: string;
  payload: Record<string, unknown>;
};

export interface TunnelPlannerState {
  /** Whether the tunnel is currently connected. Drives the tunnel vs local view. */
  connected: boolean;
  connectionState: TunnelConnectionState;
  /** Latest plan status from the desktop, or null if none received yet. */
  planStatus: TunnelPlanStatus | null;
  /** Recent plan events, newest first (capped at 20). */
  events: TunnelPlanEvent[];
  /** Send a chat directive to the desktop planner. */
  sendDirective: (projectId: string, text: string) => void;
  /** Run/pause/resume/cancel a pipeline on the desktop. */
  runPipeline: (projectId: string, action: 'run' | 'pause' | 'resume' | 'cancel') => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Subscribe to the desktop's live plan state over the tunnel. When connected,
 * the planner screen can show real-time section/stage/gate progress from the
 * desktop and send directives back.
 *
 * Full implementation depends on PT1 + T5b (tunnel-mobile stream). Until those
 * land, this hook exposes the correct interface with stub implementations.
 */
export function useTunnelPlanner(): TunnelPlannerState {
  const { connectionState } = useTunnel();
  const [planStatus, setPlanStatus] = useState<TunnelPlanStatus | null>(null);
  const [events, setEvents] = useState<TunnelPlanEvent[]>([]);

  // TODO(PT1): When TunnelCallbacks gains onPlanStatus + onPlanEvent, subscribe
  // here. The tunnel stream will expose them via TunnelContext once PT1 lands.
  // Example of the intended wiring:
  //
  //   useEffect(() => {
  //     return registerPlanStatusHandler((status) => setPlanStatus(status));
  //   }, [registerPlanStatusHandler]);
  //
  //   useEffect(() => {
  //     return registerPlanEventHandler((event) => {
  //       setEvents((e) => [event, ...e].slice(0, 20));
  //     });
  //   }, [registerPlanEventHandler]);

  // Reset mirror state when disconnected.
  useEffect(() => {
    if (connectionState === 'disconnected' || connectionState === 'error') {
      setPlanStatus(null);
      setEvents([]);
    }
  }, [connectionState]);

  // TODO(PT1): replace stubs with useTunnel().sendPlanDirective when available.
  const sendDirective = useCallback((_projectId: string, _text: string) => {
    // TODO(PT1): TunnelContext will expose sendPlanDirective(projectId, text).
    // For now: no-op. The send button in the UI is disabled when not mirroring.
  }, []);

  // TODO(PT1): replace stubs with useTunnel().sendPlanPipeline when available.
  const runPipeline = useCallback((_projectId: string, _action: 'run' | 'pause' | 'resume' | 'cancel') => {
    // TODO(PT1): TunnelContext will expose sendPlanPipeline(projectId, action).
  }, []);

  return {
    connected: connectionState === 'connected',
    connectionState,
    planStatus,
    events,
    sendDirective,
    runPipeline,
  };
}
