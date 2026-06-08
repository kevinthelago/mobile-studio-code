import { useEffect, useRef } from 'react';
import { useTunnel } from '../lib/TunnelContext';
import {
  listProjectIds, loadProjectFile, saveProjectFile, readIndex, writeIndex,
} from '../lib/planner/persistence';
import { summarizeProject, upsertSummary, type PlanProject } from '../lib/planner/project';
import { readSyncBase, writeSyncBase } from '../lib/planner/sync/baseStore';
import { reconcileOnConnect, type SyncDeps } from '../lib/planner/sync/coordinator';

/**
 * Runs the planner's reconcile-on-connect over the tunnel: on connect it asks the
 * desktop for its manifest; when that arrives it reconciles every project (auto-merge
 * applies + pushes, conflicts are parked for the editor). Renders nothing. Mounted
 * inside TunnelProvider, alongside FcmBootstrap.
 */
export function PlannerSyncRunner() {
  const { connectionState, syncRequestManifest, syncPull, syncPush, setSyncManifestHandler } = useTunnel();
  const runningRef = useRef(false);

  useEffect(() => {
    const deps: SyncDeps = {
      localProjects: async () => {
        const ids = await listProjectIds();
        const loaded = await Promise.all(ids.map((id) => loadProjectFile(id)));
        return loaded.filter((p): p is PlanProject => p !== null);
      },
      readBase: (id) => readSyncBase(id),
      writeMerged: async (project, base) => {
        await saveProjectFile(project);
        await writeSyncBase(project.id, base);
        const idx = await readIndex();
        await writeIndex(upsertSummary(idx, summarizeProject(project)));
      },
      pull: (projectId, paths) => syncPull(projectId, paths),
      push: ({ projectId, title, files }) => syncPush(projectId, title, files),
      now: () => Date.now(),
    };

    setSyncManifestHandler((projects) => {
      if (runningRef.current) return;
      runningRef.current = true;
      reconcileOnConnect(projects, deps)
        .then((r) => {
          console.log(
            `planner sync: merged=${r.merged.length} adopted=${r.adopted.length} `
            + `pushed=${r.pushed.length} conflicts=${r.conflicts.length}`,
          );
          // TODO(conflict editor): surface r.conflicts for resolution + finishSync.
        })
        .catch((e) => console.warn('planner sync failed:', (e as Error)?.message ?? e))
        .finally(() => { runningRef.current = false; });
    });
    return () => setSyncManifestHandler(null);
  }, [setSyncManifestHandler, syncPull, syncPush]);

  // Kick off a sync each time the tunnel reaches "connected".
  useEffect(() => {
    if (connectionState === 'connected') syncRequestManifest();
  }, [connectionState, syncRequestManifest]);

  return null;
}
