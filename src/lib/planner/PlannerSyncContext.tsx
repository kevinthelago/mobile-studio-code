import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTunnel } from '../TunnelContext';
import {
  listProjectIds, loadProjectFile, saveProjectFile, readIndex, writeIndex,
} from './persistence';
import { summarizeProject, upsertSummary, type PlanProject } from './project';
import { readSyncBase, writeSyncBase } from './sync/baseStore';
import {
  reconcileOnConnect, type SyncDeps, type SyncReport, type PendingConflict,
} from './sync/coordinator';
import { finishSync } from './sync/orchestrator';

export type PlannerSyncStatus = 'idle' | 'syncing' | 'done' | 'error';

export interface PlannerSyncValue {
  status: PlannerSyncStatus;
  /** Last reconcile report (counts), or null. */
  report: SyncReport | null;
  /** Projects awaiting conflict resolution. */
  conflicts: PendingConflict[];
  /** Apply a project's resolutions (path → resolved content), then push to the peer. */
  resolveProject: (projectId: string, resolutions: Record<string, string>) => Promise<void>;
  /** Drop a project's parked conflicts from the UI (re-surfaces on the next sync). */
  dismiss: (projectId: string) => void;
}

const PlannerSyncContext = createContext<PlannerSyncValue | null>(null);

export function usePlannerSync(): PlannerSyncValue {
  const ctx = useContext(PlannerSyncContext);
  if (!ctx) throw new Error('usePlannerSync must be used inside PlannerSyncProvider');
  return ctx;
}

export function PlannerSyncProvider({ children }: { children: React.ReactNode }) {
  const { connectionState, syncRequestManifest, syncPull, syncPush, setSyncManifestHandler } = useTunnel();
  const [status, setStatus] = useState<PlannerSyncStatus>('idle');
  const [report, setReport] = useState<SyncReport | null>(null);
  const [conflicts, setConflicts] = useState<PendingConflict[]>([]);
  const runningRef = useRef(false);

  // SyncDeps over planner persistence + the tunnel — shared by the auto-sync and
  // by resolveProject (writeMerged + push after the editor finishes).
  const deps = useMemo<SyncDeps>(() => ({
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
  }), [syncPull, syncPush]);

  // Run reconcile when a desktop manifest arrives.
  useEffect(() => {
    setSyncManifestHandler((projects) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setStatus('syncing');
      reconcileOnConnect(projects, deps)
        .then((r) => {
          setReport(r);
          setConflicts(r.conflicts);
          setStatus('done');
        })
        .catch((e) => { console.warn('planner sync failed:', (e as Error)?.message ?? e); setStatus('error'); })
        .finally(() => { runningRef.current = false; });
    });
    return () => setSyncManifestHandler(null);
  }, [setSyncManifestHandler, deps]);

  // Kick off a sync each time the tunnel reaches "connected".
  useEffect(() => {
    if (connectionState === 'connected') syncRequestManifest();
  }, [connectionState, syncRequestManifest]);

  const resolveProject = useCallback(async (projectId: string, resolutions: Record<string, string>) => {
    const pending = conflicts.find((c) => c.projectId === projectId);
    if (!pending) return;
    const { project, base } = finishSync(pending.local, pending.outcome, resolutions, Date.now());
    await deps.writeMerged(project, base);
    await deps.push({ projectId, title: project.title, files: base });
    setConflicts((c) => c.filter((x) => x.projectId !== projectId));
  }, [conflicts, deps]);

  const dismiss = useCallback((projectId: string) => {
    setConflicts((c) => c.filter((x) => x.projectId !== projectId));
  }, []);

  const value: PlannerSyncValue = { status, report, conflicts, resolveProject, dismiss };
  return <PlannerSyncContext.Provider value={value}>{children}</PlannerSyncContext.Provider>;
}
