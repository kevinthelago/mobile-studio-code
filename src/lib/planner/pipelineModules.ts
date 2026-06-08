// Command modules for Claude-driven pipelines. Claude reaches a pipeline only via
// <pipeline id="…" cmd="…"/> tags, which the store routes through the ported
// dispatchPipelineCommand → these modules. Each maps the standardized commands to a
// patch on the active PlanProject (via commandHost). v1 covers the builtin handlers
// (lint-plan / grade-plan), which are single-shot, so the multi-screen navigation
// commands (prev/next/goto) and save/delete are no-ops for now.

import {
  registerPipeline, enabledSections,
  type PipelineModule, type PipelineRunState,
} from './core';
import { runProjectPipeline } from './pipelines';
import { commandProject, patchCommandProject } from './commandHost';
import type { PlanProject } from './project';

/** Set the run state of every enabled-section pipeline instance with `id`. */
function markRuns(project: PlanProject, id: string, run: PipelineRunState): PlanProject {
  const runs = { ...project.pipelineRuns };
  for (const s of enabledSections(project.blueprint.sections)) {
    for (const p of s.pipelines) if (p.id === id) runs[p.uid] = run;
  }
  return { ...project, pipelineRuns: runs };
}

/** Run every enabled-section pipeline instance with `id` through its handler. */
async function runAll(project: PlanProject, id: string): Promise<PlanProject> {
  let p = project;
  for (const s of enabledSections(p.blueprint.sections)) {
    for (const pl of s.pipelines) {
      if (pl.id === id) p = await runProjectPipeline(p, s.key, pl, 'tag');
    }
  }
  return p;
}

/** The command module for one pipeline id (exported for tests). */
export function pipelineCommandModule(id: string): PipelineModule {
  return {
    id,
    command: async (cmd) => {
      switch (cmd) {
        case 'run': {
          const next = await runAll(commandProject(), id);
          patchCommandProject(() => next);
          break;
        }
        case 'confirm': // accept the result → clears a gate
          patchCommandProject((p) => markRuns(p, id, { status: 'ok', lastRun: Date.now() }));
          break;
        case 'restart':
        case 'delete':
          patchCommandProject((p) => markRuns(p, id, { status: 'idle', lastRun: null }));
          break;
        // save / prev / next / goto — no-op for the single-shot builtins.
      }
    },
  };
}

let registered = false;
/** Register command modules for the builtin pipelines (idempotent). */
export function registerBuiltinPipelineModules(): void {
  if (registered) return;
  registered = true;
  for (const id of ['lint-plan', 'grade-plan']) registerPipeline(pipelineCommandModule(id));
}
