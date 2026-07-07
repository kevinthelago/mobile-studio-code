// Planner board view-model (#221) — the pure bridge to the mirrored `plan` store domain
// (base-studio-code#2498 `PlanBoardPayload`: the focused-pane stage board + streams + deploy/market).
// React-free so the payload→model mapping is unit-testable and tolerant of a missing / partial /
// undefined payload. The two user-only mutations (confirm / advance) are gated on `canAct`.

export interface PlanBoardStageVM {
  key: string;
  name: string;
  glyph: string;
  status: string; // 'complete' | 'active' | 'locked' | 'upcoming' | …
  fraction: number;
  optional?: boolean;
  unmet: { label: string; detail?: string }[];
}

export interface PlanBoardStreamVM {
  id: string;
  name: string;
  repo: string;
  issues: number;
  dependsOn: string[];
  persona?: string;
}

export interface PlanBoardModel {
  projectId: string;
  title: string;
  currentStage: string;
  statusLabel: string;
  gateReady: boolean;
  planComplete: boolean;
  stages: PlanBoardStageVM[];
  confirmed: string[];
  skipped: string[];
  streams: PlanBoardStreamVM[];
  directorEnabled: boolean;
  deploy: { defined: boolean; services: { id: string; repo: string; platform: string; workload: string }[] };
  market: { defined: boolean; summary: string; recommendation?: string };
  /** The current stage's gate passed AND we have a project + stage to act on. */
  canAct: boolean;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown): boolean => v === true;
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function parseStages(v: unknown): PlanBoardStageVM[] {
  if (!Array.isArray(v)) return [];
  const out: PlanBoardStageVM[] = [];
  for (const s of v) {
    if (!isObj(s) || typeof s.key !== 'string') continue;
    const unmet: { label: string; detail?: string }[] = [];
    for (const u of Array.isArray(s.unmet) ? s.unmet : []) {
      if (isObj(u) && typeof u.label === 'string') {
        unmet.push({ label: u.label, detail: typeof u.detail === 'string' ? u.detail : undefined });
      }
    }
    out.push({
      key: s.key,
      name: str(s.name, s.key),
      glyph: str(s.glyph),
      status: str(s.status, 'upcoming'),
      fraction: num(s.fraction),
      optional: bool(s.optional) || undefined,
      unmet,
    });
  }
  return out;
}

function parseStreams(v: unknown): PlanBoardStreamVM[] {
  if (!Array.isArray(v)) return [];
  const out: PlanBoardStreamVM[] = [];
  for (const s of v) {
    if (!isObj(s) || typeof s.id !== 'string') continue;
    out.push({
      id: s.id,
      name: str(s.name, s.id),
      repo: str(s.repo),
      issues: num(s.issues),
      dependsOn: strArr(s.dependsOn),
      persona: typeof s.persona === 'string' ? s.persona : undefined,
    });
  }
  return out;
}

/**
 * Parse the mirrored `plan` projection into a validated board model, or `undefined` when there is no
 * live tunnel plan (missing / malformed payload) — the page then shows the local planner suite.
 */
export function selectPlanBoard(data: unknown): PlanBoardModel | undefined {
  if (!isObj(data) || typeof data.projectId !== 'string') return undefined;
  const gateReady = bool(data.gateReady);
  const currentStage = str(data.currentStage);
  const deployIn = isObj(data.deploy) ? data.deploy : {};
  const services: { id: string; repo: string; platform: string; workload: string }[] = [];
  for (const sv of Array.isArray(deployIn.services) ? deployIn.services : []) {
    if (isObj(sv) && typeof sv.id === 'string') {
      services.push({ id: sv.id, repo: str(sv.repo), platform: str(sv.platform), workload: str(sv.workload) });
    }
  }
  const marketIn = isObj(data.market) ? data.market : {};
  return {
    projectId: data.projectId,
    title: str(data.title, data.projectId),
    currentStage,
    statusLabel: str(data.statusLabel),
    gateReady,
    planComplete: bool(data.planComplete),
    stages: parseStages(data.stages),
    confirmed: strArr(data.confirmed),
    skipped: strArr(data.skipped),
    streams: parseStreams(data.streams),
    directorEnabled: bool(data.directorEnabled),
    deploy: { defined: bool(deployIn.defined), services },
    market: {
      defined: bool(marketIn.defined),
      summary: str(marketIn.summary),
      recommendation: typeof marketIn.recommendation === 'string' ? marketIn.recommendation : undefined,
    },
    canAct: gateReady && currentStage.length > 0,
  };
}
