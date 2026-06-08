// Apply Claude's <pipeline id cmd=…/> tags to a project. Parses them with the
// ported parsePipelineTags and routes each through the ported dispatchPipelineCommand;
// the registered command modules (pipelineModules.ts) patch the project via the batch
// host. dispatchPipelineCommand never throws, so a bad/unknown id is a structured
// no-op.

import { parsePipelineTags, dispatchPipelineCommand } from './core';
import { beginCommandBatch, endCommandBatch } from './commandHost';
import type { PlanProject } from './project';

export async function applyPipelineTags(project: PlanProject, rawReply: string): Promise<PlanProject> {
  const tags = parsePipelineTags(rawReply);
  if (tags.length === 0) return project;
  beginCommandBatch(project);
  try {
    for (const tag of tags) {
      await dispatchPipelineCommand(tag.id, tag.cmd, { projectKey: project.id, args: tag.args });
    }
  } finally {
    // endCommandBatch always returns the (possibly patched) working project.
  }
  return endCommandBatch();
}
