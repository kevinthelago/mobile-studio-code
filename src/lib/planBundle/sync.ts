import {
  PlanProject,
  PlanSyncManifest,
  ProjectSyncInfo,
  ReconcileResult,
  ProjectReconcile,
  FileSyncAction,
  PlanFileKey,
  PLAN_FILE_KEYS,
} from './types';
import { fnv1a } from './hash';

/**
 * Build a lightweight sync manifest from all local plan projects.
 * Hashes are recomputed here so the manifest always reflects current content.
 */
export function buildSyncManifest(projects: PlanProject[]): PlanSyncManifest {
  const result: Record<string, ProjectSyncInfo> = {};
  for (const p of projects) {
    const files: ProjectSyncInfo['files'] = {};
    for (const key of PLAN_FILE_KEYS) {
      const entry = p.files[key];
      if (entry) {
        files[key] = { hash: fnv1a(entry.content), updatedAt: entry.updatedAt };
      }
    }
    result[p.projectId] = { updatedAt: p.updatedAt, files };
  }
  return { version: 1, projects: result };
}

// Files whose timestamps differ by less than this are treated as concurrent
// edits rather than clear-cut winner/loser — becomes a conflict.
const TIMESTAMP_GRACE_MS = 2000;

/**
 * Compare local (mobile) and remote (desktop) sync manifests and return
 * a per-project action plan: push, pull, diff (per-file push/pull/conflict),
 * or nothing (already in sync). Mobile is the merge authority — it drives.
 */
export function computeReconciliation(
  local: PlanSyncManifest,
  remote: PlanSyncManifest,
): ReconcileResult {
  const byProject: Record<string, ProjectReconcile> = {};
  const allIds = new Set([
    ...Object.keys(local.projects),
    ...Object.keys(remote.projects),
  ]);

  for (const projectId of allIds) {
    const loc = local.projects[projectId];
    const rem = remote.projects[projectId];

    if (!rem) {
      byProject[projectId] = { op: 'push_all', reason: 'missing_on_desktop' };
      continue;
    }
    if (!loc) {
      byProject[projectId] = { op: 'pull_all', reason: 'missing_on_mobile' };
      continue;
    }

    // Both sides have the project — compare file-by-file.
    const actions: FileSyncAction[] = [];
    const allFileKeys = new Set([
      ...Object.keys(loc.files),
      ...Object.keys(rem.files),
    ]) as Set<PlanFileKey>;

    for (const fileKey of allFileKeys) {
      const lf = loc.files[fileKey];
      const rf = rem.files[fileKey];

      if (!rf) {
        actions.push({ action: 'push', fileKey });
      } else if (!lf) {
        actions.push({ action: 'pull', fileKey });
      } else if (lf.hash === rf.hash) {
        // Identical — no action.
      } else {
        const delta = lf.updatedAt - rf.updatedAt;
        if (delta > TIMESTAMP_GRACE_MS) {
          actions.push({ action: 'push', fileKey }); // mobile is clearly newer
        } else if (delta < -TIMESTAMP_GRACE_MS) {
          actions.push({ action: 'pull', fileKey }); // desktop is clearly newer
        } else {
          // Hashes differ but neither side is a clear winner → conflict.
          actions.push({
            action: 'conflict',
            fileKey,
            mobileUpdatedAt: lf.updatedAt,
            desktopUpdatedAt: rf.updatedAt,
          });
        }
      }
    }

    if (actions.length > 0) {
      byProject[projectId] = { op: 'diff', actions };
    }
    // If actions is empty, the projects are already in sync — omit from result.
  }

  return { byProject };
}

export function hasConflicts(result: ReconcileResult): boolean {
  for (const rec of Object.values(result.byProject)) {
    if (rec.op === 'diff' && rec.actions.some((a) => a.action === 'conflict')) {
      return true;
    }
  }
  return false;
}

/** Extract only the per-file actions of a given type from a ReconcileResult. */
export function actionsOfType<T extends FileSyncAction['action']>(
  result: ReconcileResult,
  projectId: string,
  type: T,
): Extract<FileSyncAction, { action: T }>[] {
  const rec = result.byProject[projectId];
  if (!rec || rec.op !== 'diff') return [];
  return rec.actions.filter((a): a is Extract<FileSyncAction, { action: T }> => a.action === type);
}
