// 3-way reconcile over canonical file maps. Given the BASE (last-synced ancestor),
// LOCAL, and REMOTE maps for a project, classify each file into an action. Clean
// results auto-apply; conflicts go to the editor. Pure + deterministic.
//
// Local-only deletions (v1): a file ABSENT on one side is treated as "no change from
// that side" — never a propagated delete. (A stale copy can therefore linger, by
// design.) Truly new files (present on one side, absent from base) are additions.

import { mergeFile, type MergeResult } from './merge';

export type FileMap = Record<string, string>;

export type ReconcileAction =
  | { path: string; type: 'unchanged'; content: string }
  | { path: string; type: 'take-remote'; content: string }
  | { path: string; type: 'keep-local'; content: string }
  | { path: string; type: 'merged'; content: string }
  | { path: string; type: 'conflict'; result: MergeResult; base: string; local: string; remote: string };

export interface Reconciliation {
  actions: ReconcileAction[];
  conflicts: number;
  /** No conflicts → the result can be applied without the editor. */
  clean: boolean;
}

export function reconcile(base: FileMap, local: FileMap, remote: FileMap): Reconciliation {
  const paths = [...new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])].sort();
  const actions: ReconcileAction[] = [];
  let conflicts = 0;

  for (const path of paths) {
    const bc = base[path];
    const lc = local[path];
    const rc = remote[path];
    const baseContent = bc ?? '';
    const localChanged = lc !== undefined && lc !== baseContent;
    const remoteChanged = rc !== undefined && rc !== baseContent;

    if (!localChanged && !remoteChanged) {
      actions.push({ path, type: 'unchanged', content: lc ?? rc ?? bc ?? '' });
    } else if (localChanged && !remoteChanged) {
      actions.push({ path, type: 'keep-local', content: lc! });
    } else if (!localChanged && remoteChanged) {
      actions.push({ path, type: 'take-remote', content: rc! });
    } else if (lc === rc) {
      actions.push({ path, type: 'merged', content: lc! }); // both made the same edit
    } else {
      const result = mergeFile(path, baseContent, lc!, rc!);
      if (result.clean && result.merged !== undefined) {
        actions.push({ path, type: 'merged', content: result.merged });
      } else {
        actions.push({ path, type: 'conflict', result, base: baseContent, local: lc!, remote: rc! });
        conflicts++;
      }
    }
  }

  return { actions, conflicts, clean: conflicts === 0 };
}

/**
 * Build the final agreed file map from a reconciliation. Conflict paths must be
 * supplied in `resolved` (path → chosen/edited content); a missing resolution
 * throws. Empty-content files are dropped (they map back to empty sections).
 */
export function applyResolutions(rec: Reconciliation, resolved: Record<string, string> = {}): FileMap {
  const out: FileMap = {};
  for (const a of rec.actions) {
    const content = a.type === 'conflict'
      ? (resolved[a.path] ?? (() => { throw new Error(`Unresolved conflict: ${a.path}`); })())
      : a.content;
    if (content !== '') out[a.path] = content;
  }
  return out;
}
