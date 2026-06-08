// Apply a planner assistant reply to a PlanProject: parse the content tags, write
// section/artifact content, recompute the gate signals, and append the turn. Pure
// (no network/RN) so the whole tag→state transition is unit-testable.

import { parsePlanUpdates, parsePlanFocus } from './planTag';
import { deriveStageFromProject } from './derive';
import type { PlanProject } from './project';

/** A key that looks like a generated file (has an extension) is mirrored into
 *  `artifacts` for transfer, in addition to living in `sections`. */
function isArtifactKey(key: string): boolean {
  return /\.(json|md)$/i.test(key);
}

/** Append a user turn (no tag effects). */
export function appendUserMessage(project: PlanProject, text: string): PlanProject {
  return { ...project, messages: [...project.messages, { role: 'user', text }] };
}

export interface ApplyResult {
  project: PlanProject;
  /** The section the reply asked to focus (last <plan_focus>), for UI highlight. */
  focus: string | null;
}

/**
 * Apply an assistant reply: upsert every <plan_update> section (marked confirmed),
 * recompute `stage` from the new sections, record the focus, and append the raw
 * assistant turn (the UI strips tags at render).
 */
export function applyAssistantReply(project: PlanProject, rawReply: string): ApplyResult {
  const updates = parsePlanUpdates(rawReply);
  const focusKeys = parsePlanFocus(rawReply);

  const sections = { ...project.sections };
  const artifacts = { ...project.artifacts };
  for (const u of updates) {
    sections[u.section] = { state: 'confirmed', content: u.content };
    if (isArtifactKey(u.section)) artifacts[u.section] = u.content;
  }

  const next: PlanProject = {
    ...project,
    sections,
    artifacts,
    messages: [...project.messages, { role: 'assistant', text: rawReply }],
  };
  // Recompute the gate signals from the updated sections so readiness goes live.
  next.stage = deriveStageFromProject(next);

  return { project: next, focus: focusKeys.length ? focusKeys[focusKeys.length - 1] : null };
}
