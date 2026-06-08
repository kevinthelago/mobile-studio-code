// Ported pure planning core from base-studio-code (desktop PR #585). These modules
// are framework-free and copied near-verbatim so the data shapes stay in lockstep
// with the desktop — re-pull rather than diverge. The mobile integration layer
// (persistence, AI driver, UI, store) wires to these; it does not reimplement them.

export * from "./stageGate";

// The section-based Blueprint (blueprints.ts) is THE blueprint object. planStages.ts
// also carries the legacy, pre-#585 stage-config `Blueprint` (#514) plus its
// enabledStages helpers — those are intentionally NOT re-exported, so mobile code
// only ever sees one `Blueprint`. We keep the stage registry + gate evaluator from
// planStages as the typed signal source / fallback (not the gate authority).
export {
  PLAN_STAGES,
  STAGE_BY_ID,
  defaultStageConfig,
  buildPlanStageState,
  stageStatus,
  enabledOrderedStages,
  currentStage,
  isStageId,
  stageById,
  type StageId,
  type PlanStageState,
  type StageStatus,
  type Stage,
  type StageConfig,
} from "./planStages";

export * from "./blueprints";
export * from "./planStageDerive";
export * from "./pipelineRuntime";
export * from "./pipelineCommands";
export * from "./pipelineTag";
export * from "./uiPreviewTag";
