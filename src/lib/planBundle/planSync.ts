import {
  PlanBundle,
  PlanConflict,
  PlanProject,
  PlanSyncManifest,
  PlanSyncStatus,
  ReconcileResult,
  ConflictResolution,
} from './types';
import { serializeBundle, deserializeBundle } from './bundle';
import {
  buildSyncManifest,
  computeReconciliation,
  hasConflicts,
} from './sync';
import {
  listPlanProjects,
  readPlanProject,
  writePlanProject,
  applyProjectFiles,
} from './storage';

// Re-export so callers can import from a single module.
export type { PlanConflict, PlanSyncStatus, ConflictResolution };

export type SendPlanPush = (bundle: PlanBundle) => void;
export type SendPlanRequest = (projectId: string, fileKeys?: string[]) => void;
export type SendPlanSyncManifest = (manifest: PlanSyncManifest) => void;

export type PlanSyncCallbacks = {
  onStatusChange: (status: PlanSyncStatus) => void;
  onConflicts: (conflicts: PlanConflict[]) => void;
};

/**
 * Drives the full plan sync lifecycle on the mobile (merge-authority) side.
 *
 * Lifecycle:
 * 1. onAuthOk() — send local manifest to desktop.
 * 2. onDesktopManifest() — receive desktop manifest, reconcile, push/pull.
 * 3. onPlanPull() — receive a bundle pushed or sent by desktop, store it.
 * 4. onPlanAck() — desktop confirmed it stored a pushed project.
 * 5. resolveConflict() — user chose a resolution for a flagged conflict.
 */
export class PlanSyncCoordinator {
  private sendPush: SendPlanPush;
  private sendRequest: SendPlanRequest;
  private sendManifest: SendPlanSyncManifest;
  private cb: PlanSyncCallbacks;

  /** Pending reconcile result, held until in-flight push/pull operations
   *  complete or the user resolves conflicts. */
  private pendingReconcile: ReconcileResult | null = null;
  /** Projects we're waiting for desktop to acknowledge. */
  private pendingAcks = new Set<string>();

  constructor(
    sendPush: SendPlanPush,
    sendRequest: SendPlanRequest,
    sendManifest: SendPlanSyncManifest,
    callbacks: PlanSyncCallbacks,
  ) {
    this.sendPush = sendPush;
    this.sendRequest = sendRequest;
    this.sendManifest = sendManifest;
    this.cb = callbacks;
  }

  /** Called immediately after tunnel auth_ok — kicks off the sync. */
  async onAuthOk(now: number): Promise<void> {
    this.cb.onStatusChange('syncing');
    const projects = await listPlanProjects();
    const manifest = buildSyncManifest(projects);
    this.sendManifest(manifest);
    // We now wait for the desktop's manifest reply (onDesktopManifest).
    void now; // exportedAt param reserved for future use
  }

  /** Called when the desktop's plan_sync_manifest frame arrives. */
  async onDesktopManifest(
    remote: PlanSyncManifest,
    now: number,
  ): Promise<void> {
    const projects = await listPlanProjects();
    const local = buildSyncManifest(projects);
    const result = computeReconciliation(local, remote);
    this.pendingReconcile = result;

    // Surface conflicts to the UI before doing any transfers.
    if (hasConflicts(result)) {
      const conflicts = this.buildConflicts(result, projects);
      this.cb.onStatusChange('conflict');
      this.cb.onConflicts(conflicts);
      // Transfers with non-conflicted files proceed immediately; the user
      // resolves conflicting files separately via resolveConflict().
    }

    // Execute all non-conflicting actions.
    await this.executeReconcile(result, now, new Set());
  }

  /** Receive a bundle the desktop pushed (plan_pull frame). */
  async onPlanPull(bundle: PlanBundle): Promise<void> {
    try {
      const project = deserializeBundle(bundle);
      await writePlanProject(project);
    } catch (e) {
      console.warn('[planSync] onPlanPull failed:', e);
    }
  }

  /** Desktop confirmed it stored a project we pushed. */
  onPlanAck(projectId: string): void {
    this.pendingAcks.delete(projectId);
    if (this.pendingAcks.size === 0 && this.pendingReconcile !== null) {
      // All pushes acknowledged.
      if (!hasConflicts(this.pendingReconcile)) {
        this.pendingReconcile = null;
        this.cb.onStatusChange('done');
      }
    }
  }

