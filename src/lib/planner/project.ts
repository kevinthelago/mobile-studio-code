// The unified plan object. One serializable `PlanProject` holds everything about a
// local plan — the chosen (section-based) blueprint plus all live state the planner
// fills in. The UI, the local store, persistence, and cross-device transfer (the
// Plan Bundle, issue #103) all read this single shape, so changes land in one place.
//
// Built on the ported pure core (src/lib/planner/core) — it does not duplicate the
// blueprint/gate logic, only composes it into a project envelope.

import {
  type Blueprint, type PipelineRunState, type PlanSignals, type PlanStageState,
  type BlueprintSection, type IncompleteSection, type SectionRenderStatus,
  buildPlanStageState, planStateToSignals, enabledSections,
  sectionStatus, isGateBlocked,
} from './core';

/** Storage/transfer schema version for a PlanProject (bump on a breaking change). */
export const PLAN_PROJECT_SCHEMA = 1 as const;

/** A section's lifecycle as the planner fills it in. */
export type SectionState = 'surfaced' | 'drafted' | 'confirmed' | 'skipped';

export interface PlanProjectSection {
  state: SectionState;
  /** Section file content (markdown or JSON), as written by a <plan_update> tag. */
  content: string;
}

/** One turn of the planner conversation. Assistant text is stored RAW (with tags);
 *  the UI strips planner tags at render time. */
