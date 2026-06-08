// Integration between the ported pipeline engine and a PlanProject: build a
// StageContext from the project's artifacts, run a pipeline, and record its run
// state on the project. Gate evaluation (isGateBlocked) lives in project.ts's
// readiness so a gate pipeline that hasn't passed blocks section completion.

import {
  type Pipeline, type StageContext, type PipelineTrigger,
  runPipeline, pipelinesForTrigger, enabledSections,
} from './core';
import { projectReadiness, type PlanProject } from './project';

/** A read-only artifact map for handlers: every section's content + generated files. */
export function buildStageContext(
  project: PlanProject, sectionKey: string, trigger: StageContext['trigger'],
): StageContext {
  const artifacts: Record<string, string> = {};
  for (const [k, v] of Object.entries(project.sections)) artifacts[k] = v.content;
  for (const [k, v] of Object.entries(project.artifacts)) artifacts[k] = v;
  return { projectKey: project.id, stageId: sectionKey, artifacts, trigger };
}

/** Run one pipeline through its handler and return the project with the result recorded. */
export async function runProjectPipeline(
  project: PlanProject, sectionKey: string, pipeline: Pipeline, trigger: StageContext['trigger'],
): Promise<PlanProject> {
  const result = await runPipeline(pipeline, buildStageContext(project, sectionKey, trigger));
  return {
    ...project,
    pipelineRuns: {
      ...project.pipelineRuns,
      [pipeline.uid]: { status: result.status, lastRun: Date.now(), message: result.message },
    },
  };
}

/**
 * Run every enabled pipeline on the given sections that matches `trigger`,
 * accumulating run states. `sectionKeys === null` ⇒ all enabled sections.
 */
export async function firePipelinesForTrigger(
  project: PlanProject, sectionKeys: string[] | null, trigger: PipelineTrigger,
): Promise<PlanProject> {
  let cur = project;
  for (const section of enabledSections(project.blueprint.sections)) {
    if (sectionKeys && !sectionKeys.includes(section.key)) continue;
    for (const p of pipelinesForTrigger(section.pipelines, trigger)) {
      cur = await runProjectPipeline(cur, section.key, p, trigger);
    }
  }
  return cur;
}

/** Section keys that went from not-complete to complete between two project states. */
export function newlyCompleteSections(prev: PlanProject, next: PlanProject): string[] {
  const done = (p: PlanProject) =>
    new Set(projectReadiness(p).sections.filter((s) => s.status.status === 'complete').map((s) => s.section.key));
  const before = done(prev);
  return [...done(next)].filter((k) => !before.has(k));
}
