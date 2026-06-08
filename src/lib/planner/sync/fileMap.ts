// Bridge between the mobile PlanProject envelope and the canonical file map both
// apps sync over. The file map is { relpath → canonical content }: one file per
// non-empty section plus plan.json (blueprint id, title, section states). The
// conversation and pipeline run states are device-local and NOT synced. On import,
// gate signals are RE-DERIVED from the synced files (not carried).

import { canonicalize, canonicalJson } from './canonical';
import { makeBlueprints, buildPlanStageState, type Blueprint } from '../core';
import { deriveStageFromProject } from '../derive';
import { PLAN_PROJECT_SCHEMA, type PlanProject, type SectionState } from '../project';

export const PLAN_FILE = 'plan.json';
const PLAN_META_SCHEMA = 1;

/** Deterministic filename for a section key — shared by both apps. Bare topic keys
 *  (goal, scope, …) become `${key}.md`; keys that already carry an extension
 *  (issues.json, automations.md) are used verbatim. */
export function filenameForKey(key: string): string {
  return key.includes('.') ? key : `${key}.md`;
}

interface PlanMeta {
  schema: number;
  blueprintId: string;
  title: string;
  /** Section key → lifecycle state. The content lives in the section's own file. */
  sections: Record<string, SectionState>;
}

function isArtifactKey(key: string): boolean {
  return /\.(json|md)$/i.test(key);
}

/** Reduce a project to the canonical syncable file map (artifacts + plan.json). */
export function projectToFileMap(project: PlanProject): Record<string, string> {
  const map: Record<string, string> = {};
  const sections: Record<string, SectionState> = {};
  for (const [key, sec] of Object.entries(project.sections)) {
    sections[key] = sec.state;
    if (sec.content.trim() !== '') {
      const path = filenameForKey(key);
      map[path] = canonicalize(path, sec.content);
    }
  }
  const meta: PlanMeta = {
    schema: PLAN_META_SCHEMA,
    blueprintId: project.blueprint.id,
    title: project.title,
    sections,
  };
  map[PLAN_FILE] = canonicalJson(meta);
  return map;
}

/**
 * Reconstruct a PlanProject from a canonical file map. Local-only fields (id,
 * createdAt, messages, pipelineRuns) come from `base` when updating an existing
 * project, else from opts/defaults. Signals are re-derived from the files. Returns
 * null if plan.json is missing/invalid and no fallback blueprint resolves.
 */
export function fileMapToProject(
  fileMap: Record<string, string>,
  opts: { id: string; now: number; base?: PlanProject | null },
): PlanProject | null {
  let meta: PlanMeta | null = null;
  try {
    const parsed = JSON.parse(fileMap[PLAN_FILE] ?? '') as PlanMeta;
    if (parsed && typeof parsed === 'object' && parsed.sections && typeof parsed.sections === 'object') {
      meta = parsed;
    }
  } catch {
    meta = null;
  }
  if (!meta) return null;

  const blueprint: Blueprint | undefined =
    makeBlueprints().find((b) => b.id === meta!.blueprintId) ?? opts.base?.blueprint;
  if (!blueprint) return null;

  const sections: PlanProject['sections'] = {};
  const artifacts: Record<string, string> = {};
  for (const [key, state] of Object.entries(meta.sections)) {
    const content = fileMap[filenameForKey(key)] ?? '';
    sections[key] = { state, content };
    if (isArtifactKey(key) && content) artifacts[key] = content;
  }

  const project: PlanProject = {
    schema: PLAN_PROJECT_SCHEMA,
    id: opts.id,
    title: typeof meta.title === 'string' && meta.title ? meta.title : (opts.base?.title ?? 'Project'),
    createdAt: opts.base?.createdAt ?? opts.now,
    updatedAt: opts.now,
    blueprint,
    sections,
    stage: opts.base?.stage ?? buildPlanStageState(),
    pipelineRuns: opts.base?.pipelineRuns ?? {},
    artifacts,
    messages: opts.base?.messages ?? [],
  };
  // Re-derive gate signals from the (merged) sections so readiness is consistent.
  project.stage = deriveStageFromProject(project);
  return project;
}
