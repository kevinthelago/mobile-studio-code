// Pure reducer for the mobile mirror of the desktop's LIVE planning session (#1245).
//
// The desktop is the single source of truth. The phone holds a read-only mirror keyed by
// projectId, rebuilt WHOLESALE from the replayed `plan_state` snapshot and nudged by
// incremental `plan_event` deltas; `plan_status` updates the cheap header. A late or
// reconnecting client rebuilds purely from the replayed snapshot — it never assumes it saw
// earlier events, so `applyPlanState` discards any prior per-project state. No React, no
// transport: the TunnelClient callbacks feed these and LivePlanContext holds the result.

import type { LivePlanState, PlanFile, PlanMessage, PlanPipelineRun, TunnelServerMessage } from '../types';

type PlanStateFrame = Extract<TunnelServerMessage, { type: 'plan_state' }>;
type PlanStatusFrame = Extract<TunnelServerMessage, { type: 'plan_status' }>;
type PlanEventFrame = Extract<TunnelServerMessage, { type: 'plan_event' }>;

/** The mirror: every known project's live-planning state, keyed by projectId. */
export type LivePlanRegistry = Record<string, LivePlanState>;

/** A blank state for a project we've heard of (via a header/event) but not yet snapshotted. */
export function emptyLivePlan(projectId: string): LivePlanState {
  return {
    projectId,
    currentStage: '',
    status: '',
    confirmedSections: [],
    files: [],
    messages: [],
    pipelineRuns: [],
    updatedAt: 0,
  };
}

/**
 * Rebuild a project's mirror from a full snapshot, replacing any prior state for that
 * project entirely (replay-on-(re)connect). Arrays are copied so later deltas don't mutate
 * the frame. Other projects in the registry are untouched.
 */
export function applyPlanState(
  registry: LivePlanRegistry, frame: PlanStateFrame, now: number,
): LivePlanRegistry {
  const prev = registry[frame.projectId];
  const next: LivePlanState = {
    projectId: frame.projectId,
    currentStage: frame.currentStage,
    // A snapshot carries no status label; preserve the last header if we have one.
    status: prev?.status ?? '',
    confirmedSections: [...frame.confirmedSections],
    files: frame.files.map((f) => ({ ...f })),
    messages: frame.messages.map((m) => ({ ...m })),
    pipelineRuns: frame.pipelineRuns.map((r) => ({ ...r })),
    updatedAt: now,
  };
  return { ...registry, [frame.projectId]: next };
}

/** Update the cheap header (active stage + status label); create the entry if unseen. */
export function applyPlanStatus(
  registry: LivePlanRegistry, frame: PlanStatusFrame, now: number,
): LivePlanRegistry {
  const prev = registry[frame.projectId] ?? emptyLivePlan(frame.projectId);
  return {
    ...registry,
    [frame.projectId]: { ...prev, currentStage: frame.currentStage, status: frame.status, updatedAt: now },
  };
}

/** Add a section if not already confirmed (idempotent — deltas may repeat). */
function withConfirmedSection(sections: string[], section: string): string[] {
  return sections.includes(section) ? sections : [...sections, section];
}

/** Upsert a pipeline run by id (replace same-id run in place, else append). */
function withPipelineRun(runs: PlanPipelineRun[], run: PlanPipelineRun): PlanPipelineRun[] {
  const idx = runs.findIndex((r) => r.id === run.id);
  if (idx === -1) return [...runs, { ...run }];
  const next = runs.slice();
  next[idx] = { ...run };
  return next;
}

/**
 * Apply a transient delta on top of a project's current mirror. Deltas are fire-and-forget
 * (never replayed), so if a project hasn't been snapshotted yet we start from an empty state
 * rather than drop the delta — a later `plan_state` will correct it wholesale. An event whose
 * required detail field is absent (malformed) is ignored for that kind.
 */
export function applyPlanEvent(
  registry: LivePlanRegistry, frame: PlanEventFrame,
): LivePlanRegistry {
  const prev = registry[frame.projectId] ?? emptyLivePlan(frame.projectId);
  let next: LivePlanState = { ...prev, updatedAt: frame.at };

  switch (frame.kind) {
    case 'section_confirmed':
      if (frame.section == null) return registry;
      next = { ...next, confirmedSections: withConfirmedSection(prev.confirmedSections, frame.section) };
      break;
    case 'stage_advanced':
      if (frame.stage == null) return registry;
      next = { ...next, currentStage: frame.stage };
      break;
    case 'message_appended':
      if (frame.message == null) return registry;
      next = { ...next, messages: [...prev.messages, { ...frame.message }] };
      break;
    case 'pipeline_run':
      if (frame.run == null) return registry;
      next = { ...next, pipelineRuns: withPipelineRun(prev.pipelineRuns, frame.run) };
      break;
    default:
      return registry;
  }

  return { ...registry, [frame.projectId]: next };
}

// ── Derived stepper view ─────────────────────────────────────────────────────

/** One step in the planning stepper, derived from a snapshot for the mirror UI. */
export interface PlanSection {
  /** Stable section/stage key (also the `section`/`stageKey` for drive frames). */
  key: string;
  /** Display label (relpath stem, title-cased lightly for readability). */
  label: string;
  confirmed: boolean;
  isCurrent: boolean;
  /** The section's file content, if the snapshot carried one. */
  file: PlanFile | null;
}

/** Section key for a file relpath — its basename without the extension (goal.md → goal). */
function sectionKey(relpath: string): string {
  const base = relpath.split('/').pop() ?? relpath;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function labelFor(key: string): string {
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the ordered stepper from a snapshot: one step per section file (in the order the
 * desktop sent them), then any confirmed section or the current stage that has no file of
 * its own (so a stage the phone can still see/confirm isn't dropped). Pure + deterministic.
 */
export function deriveSections(state: LivePlanState): PlanSection[] {
  const seen = new Set<string>();
  const steps: PlanSection[] = [];
  const push = (key: string, file: PlanFile | null) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    steps.push({
      key,
      label: labelFor(key),
      confirmed: state.confirmedSections.includes(key),
      isCurrent: key === state.currentStage,
      file,
    });
  };
  for (const f of state.files) push(sectionKey(f.relpath), f);
  for (const s of state.confirmedSections) push(s, null);
  push(state.currentStage, null);
  return steps;
}

// Re-export the element types for convenience at call sites.
export type { LivePlanState, PlanFile, PlanMessage, PlanPipelineRun };
