// Reconcile-on-connect coordinator — the wire's brain. Given the peer's manifest and
// injected I/O (pull + persistence), reconcile every project: merge clean, adopt
// new-from-remote, push local-only, and park conflicts for the editor. The I/O is
// injected so this orchestration is unit-testable; the TunnelClient transport and the
// hook that builds the deps are thin adapters around it.

import type { PlanSyncManifestEntry } from '../../types';
import type { PlanProject } from '../project';
import { projectToFileMap, fileMapToProject } from './fileMap';
import { pathsToPull, assembleRemoteMap } from './syncPlanner';
import { planSync, type SyncOutcome } from './orchestrator';
import type { FileMap } from './reconcile';

export interface SyncDeps {
  /** All locally-stored projects. */
  localProjects: () => Promise<PlanProject[]>;
  /** The stored sync base for a project ({} if never synced). */
  readBase: (projectId: string) => Promise<FileMap>;
  /** Persist a (merged/adopted) project AND its new base. */
  writeMerged: (project: PlanProject, base: FileMap) => Promise<void>;
  /** Fetch specific files from the peer for a project. */
  pull: (projectId: string, paths: string[]) => Promise<FileMap>;
  /** Push the agreed canonical map to the peer. */
  push: (entry: { projectId: string; title: string; files: FileMap }) => Promise<void>;
  /** Injected clock. */
  now: () => number;
}

/** A project whose sync needs the conflict editor; resolve via finishSync(local, outcome, …). */
export interface PendingConflict {
  projectId: string;
  local: PlanProject;
  outcome: SyncOutcome;
}

export interface SyncReport {
  merged: string[];
  adopted: string[];
  pushed: string[];
  conflicts: PendingConflict[];
}

/**
 * Reconcile every project against the peer's manifest. Clean results are applied +
 * pushed immediately; conflicts are returned for the editor (nothing is applied for
 * those until resolved). Idempotent — safe to re-run.
 */
export async function reconcileOnConnect(
  manifest: PlanSyncManifestEntry[], deps: SyncDeps,
): Promise<SyncReport> {
  const report: SyncReport = { merged: [], adopted: [], pushed: [], conflicts: [] };
  const locals = await deps.localProjects();
  const localById = new Map(locals.map((p) => [p.id, p]));
  const remoteIds = new Set(manifest.map((m) => m.projectId));

  // 1. Projects the peer has.
  for (const entry of manifest) {
    const local = localById.get(entry.projectId) ?? null;
    const localMap = local ? projectToFileMap(local) : {};
    const need = pathsToPull(localMap, entry.files);
    const pulled = need.length ? await deps.pull(entry.projectId, need) : {};
    const remoteMap = assembleRemoteMap(localMap, entry.files, pulled);

    if (!local) {
      // New on the peer → adopt it; base = the remote map; push back so both set base.
      const project = fileMapToProject(remoteMap, { id: entry.projectId, now: deps.now() });
      if (!project) continue; // invalid plan.json — skip
      await deps.writeMerged(project, remoteMap);
      await deps.push({ projectId: entry.projectId, title: project.title, files: remoteMap });
      report.adopted.push(entry.projectId);
      report.pushed.push(entry.projectId);
      continue;
    }

    const base = await deps.readBase(entry.projectId);
    const outcome = planSync(local, remoteMap, base, deps.now());
    if (outcome.resolved) {
      await deps.writeMerged(outcome.resolved.project, outcome.resolved.base);
      await deps.push({
        projectId: entry.projectId,
        title: outcome.resolved.project.title,
        files: outcome.resolved.base,
      });
      report.merged.push(entry.projectId);
      report.pushed.push(entry.projectId);
    } else {
      report.conflicts.push({ projectId: entry.projectId, local, outcome });
    }
  }

  // 2. Local-only projects → push to the peer and set the base.
  for (const local of locals) {
    if (remoteIds.has(local.id)) continue;
    const map = projectToFileMap(local);
    await deps.push({ projectId: local.id, title: local.title, files: map });
    await deps.writeMerged(local, map);
    report.pushed.push(local.id);
  }

  return report;
}
