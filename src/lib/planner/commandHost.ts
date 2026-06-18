// Threads the active PlanProject through a batch of pipeline command dispatches.
// The ported command bus (pipelineCommands.ts) calls a PipelineModule's side-
// effecting `command(cmd, ctx)` — on desktop the module persists via writeProjectFile.
// On mobile our state is an immutable PlanProject in the store, so the store opens a
// batch with the current project, the modules read/patch it through this host, and
// the store extracts the result and persists it. Single-threaded: only the store's
// (guarded) sendMessage opens a batch, one command at a time.

import type { PlanProject } from './project';

let working: PlanProject | null = null;

export function beginCommandBatch(project: PlanProject): void {
  working = project;
}

export function commandProject(): PlanProject {
  if (!working) throw new Error('No active pipeline command batch');
  return working;
}

export function patchCommandProject(patch: (p: PlanProject) => PlanProject): void {
  working = patch(commandProject());
}

export function endCommandBatch(): PlanProject {
  const p = commandProject();
  working = null;
  return p;
}
