// Sync orchestrator: compose the pure foundation into a per-project sync.
//   projectToFileMap(local) + base + remote → reconcile → (resolve) → merged map →
//   fileMapToProject → the merged project + the new base.
// MSC is the merge authority: conflicts are resolved here (the editor) before the
// merged map is pushed to the peer. Pure — no FS/network.

import { projectToFileMap, fileMapToProject } from './fileMap';
import { reconcile, applyResolutions, type FileMap, type Reconciliation, type ReconcileAction } from './reconcile';
import type { PlanProject } from '../project';

export interface SyncResolved {
  /** The merged project (signals re-derived). Adopt this locally + push its map. */
  project: PlanProject;
  /** The new sync base = the merged canonical file map. Persist on both devices. */
  base: FileMap;
}

export interface SyncOutcome {
  reconciliation: Reconciliation;
  /** The conflict actions awaiting resolution (empty when clean). */
  conflicts: Extract<ReconcileAction, { type: 'conflict' }>[];
  /** Set when there were no conflicts — ready to apply immediately. */
  resolved?: SyncResolved;
}

function build(local: PlanProject, rec: Reconciliation, resolved: Record<string, string>, now: number): SyncResolved {
  const base = applyResolutions(rec, resolved);
  const project = fileMapToProject(base, { id: local.id, now, base: local });
  if (!project) throw new Error('sync produced an invalid plan.json');
  return { project, base };
}

/**
 * Reconcile a local project against a peer's file map (given the shared base). When
 * clean, `resolved` carries the merged project + new base. When conflicting,
 * `conflicts` lists what the editor must resolve; finish with {@link finishSync}.
 */
export function planSync(local: PlanProject, remote: FileMap, base: FileMap, now: number): SyncOutcome {
  const rec = reconcile(base, projectToFileMap(local), remote);
  const conflicts = rec.actions.filter(
    (a): a is Extract<ReconcileAction, { type: 'conflict' }> => a.type === 'conflict',
  );
  if (rec.clean) {
    return { reconciliation: rec, conflicts: [], resolved: build(local, rec, {}, now) };
  }
  return { reconciliation: rec, conflicts };
}

/** Finish a conflicted sync once every conflict path has a chosen/edited content. */
export function finishSync(
  local: PlanProject, outcome: SyncOutcome, resolutions: Record<string, string>, now: number,
): SyncResolved {
  return build(local, outcome.reconciliation, resolutions, now);
}