  /**
   * Called by the UI when the user picks a resolution for a conflicting project.
   * Applies the choice and executes the resulting transfers.
   */
  async resolveConflict(
    projectId: string,
    resolution: ConflictResolution,
    now: number,
  ): Promise<void> {
    const rec = this.pendingReconcile?.byProject[projectId];
    if (!rec || rec.op !== 'diff') return;

    switch (resolution.choice) {
      case 'keep_mine': {
        // Push all files from our local project (desktop will overwrite).
        await this.pushProject(projectId, now);
        break;
      }
      case 'take_theirs': {
        // Request the full project from desktop (we'll overwrite locally on receipt).
        this.sendRequest(projectId);
        break;
      }
      case 'fork': {
        // Duplicate local project under a new id and push the original as-is.
        const original = await readPlanProject(projectId);
        if (original) {
          const forked: PlanProject = {
            ...original,
            projectId: resolution.newProjectId,
            updatedAt: now,
          };
          await writePlanProject(forked);
          const bundle = serializeBundle('mobile', forked, now);
          this.sendPush(bundle);
          this.pendingAcks.add(resolution.newProjectId);
        }
        // Then request desktop's version for the original id.
        this.sendRequest(projectId);
        break;
      }
      case 'per_file': {
        const choices = resolution.fileChoices;
        const filesToPush = rec.actions
          .filter((a) => a.action === 'conflict' && choices[a.fileKey] === 'mine')
          .map((a) => a.fileKey);
        const filesToPull = rec.actions
          .filter((a) => a.action === 'conflict' && choices[a.fileKey] === 'theirs')
          .map((a) => a.fileKey);
        if (filesToPush.length > 0) {
          await this.pushProject(projectId, now, filesToPush);
        }
        if (filesToPull.length > 0) {
          this.sendRequest(projectId, filesToPull);
        }
        break;
      }
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private buildConflicts(
    result: ReconcileResult,
    projects: PlanProject[],
  ): PlanConflict[] {
    const projectMap = new Map(projects.map((p) => [p.projectId, p]));
    const conflicts: PlanConflict[] = [];
    for (const [projectId, rec] of Object.entries(result.byProject)) {
      if (rec.op !== 'diff') continue;
      const conflicting = rec.actions.filter((a) => a.action === 'conflict');
      if (conflicting.length === 0) continue;
      const p = projectMap.get(projectId);
      conflicts.push({
        projectId,
        projectTitle: p?.title ?? projectId,
        conflictingFiles: conflicting.map((a) => {
          if (a.action !== 'conflict') throw new Error('unreachable');
          return {
            fileKey: a.fileKey,
            mobileUpdatedAt: a.mobileUpdatedAt,
            desktopUpdatedAt: a.desktopUpdatedAt,
          };
        }),
      });
    }
    return conflicts;
  }

  /** Execute all non-conflicting push/pull actions from a ReconcileResult. */
  private async executeReconcile(
    result: ReconcileResult,
    now: number,
    skipProjectIds: Set<string>,
  ): Promise<void> {
    for (const [projectId, rec] of Object.entries(result.byProject)) {
      if (skipProjectIds.has(projectId)) continue;
      if (rec.op === 'push_all') {
        await this.pushProject(projectId, now);
      } else if (rec.op === 'pull_all') {
        this.sendRequest(projectId);
      } else if (rec.op === 'diff') {
        const toPush = rec.actions
          .filter((a) => a.action === 'push')
          .map((a) => a.fileKey);
        const toPull = rec.actions
          .filter((a) => a.action === 'pull')
          .map((a) => a.fileKey);
        if (toPush.length > 0) await this.pushProject(projectId, now, toPush);
        if (toPull.length > 0) this.sendRequest(projectId, toPull);
        // Conflicts are handled separately via resolveConflict().
      }
    }
  }

  private async pushProject(
    projectId: string,
    now: number,
    fileKeys?: string[],
  ): Promise<void> {
    const project = await readPlanProject(projectId);
    if (!project) return;
    let projectToSend = project;
    if (fileKeys && fileKeys.length > 0) {
      // Partial push — send only the specified files.
      const partialFiles: PlanProject['files'] = {};
      for (const key of fileKeys) {
        const entry = project.files[key as keyof typeof project.files];
        if (entry) partialFiles[key as keyof typeof partialFiles] = entry;
      }
      projectToSend = { ...project, files: partialFiles };
    }
    const bundle = serializeBundle('mobile', projectToSend, now);
    this.sendPush(bundle);
    this.pendingAcks.add(projectId);
  }
}
