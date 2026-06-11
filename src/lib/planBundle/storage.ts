import * as FileSystem from 'expo-file-system/legacy';
import { PlanProject, PlanSyncManifest } from './types';
import { ensureDir, atomicWriteText } from '../fs';
import { buildSyncManifest } from './sync';

export const PLANS_ROOT = (FileSystem.documentDirectory ?? '') + 'plans/';

/** Sanitize a projectId so it's safe as a filename component. */
function safeId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function planProjectPath(projectId: string): string {
  return PLANS_ROOT + safeId(projectId) + '.json';
}

export async function listPlanProjects(): Promise<PlanProject[]> {
  const info = await FileSystem.getInfoAsync(PLANS_ROOT);
  if (!info.exists) return [];
  const names = await FileSystem.readDirectoryAsync(PLANS_ROOT);
  const results: PlanProject[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const text = await FileSystem.readAsStringAsync(PLANS_ROOT + name);
      results.push(JSON.parse(text) as PlanProject);
    } catch {
      // Skip corrupted entries.
    }
  }
  return results;
}

export async function readPlanProject(projectId: string): Promise<PlanProject | null> {
  const p = planProjectPath(projectId);
  const info = await FileSystem.getInfoAsync(p);
  if (!info.exists) return null;
  try {
    const text = await FileSystem.readAsStringAsync(p);
    return JSON.parse(text) as PlanProject;
  } catch {
    return null;
  }
}

export async function writePlanProject(project: PlanProject): Promise<void> {
  await ensureDir(PLANS_ROOT);
  await atomicWriteText(planProjectPath(project.projectId), JSON.stringify(project));
}

export async function deletePlanProject(projectId: string): Promise<void> {
  await FileSystem.deleteAsync(planProjectPath(projectId), { idempotent: true });
}

/** Build the lightweight sync manifest from all locally stored plan projects. */
export async function buildLocalManifest(): Promise<PlanSyncManifest> {
  const projects = await listPlanProjects();
  return buildSyncManifest(projects);
}

/**
 * Apply a subset of files from a received PlanProject to the locally stored
 * version. If no local project exists, the received project is stored as-is.
 * fileKeys controls which files to apply (undefined = all files in received).
 */
export async function applyProjectFiles(
  received: PlanProject,
  fileKeys?: string[],
): Promise<void> {
  const existing = await readPlanProject(received.projectId);
  if (!existing) {
    await writePlanProject(received);
    return;
  }
  const keysToApply = fileKeys ?? Object.keys(received.files);
  const mergedFiles = { ...existing.files };
  let maxUpdatedAt = existing.updatedAt;
  for (const key of keysToApply) {
    const entry = received.files[key as keyof typeof received.files];
    if (entry) {
      mergedFiles[key as keyof typeof mergedFiles] = entry;
      if (entry.updatedAt > maxUpdatedAt) maxUpdatedAt = entry.updatedAt;
    }
  }
  await writePlanProject({
    ...existing,
    files: mergedFiles,
    updatedAt: maxUpdatedAt,
  });
}
