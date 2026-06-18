// Bridge from the typed PlanStageState to the flat, serializable PlanSignals bag
// that declarative section gates read. Ported from base-studio-code.
//
// NOTE (mobile port): the desktop's `derivePlanStageState(input)` is intentionally
// omitted here. It depends on the desktop-only live-section model
// (`./planSections` → parseSectionKey, `./ghStructure` → SectionState) that wasn't
// part of the shared pure modules. On mobile we build a PlanStageState directly
// from our local planner store (see the planner integration layer) and then call
// `planStateToSignals`. If we later want the desktop derivation verbatim, pull in
// planSections.ts + ghStructure.ts and restore it.

import { type PlanStageState } from "./planStages";
import type { PlanSignals } from "./stageGate";

/**
 * Flatten the typed {@link PlanStageState} into the serializable {@link PlanSignals}
 * bag that declarative section gates read. This is the bridge between the app's live
 * state derivation and the data-driven gate evaluator — the published signal
 * vocabulary that built-in and cloud-distributed sections alike compose against.
 */
export function planStateToSignals(s: PlanStageState): PlanSignals {
  return {
    coreConfirmed: s.context.coreConfirmed,
    topicsResolved: s.context.resolved,
    topicsTotal: s.context.total,
    repoCount: s.repoCount,
    requiresUi: s.requiresUi,
    screensApproved: s.ui.approved,
    screensTotal: s.ui.total,
    featuresCount: s.features.count,
    featuresConfirmed: s.features.confirmed,
    phasesConfirmed: s.phasesConfirmed,
    issueCount: s.issueCount,
    fleetStreams: s.fleet.streams,
    profilesComplete: s.fleet.profilesComplete,
    automationsAck: s.automationsAck,
    skillsAck: s.skillsAck,
  };
}