export interface PlanMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * The single unit of a local plan. Persisted as project.json and used verbatim as
 * the payload of a Plan Bundle when transferring to/from desktop (issue #103).
 */
export interface PlanProject {
  schema: typeof PLAN_PROJECT_SCHEMA;
  /** Stable id, minted once at creation — never keyed off the (mutable) title. */
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** The one blueprint object; its sections own their gates + pipelines. */
  blueprint: Blueprint;
  /** Per-section lifecycle + document content, keyed by section key. */
  sections: Record<string, PlanProjectSection>;
  /**
   * Scalar signal inputs (counts/flags) — the gate-driving snapshot. Section
   * documents live in `sections`; gates evaluate against the signals flattened
   * from this. The AI loop / UI update it as topics are confirmed.
   */
  stage: PlanStageState;
  /** Pipeline run states keyed by pipeline uid. */
  pipelineRuns: Record<string, PipelineRunState>;
  /** Generated artifacts (phases.json, issues.json, fleet.json, …): relpath → contents. */
  artifacts: Record<string, string>;
  /** The planner conversation. */
  messages: PlanMessage[];
}

/**
 * Create an empty project from a blueprint. `id` must be stable (mint once); `now`
 * is injected so callers own the clock. Seeds a section entry for every enabled
 * blueprint section.
 */
export function createPlanProject(
  blueprint: Blueprint,
  opts: { id: string; title: string; now: number },
): PlanProject {
  const sections: Record<string, PlanProjectSection> = {};
  for (const s of enabledSections(blueprint.sections)) {
    sections[s.key] = { state: 'surfaced', content: '' };
  }
  return {
    schema: PLAN_PROJECT_SCHEMA,
    id: opts.id,
    title: opts.title,
    createdAt: opts.now,
    updatedAt: opts.now,
    blueprint,
    sections,
    stage: buildPlanStageState(),
    pipelineRuns: {},
    artifacts: {},
    messages: [],
  };
}

/** Flatten the project's stage snapshot into the signal bag the gates read. */
export function projectSignals(project: PlanProject): PlanSignals {
  return planStateToSignals(project.stage);
}

export interface EffectiveStatus {
  status: SectionRenderStatus;
  fraction: number;
  /** True when the gateRule is met but a gate pipeline hasn't passed (#532) — the
   *  section is held at in-progress until the gate clears. */
  blocked: boolean;
}

/**
 * A section's status with pipeline gates applied on top of its data gate: if the
 * declarative gateRule is satisfied but a gate pipeline hasn't passed, the section
 * is held at in-progress (blocked) rather than complete.
 */
export function effectiveSectionStatus(
  section: BlueprintSection,
  sections: BlueprintSection[],
  signals: PlanSignals,
  runs: Record<string, PipelineRunState>,
): EffectiveStatus {
  const base = sectionStatus(section, sections, signals);
  if (base.status === 'complete' && isGateBlocked(section.pipelines, runs)) {
    return { status: 'in-progress', fraction: Math.min(base.fraction, 0.95), blocked: true };
  }
  return { status: base.status, fraction: base.fraction, blocked: false };
}

export interface ProjectReadiness {
  /** Per (enabled) section effective status + bar fill, in blueprint order. */
  sections: { section: BlueprintSection; status: EffectiveStatus }[];
  /** Whether every enabled, applicable section is complete (the triage gate). */
  complete: boolean;
  /** The reached frontier section (drives which pipeline screens show). */
  current: BlueprintSection | undefined;
  /** What's left, each with its own gate reason. */
  incomplete: IncompleteSection[];
}

/** One call for the UI: derive the whole (gate-aware) readiness picture. */
export function projectReadiness(project: PlanProject): ProjectReadiness {
  const signals = projectSignals(project);
  const all = project.blueprint.sections;
  const runs = project.pipelineRuns;
  const rows = enabledSections(all).map((section) => ({
    section,
    status: effectiveSectionStatus(section, all, signals, runs),
  }));
  const applicable = rows.filter((r) => r.status.status !== 'na');
  return {
    sections: rows,
    complete: applicable.every((r) => r.status.status === 'complete'),
    current: (applicable.find((r) => r.status.status === 'in-progress')?.section)
      ?? applicable[applicable.length - 1]?.section,
    incomplete: rows
      .filter((r) => r.status.status !== 'complete' && r.status.status !== 'na')
      .map((r) => ({
        key: r.section.key,
        name: r.section.name,
        reason: r.section.gate,
        status: r.status.status === 'locked' ? 'locked' : 'in-progress',
      })),
  };
}

// ── Listing summaries (cheap index for the picker, no full load) ──────────────

export interface PlanProjectSummary {
  id: string;
  title: string;
  blueprintId: string;
  blueprintName: string;
  createdAt: number;
  updatedAt: number;
  /** Enabled section count and how many are complete/N-A — for the progress chip. */
  total: number;
  done: number;
  complete: boolean;
}

/** Derive the listing summary for a project (counts via the ported readiness).
 *  Progress is "complete out of applicable" — N/A sections are excluded from both. */
export function summarizeProject(project: PlanProject): PlanProjectSummary {
  const r = projectReadiness(project);
  const applicable = r.sections.filter((s) => s.status.status !== 'na');
  return {
    id: project.id,
    title: project.title,
    blueprintId: project.blueprint.id,
    blueprintName: project.blueprint.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    total: applicable.length,
    done: applicable.filter((s) => s.status.status === 'complete').length,
    complete: r.complete,
  };
}

/** Insert or replace a summary by id, keeping the list sorted most-recent first. */
export function upsertSummary(list: PlanProjectSummary[], s: PlanProjectSummary): PlanProjectSummary[] {
  return [s, ...list.filter((x) => x.id !== s.id)].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Drop a summary by id. */
export function removeSummary(list: PlanProjectSummary[], id: string): PlanProjectSummary[] {
  return list.filter((x) => x.id !== id);
}

// ── Serialization / transfer ──────────────────────────────────────────────────

export function serializePlanProject(project: PlanProject): string {
  return JSON.stringify(project);
}

/** Structural guard for a deserialized/transferred project (rejects junk + wrong schema). */
export function isPlanProject(v: unknown): v is PlanProject {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    o.schema === PLAN_PROJECT_SCHEMA &&
    typeof o.id === 'string' && o.id.length > 0 &&
    typeof o.title === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number' &&
    !!o.blueprint && typeof o.blueprint === 'object' &&
    !!o.sections && typeof o.sections === 'object' &&
    !!o.stage && typeof o.stage === 'object' &&
    !!o.pipelineRuns && typeof o.pipelineRuns === 'object' &&
    !!o.artifacts && typeof o.artifacts === 'object' &&
    Array.isArray(o.messages)
  );
}

export function deserializePlanProject(raw: string): PlanProject | null {
  try {
    const v: unknown = JSON.parse(raw);
    return isPlanProject(v) ? v : null;
  } catch {
    return null;
  }
}
