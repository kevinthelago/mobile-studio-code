// Per-project sync base: the canonical file map as of the last successful sync (the
// merge ancestor). Stored at planner/base/<projectId>.json, parallel to the project
// store. Mirrors persistence.ts (expo-file-system/legacy + atomic writes).

import * as FileSystem from 'expo-file-system/legacy';
import { atomicWriteText, readText, exists } from '../../fs';
import type { FileMap } from './reconcile';

const BASE_ROOT = (FileSystem.documentDirectory ?? '') + 'planner/base/';

function basePath(projectId: string): string {
  return `${BASE_ROOT}${projectId}.json`;
}

/** The stored base for a project, or {} if it has never synced. */
export async function readSyncBase(projectId: string): Promise<FileMap> {
  const p = basePath(projectId);
  if (!(await exists(p))) return {};
  try {
    const v: unknown = JSON.parse(await readText(p));
    return v && typeof v === 'object' ? (v as FileMap) : {};
  } catch {
    return {};
  }
}

export async function writeSyncBase(projectId: string, map: FileMap): Promise<void> {
  await atomicWriteText(basePath(projectId), JSON.stringify(map));
}

export async function deleteSyncBase(projectId: string): Promise<void> {
  await FileSystem.deleteAsync(basePath(projectId), { idempotent: true });
}
