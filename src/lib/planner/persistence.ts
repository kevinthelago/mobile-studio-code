// Local persistence for planner projects. Mirrors the repo store's pattern
// (expo-file-system/legacy under documentDirectory + atomic writes) but on a
// parallel tree keyed by the stable project id:
//
//   planner/
//     index.json                 — array of PlanProjectSummary (cheap listing)
//     projects/<id>/project.json — the serialized PlanProject (the whole plan)
//
// The whole PlanProject lives in one project.json (it IS the Plan Bundle payload),
// so a project is one serializable unit for the future cross-device transfer (#103).

import * as FileSystem from 'expo-file-system/legacy';
import { atomicWriteText, readText, exists, listDir, ensureDir } from '../fs';
import {
  serializePlanProject, deserializePlanProject,
  type PlanProject, type PlanProjectSummary,
} from './project';

const PLANNER_ROOT = (FileSystem.documentDirectory ?? '') + 'planner/';
const PROJECTS_ROOT = PLANNER_ROOT + 'projects/';
const INDEX_PATH = PLANNER_ROOT + 'index.json';

function projectDir(id: string): string { return PROJECTS_ROOT + id + '/'; }
function projectPath(id: string): string { return projectDir(id) + 'project.json'; }

export async function saveProjectFile(project: PlanProject): Promise<void> {
  await ensureDir(projectDir(project.id));
  await atomicWriteText(projectPath(project.id), serializePlanProject(project));
}

export async function loadProjectFile(id: string): Promise<PlanProject | null> {
  const p = projectPath(id);
  if (!(await exists(p))) return null;
  try {
    return deserializePlanProject(await readText(p));
  } catch {
    return null;
  }
}

export async function deleteProjectDir(id: string): Promise<void> {
  await FileSystem.deleteAsync(projectDir(id), { idempotent: true });
}

export async function readIndex(): Promise<PlanProjectSummary[]> {
  if (!(await exists(INDEX_PATH))) return [];
  try {
    const arr: unknown = JSON.parse(await readText(INDEX_PATH));
    return Array.isArray(arr) ? (arr as PlanProjectSummary[]) : [];
  } catch {
    return [];
  }
}

export async function writeIndex(summaries: PlanProjectSummary[]): Promise<void> {
  await ensureDir(PLANNER_ROOT);
  await atomicWriteText(INDEX_PATH, JSON.stringify(summaries, null, 2));
}

/** Project ids present on disk (the directory names under projects/). */
export async function listProjectIds(): Promise<string[]> {
  return listDir(PROJECTS_ROOT);
}
