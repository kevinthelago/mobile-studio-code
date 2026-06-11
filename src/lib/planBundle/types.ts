// Canonical planning file names that the bundle carries.
// GitHub covers issues.json/phases.json via the Publish flow; everything
// else lives here and is transferred peer-to-peer over the Noise channel.
export const PLAN_FILE_KEYS = [
  'goal.md',
  'scope.md',
  'stack.md',
  'architecture.md',
  'ux.md',
  'schema.md',
  'api.md',
  'security.md',
  'testing.md',
  'cicd.md',
  'ui.md',
  'repos.json',
  'fleet.json',
  'skills.json',
  'automations.md',
  'phases.json',
  'issues.json',
  'risks.md',
  'open_questions.md',
  '_skipped.md',
] as const;

export type PlanFileKey = (typeof PLAN_FILE_KEYS)[number];

export type PlanFileEntry = {
  content: string;
  /** FNV-1a (32-bit, UTF-8 input) over content, hex-encoded. 8 chars. */
  hash: string;
  /** Unix ms timestamp of last write. */
  updatedAt: number;
};

/** One plan project — the canonical in-memory representation on both devices. */
export type PlanProject = {
  projectId: string;
  title: string;
  createdAt: number;
  /** Max updatedAt across all files. */
  updatedAt: number;
  files: Partial<Record<PlanFileKey, PlanFileEntry>>;
};

// ── Bundle (transfer envelope) ────────────────────────────────────────────────

/** Current bundle format version. Bump on breaking schema changes. */
export const BUNDLE_SCHEMA = '1.0' as const;

/** Wraps one PlanProject for point-to-point transfer (tunnel or GitHub).
 *  Pure data — serializes/deserializes without side effects. */
export type PlanBundle = {
  /** Format version — receivers must reject unknown schemas. */
  bundleSchema: typeof BUNDLE_SCHEMA;
  source: 'mobile' | 'desktop';
  exportedAt: number;
  /** Planner core version that produced this bundle. */
  coreVersion: string;
  project: PlanProject;
};

// ── Sync manifest (lightweight, exchanged on connect) ─────────────────────────

export type ProjectSyncInfo = {
  updatedAt: number;
  files: Partial<Record<PlanFileKey, { hash: string; updatedAt: number }>>;
};

/** Lightweight manifest sent by each device on connect to drive reconciliation. */
export type PlanSyncManifest = {
  version: 1;
  /** keyed by projectId */
  projects: Record<string, ProjectSyncInfo>;
};

// ── Reconciliation result ─────────────────────────────────────────────────────

export type FileSyncAction =
  | { action: 'push'; fileKey: PlanFileKey }
  | { action: 'pull'; fileKey: PlanFileKey }
  | {
      action: 'conflict';
      fileKey: PlanFileKey;
      mobileUpdatedAt: number;
      desktopUpdatedAt: number;
    };

export type ProjectReconcile =
  | { op: 'push_all'; reason: 'missing_on_desktop' }
  | { op: 'pull_all'; reason: 'missing_on_mobile' }
  | { op: 'diff'; actions: FileSyncAction[] };

export type ReconcileResult = {
  /** keyed by projectId */
  byProject: Record<string, ProjectReconcile>;
};

// ── Conflict resolution ───────────────────────────────────────────────────────

export type PlanConflict = {
  projectId: string;
  projectTitle: string;
  conflictingFiles: Array<{
    fileKey: PlanFileKey;
    mobileUpdatedAt: number;
    desktopUpdatedAt: number;
  }>;
};

export type ConflictResolution =
  | { choice: 'keep_mine' }
  | { choice: 'take_theirs' }
  | { choice: 'fork'; newProjectId: string }
  | { choice: 'per_file'; fileChoices: Partial<Record<PlanFileKey, 'mine' | 'theirs'>> };

// ── Plan sync status ──────────────────────────────────────────────────────────

export type PlanSyncStatus =
  | 'idle'
  | 'syncing'
  | 'conflict'
  | 'done'
  | 'error';
