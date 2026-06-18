// Derive the typed PlanStageState (the gate signal source) from a PlanProject's
// filled-in sections. This is the mobile counterpart to the desktop's
// derivePlanStageState — which we could not port verbatim because it reads the
// desktop's live section taxonomy (planSections.ts/ghStructure.ts). The section
// KEYS below are the conventions the planner system prompt instructs Claude to use
// (see prompt.ts); keep the two in lockstep, and reconcile with desktop when its
// taxonomy is shared.

import { buildPlanStageState, type PlanStageState } from './core';
import type { PlanProject } from './project';

/** Discovery checklist topics that make up the Context stage. */
export const CONTEXT_TOPICS = [
  'goal', 'users', 'scope', 'ux', 'stack', 'architecture', 'schema', 'api', 'security', 'testing',
] as const;
/** The core four the planner always confirms. */
export const CORE_TOPICS = ['goal', 'scope', 'stack', 'architecture'] as const;

/** Count the entries of a JSON-array artifact; 0 if absent/unparseable. */
function jsonArrayLen(content: string | undefined): number {
  if (!content) return 0;
  try { const v = JSON.parse(content); return Array.isArray(v) ? v.length : 0; } catch { return 0; }
}

function parseFleet(content: string | undefined): { streams: number; profilesComplete: boolean } {
  if (!content) return { streams: 0, profilesComplete: false };
  try {
    const v = JSON.parse(content);
    const streams: unknown[] = Array.isArray(v) ? v : Array.isArray(v?.streams) ? v.streams : [];
    const profilesComplete = streams.length > 0 && streams.every(
      (s) => s && typeof s === 'object' && !!(s as Record<string, unknown>).profile,
    );
    return { streams: streams.length, profilesComplete };
  } catch {
    return { streams: 0, profilesComplete: false };
  }
}

function parseScreens(content: string | undefined): { approved: number; total: number } {
  if (!content) return { approved: 0, total: 0 };
  try {
    const v = JSON.parse(content);
    const screens: Record<string, unknown>[] = Array.isArray(v) ? v : Array.isArray(v?.screens) ? v.screens : [];
    return { total: screens.length, approved: screens.filter((s) => !!s?.approved).length };
  } catch {
    return { approved: 0, total: 0 };
  }
}

/**
 * Build the gate signal snapshot from the project's sections + artifacts. Section
 * keys are matched leniently (with or without a file extension) so the planner can
 * write either `phases` or `phases.json`.
 */
export function deriveStageFromProject(project: PlanProject): PlanStageState {
  const sec = project.sections;
  const has = (k: string) => !!sec[k];
  const confirmed = (k: string) => sec[k]?.state === 'confirmed';
  // Resolve a key that may be written with or without an extension.
  const pick = (...keys: string[]) => keys.find((k) => has(k));
  const content = (...keys: string[]) => {
    const k = pick(...keys);
    return k ? sec[k].content : undefined;
  };

  const topics = CONTEXT_TOPICS.filter((k) => has(k));
  const resolved = topics.filter((k) => confirmed(k)).length;
  // A core topic is OK if confirmed or simply not surfaced (skipped by omission).
  const coreConfirmed = CORE_TOPICS.every((k) => !has(k) || confirmed(k));

  const repoCount = jsonArrayLen(content('repos.json', 'repos')) ||
    (confirmed('repos') ? 1 : 0);

  const requiresUi = has('ui') || has('ui.md') || has('screens') || has('screens.json');
  const ui = parseScreens(content('screens.json', 'screens'));

  const phasesConfirmed = confirmed('phases.json') || confirmed('phases') ||
    jsonArrayLen(content('phases.json', 'phases')) > 0;
  const issueCount = jsonArrayLen(content('issues.json', 'issues'));

  const fleet = parseFleet(content('fleet.json', 'fleet', 'permissions'));

  const automationsAck = confirmed('automations.md') || confirmed('automations');
  const skillsAck = confirmed('skills.json') || confirmed('skills');

  return buildPlanStageState({
    context: { resolved, total: topics.length, coreConfirmed },
    repoCount,
    requiresUi,
    ui,
    phasesConfirmed,
    issueCount,
    fleet,
    automationsAck,
    skillsAck,
  });
}
