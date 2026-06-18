// GitHub analytics view-models for the mobile Pulse dashboard.
// Pure mappers from GitHub REST payloads → typed view models; no React deps so
// this file runs as-is in Node test environments.
// Fetch orchestration (fetchRepoPulse) lives at the bottom; it depends on
// githubCache.ts for ETag-aware conditional GETs.

import { cachedGithubGet } from './githubCache';

// ── Color palette ─────────────────────────────────────────────────────────────
// Concrete defaults derived from the glass theme. The UI layer may pass its own
// PulseColors to the chart-facing helpers (mappers that emit color fields).

export interface PulseColors {
  accent: string;   // primary highlight (glass: rose pink)
  info: string;     // secondary (glass: sky blue)
  success: string;  // positive signal (glass: teal)
  warn: string;     // caution (glass: amber)
  extra1: string;   // 5th lane / extra area (glass: purple)
  extra2: string;   // 6th / overflow / muted (glass: fg-dim)
}

export const DEFAULT_PULSE_COLORS: PulseColors = {
  accent:  '#ffaecf',
  info:    '#67d3ff',
  success: '#7ee2c4',
  warn:    '#ffd479',
  extra1:  '#c084fc',
  extra2:  'rgba(255,255,255,0.32)',
};

function paletteArr(c: PulseColors): string[] {
  return [c.accent, c.info, c.success, c.warn, c.extra1, c.extra2];
}

// ── View-model types ──────────────────────────────────────────────────────────

export interface VelocitySlice {
  labels: string[];
  commits: number[];
  merged: number[];
  opened: number[];
  adds: number[];   // additions per day (positive)
  dels: number[];   // deletions per day (stored positive)
}

export interface ChurnArea {
  area: string;
  add: number;
  del: number;
  files: number;
  color: string;
}

export interface ChurnFile {
  p: string;
  w: number;
}

export interface Contributor {
  name: string;
  bot: boolean;
  commits: number;
  add: number;
  del: number;
  color: string;
}

export interface Workflow {
  name: string;
  runs: number;
  pass: number;
  min: number;
}

export type BranchStatusKey =
  | 'open-pr' | 'ci-running' | 'draft' | 'blocked' | 'commit-only' | 'integration';

export interface Branch {
  n: string;
  owner: string;
  bot: boolean;
  ahead: number;
  behind: number;
  status: BranchStatusKey;
  age: string;
  color: string;
}

export interface CiHealth {
  passRate: number;
  runs: number;
  passed: number;
  failed: number;
  cancelled: number;
  avgMin: number;
}

export interface PulseKpis {
  commitsWeek: number;
  prsMerged: number;
  netLines: number;
  passRate: number;
  reviewLatencyH: number;
  contributors: number;
  botShare: number;
}

export interface RepoMeta {
  name: string;
  branch: string;
  desc: string;
  lang: string;
  pushedMin: number;
}

export interface RepoPulseLive {
  repo: RepoMeta;
  velocity: VelocitySlice;
  churnAreas: ChurnArea[];
  hottestFiles: ChurnFile[];
  contributors: Contributor[];
  ci: CiHealth;
  workflows: Workflow[];
  branches: Branch[];
  reviewBuckets: Array<{ label: string; v: number }>;
  kpis: PulseKpis;
  languages: Record<string, number>;
  partialDiffs: boolean;
}

// ── GitHub payload shapes (subset of fields used) ────────────────────────────

export interface GhAccount { login: string; type?: string }

export interface GhCommitItem {
  sha: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: GhAccount | null;
}

export interface GhCommitFile {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  status?: string;
}

export interface GhCommitDetail extends GhCommitItem {
  stats?: { additions: number; deletions: number; total: number };
  files?: GhCommitFile[];
}

export interface GhPull {
  number: number;
  title: string;
  user: GhAccount | null;
  created_at: string;
  merged_at: string | null;
  draft: boolean;
  state: string;
  head: { ref: string };
}

export interface GhBranchItem { name: string; commit: { sha: string } }

export interface GhWorkflowItem {
  id: number;
  name: string;
  path: string;
  state: string;
}

export interface GhRun {
  id: number;
  name: string;
  conclusion: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  workflow_id: number;
}

export interface GhCompare { ahead_by: number; behind_by: number }

// ── Bot detection (GitHub's own signal) ──────────────────────────────────────

export function isBot(acct: GhAccount | null, fallbackName = ''): boolean {
  const login = acct?.login ?? fallbackName;
  return acct?.type === 'Bot' || /\[bot\]$/i.test(login);
}

// ── Day bucketing ─────────────────────────────────────────────────────────────

export interface DayWindow { labels: string[]; keys: string[] }

export function dayWindow(days: number, now: Date): DayWindow {
  const labels: string[] = [];
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    labels.push(`${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
    keys.push(d.toISOString().slice(0, 10));
  }
  return { labels, keys };
}

const dayKey = (iso: string) => iso.slice(0, 10);

export function tallyByDay(win: DayWindow, isos: Array<string | null | undefined>): number[] {
  const idx = new Map(win.keys.map((k, i) => [k, i]));
  const out = new Array<number>(win.keys.length).fill(0);
  for (const iso of isos) {
    if (!iso) continue;
    const i = idx.get(dayKey(iso));
    if (i !== undefined) out[i] += 1;
  }
  return out;
}

export function sumByDay(
  win: DayWindow,
  entries: Array<{ date: string; value: number }>,
): number[] {
  const idx = new Map(win.keys.map((k, i) => [k, i]));
  const out = new Array<number>(win.keys.length).fill(0);
  for (const e of entries) {
    const i = idx.get(dayKey(e.date));
    if (i !== undefined) out[i] += e.value;
  }
  return out;
}

// ── Velocity (commits + PRs per day) ─────────────────────────────────────────

export function mapVelocity(
  commits: GhCommitItem[],
  pulls: GhPull[],
  details: GhCommitDetail[],
  days: number,
  now: Date,
): VelocitySlice {
  const win = dayWindow(days, now);
  const commitDates = commits
    .map((c) => c.commit.author?.date)
    .filter((d): d is string => d != null);
  const adds = sumByDay(win, details.flatMap((d) =>
    d.commit.author?.date && d.stats
      ? [{ date: d.commit.author.date, value: d.stats.additions }]
      : [],
  ));
  const dels = sumByDay(win, details.flatMap((d) =>
    d.commit.author?.date && d.stats
      ? [{ date: d.commit.author.date, value: d.stats.deletions }]
      : [],
  ));
  return {
    labels: win.labels,
    commits: tallyByDay(win, commitDates),
    opened: tallyByDay(win, pulls.map((p) => p.created_at)),
    merged: tallyByDay(win, pulls.map((p) => p.merged_at)),
    adds,
    dels,
  };
}

// ── Churn by area + hottest files ─────────────────────────────────────────────

export function areaOf(path: string): string {
  const seg = path.split('/');
  if (seg[0] === 'crates' && seg.length > 1) return `crates/${seg[1]}`;
  if (seg.length > 1) return `${seg[0]}/`;
  return '(root)';
}

export function mapChurnAreas(
  details: GhCommitDetail[],
  colors: PulseColors = DEFAULT_PULSE_COLORS,
): ChurnArea[] {
  const palette = paletteArr(colors);
  const acc = new Map<string, { add: number; del: number; files: Set<string> }>();
  for (const d of details) {
    for (const f of d.files ?? []) {
      const a = areaOf(f.filename);
      const e = acc.get(a) ?? { add: 0, del: 0, files: new Set<string>() };
      e.add += f.additions;
      e.del += f.deletions;
      e.files.add(f.filename);
      acc.set(a, e);
    }
  }
  return [...acc.entries()]
    .map(([area, e]) => ({ area, add: e.add, del: e.del, files: e.files.size, color: '' }))
    .sort((a, b) => (b.add + b.del) - (a.add + a.del))
    .slice(0, 6)
    .map((a, i) => ({ ...a, color: palette[i % palette.length] }));
}

export function mapHottestFiles(details: GhCommitDetail[], topN = 16): ChurnFile[] {
  const acc = new Map<string, number>();
  for (const d of details) {
    for (const f of d.files ?? []) {
      acc.set(f.filename, (acc.get(f.filename) ?? 0) + f.additions + f.deletions);
    }
  }
  return [...acc.entries()]
    .map(([p, w]) => ({ p, w }))
    .sort((a, b) => b.w - a.w)
    .slice(0, topN);
}

// ── Contributors ──────────────────────────────────────────────────────────────

function loginColor(login: string): string {
  let h = 0;
  for (let i = 0; i < login.length; i++) h = ((h * 31 + login.charCodeAt(i)) >>> 0);
  const hue = h % 360;
  return `oklch(0.68 0.12 ${hue})`;
}

export function mapContributors(
  commits: GhCommitItem[],
  details: GhCommitDetail[],
  colors: PulseColors = DEFAULT_PULSE_COLORS,
): Contributor[] {
  const acc = new Map<string, { bot: boolean; commits: number; add: number; del: number }>();
  const keyOf = (c: GhCommitItem) =>
    c.author?.login ?? c.commit.author?.name ?? 'unknown';
  for (const c of commits) {
    const k = keyOf(c);
    const e = acc.get(k) ?? {
      bot: isBot(c.author, c.commit.author?.name ?? ''),
      commits: 0, add: 0, del: 0,
    };
    e.commits += 1;
    acc.set(k, e);
  }
  for (const d of details) {
    const k = keyOf(d);
    const e = acc.get(k);
    if (e && d.stats) {
      e.add += d.stats.additions;
      e.del += d.stats.deletions;
    }
  }
  return [...acc.entries()]
    .map(([name, e]) => ({
      name, bot: e.bot, commits: e.commits, add: e.add, del: e.del,
      color: e.bot ? colors.accent : loginColor(name),
    }))
    .sort((a, b) => b.commits - a.commits);
}

// ── CI health + per-workflow pass rate ────────────────────────────────────────

const FAIL_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure']);

function round1(n: number): number { return Math.round(n * 10) / 10; }

export function mapCI(
  runs: GhRun[],
  workflows: GhWorkflowItem[],
): { ci: CiHealth; workflows: Workflow[] } {
  const done = runs.filter((r) => r.status === 'completed');
  const passed = done.filter((r) => r.conclusion === 'success').length;
  const failed = done.filter((r) => r.conclusion != null && FAIL_CONCLUSIONS.has(r.conclusion)).length;
  const cancelled = done.filter((r) => r.conclusion === 'cancelled').length;
  const decisive = passed + failed;
  const durMin = (r: GhRun) =>
    (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 60_000;
  const avgMin = done.length
    ? round1(done.reduce((s, r) => s + durMin(r), 0) / done.length)
    : 0;

  const ci: CiHealth = {
    passRate: decisive ? Math.round((passed / decisive) * 100) : 0,
    runs: done.length, passed, failed, cancelled, avgMin,
  };

  const wfName = new Map(workflows.map((w) => [w.id, w.name]));
  const byWf = new Map<number, { name: string; runs: number; pass: number; mins: number[] }>();
  for (const r of done) {
    const w = byWf.get(r.workflow_id) ?? {
      name: wfName.get(r.workflow_id) ?? r.name,
      runs: 0, pass: 0, mins: [],
    };
    w.runs += 1;
    if (r.conclusion === 'success') w.pass += 1;
    w.mins.push(durMin(r));
    byWf.set(r.workflow_id, w);
  }
  const wf: Workflow[] = [...byWf.values()]
    .map((w) => ({
      name: w.name,
      runs: w.runs,
      pass: w.runs ? Math.round((w.pass / w.runs) * 100) : 0,
      min: w.mins.length
        ? round1(w.mins.reduce((a, b) => a + b, 0) / w.mins.length)
        : 0,
    }))
    .sort((a, b) => b.runs - a.runs);

  return { ci, workflows: wf };
}

// ── Review latency (merged PR open→merge) ─────────────────────────────────────

export function mapReviewLatency(pulls: GhPull[]): Array<{ label: string; v: number }> {
  const buckets = [
    { label: '<30m', v: 0 }, { label: '30m–1h', v: 0 }, { label: '1–3h', v: 0 },
    { label: '3–8h', v: 0 }, { label: '8h+', v: 0 },
  ];
  for (const p of pulls) {
    if (!p.merged_at) continue;
    const h = (new Date(p.merged_at).getTime() - new Date(p.created_at).getTime()) / 3_600_000;
    const i = h < 0.5 ? 0 : h < 1 ? 1 : h < 3 ? 2 : h < 8 ? 3 : 4;
    buckets[i].v += 1;
  }
  return buckets;
}

export function medianLatencyH(pulls: GhPull[]): number {
  const hs = pulls
    .filter((p) => p.merged_at)
    .map((p) =>
      (new Date(p.merged_at as string).getTime() - new Date(p.created_at).getTime()) / 3_600_000,
    )
    .sort((a, b) => a - b);
  if (!hs.length) return 0;
  const mid = Math.floor(hs.length / 2);
  return round1(hs.length % 2 ? hs[mid] : (hs[mid - 1] + hs[mid]) / 2);
}

// ── Active branches ───────────────────────────────────────────────────────────

export function mapBranches(
  branches: GhBranchItem[],
  pulls: GhPull[],
  compares: Record<string, GhCompare>,
  defaultBranch: string,
  colors: PulseColors = DEFAULT_PULSE_COLORS,
): Branch[] {
  const palette = paletteArr(colors);
  const prByRef = new Map<string, GhPull>();
  for (const p of pulls) {
    if (p.state === 'open' && !prByRef.has(p.head.ref)) prByRef.set(p.head.ref, p);
  }
  return branches.map((b, i) => {
    const pr = prByRef.get(b.name);
    const cmp = compares[b.name];
    const status: BranchStatusKey =
      b.name === defaultBranch ? 'integration'
      : pr ? (pr.draft ? 'draft' : 'open-pr')
      : 'commit-only';
    return {
      n: b.name,
      owner: pr?.user?.login ?? '',
      bot: isBot(pr?.user ?? null),
      ahead: cmp?.ahead_by ?? 0,
      behind: cmp?.behind_by ?? 0,
      status,
      age: '',
      color: palette[i % palette.length],
    };
  });
}

// ── KPI derivation ────────────────────────────────────────────────────────────

export function deriveKpis(
  velocity: VelocitySlice,
  ci: CiHealth,
  pulls: GhPull[],
  contributors: Contributor[],
  now: Date,
): PulseKpis {
  const last7 = <T,>(a: T[]): T[] => a.slice(-7);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const within7 = (iso: string | null) =>
    !!iso && now.getTime() - new Date(iso).getTime() <= 7 * 86_400_000;
  const botCommits = contributors.filter((c) => c.bot).reduce((s, c) => s + c.commits, 0);
  const allCommits = contributors.reduce((s, c) => s + c.commits, 0);
  return {
    commitsWeek: sum(last7(velocity.commits)),
    prsMerged: pulls.filter((p) => within7(p.merged_at)).length,
    netLines: sum(last7(velocity.adds)) - sum(last7(velocity.dels)),
    passRate: ci.passRate,
    reviewLatencyH: medianLatencyH(pulls.filter((p) => within7(p.merged_at))),
    contributors: contributors.length,
    botShare: allCommits ? Math.round((botCommits / allCommits) * 100) : 0,
  };
}

// ── Language stats ────────────────────────────────────────────────────────────

export interface LanguageStats {
  totals: Record<string, number>;
  repoCount: number;
}

export function languageStats(
  repoData: Record<string, { langBytes: Record<string, number> }>,
): LanguageStats {
  const totals: Record<string, number> = {};
  let repoCount = 0;
  for (const rd of Object.values(repoData)) {
    const langs = Object.entries(rd?.langBytes ?? {});
    if (langs.length === 0) continue;
    repoCount += 1;
    for (const [lang, bytes] of langs) {
      totals[lang] = (totals[lang] ?? 0) + bytes;
    }
  }
  return { totals, repoCount };
}

// ── Activity heatmap scale (quartile, GitHub-style) ───────────────────────────

export function quartileScale(counts: number[]): number[] {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return counts.map(() => 0);
  const q1 = percentile(nonZero, 0.25);
  const q2 = percentile(nonZero, 0.5);
  const q3 = percentile(nonZero, 0.75);
  return counts.map((c) => {
    if (c <= 0) return 0;
    let level = 1;
    if (c > q1) level++;
    if (c > q2) level++;
    if (c > q3) level++;
    return level / 4;
  });
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

// ── Branch DAG layout (for the SVG graph component) ──────────────────────────

export interface GraphPoint {
  sha: string;
  x: number;
  lane: number;
  isHead: boolean;
  message: string;
  author: string;
}

export interface GraphEdge {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  curved: boolean;
}

export interface BranchGraphLayout {
  points: GraphPoint[];
  edges: GraphEdge[];
  laneNames: string[];
  height: number;
  width: number;
}

// Phone-friendly lane spacing. Caller passes a screenWidth to scale X axis.
const LANE_Y = [18, 48, 78, 108];
const X_PADDING = 8; // left + right inset

interface BranchComp {
  name: string;
  mergeBaseSha: string;
  commits: GhCommitItem[];
}

export function buildBranchGraphLayout(
  mainCommits: GhCommitItem[],
  defaultBranch: string,
  branchComps: BranchComp[],
  screenWidth = 320,
  colors: PulseColors = DEFAULT_PULSE_COLORS,
): BranchGraphLayout {
  const palette = paletteArr(colors);
  const activeBranches = branchComps.filter((b) => b.commits.length > 0).slice(0, 3);
  const laneNames = [defaultBranch, ...activeBranches.map((b) => b.name)];
  const laneCount = Math.min(laneNames.length, 4);

  type Entry = { sha: string; date: number; lane: number; commit: GhCommitItem };
  const entries: Entry[] = [
    ...mainCommits.map((c) => ({
      sha: c.sha,
      date: new Date(c.commit.author?.date ?? 0).getTime(),
      lane: 0,
      commit: c,
    })),
    ...activeBranches.flatMap((b, i) =>
      b.commits.map((c) => ({
        sha: c.sha,
        date: new Date(c.commit.author?.date ?? 0).getTime(),
        lane: i + 1,
        commit: c,
      })),
    ),
  ];

  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    if (seen.has(e.sha)) return false;
    seen.add(e.sha);
    return true;
  });
  unique.sort((a, b) => a.date - b.date);

  const xLeft = X_PADDING;
  const xRight = screenWidth - X_PADDING;

  if (unique.length === 0) {
    return {
      points: [], edges: [],
      laneNames: laneNames.slice(0, laneCount),
      height: 80, width: screenWidth,
    };
  }

  const n = unique.length;
  const xMap = new Map<string, number>();
  unique.forEach((e, i) => {
    xMap.set(
      e.sha,
      n <= 1
        ? (xLeft + xRight) / 2
        : xLeft + (i / (n - 1)) * (xRight - xLeft),
    );
  });

  const points: GraphPoint[] = unique.map((e) => ({
    sha: e.sha,
    x: xMap.get(e.sha)!,
    lane: e.lane,
    isHead: false,
    message: e.commit.commit.message.split('\n')[0],
    author: e.commit.author?.login ?? e.commit.commit.author?.name ?? '',
  }));

  for (let lane = 0; lane < laneCount; lane++) {
    const lp = points.filter((p) => p.lane === lane);
    if (lp.length > 0) {
      lp.reduce((a, b) => (a.x > b.x ? a : b)).isHead = true;
    }
  }

  const edges: GraphEdge[] = [];
  for (let lane = 0; lane < laneCount; lane++) {
    const lp = points.filter((p) => p.lane === lane).sort((a, b) => a.x - b.x);
    const y = LANE_Y[lane];
    const color = palette[lane % palette.length];
    for (let i = 0; i < lp.length - 1; i++) {
      edges.push({ x1: lp[i].x, y1: y, x2: lp[i + 1].x, y2: y, color, curved: false });
    }
    if (lane > 0) {
      const mergeX = xMap.get(activeBranches[lane - 1].mergeBaseSha);
      const first = lp[0];
      if (mergeX !== undefined && first) {
        edges.push({
          x1: mergeX, y1: LANE_Y[0],
          x2: first.x, y2: y,
          color, curved: true,
        });
      }
    }
  }

  return {
    points,
    edges,
    laneNames: laneNames.slice(0, laneCount),
    height: LANE_Y[laneCount - 1] + 30,
    width: screenWidth,
  };
}

// ── Fetch orchestration ───────────────────────────────────────────────────────

const DETAIL_CAP = 30;   // per-commit diff detail calls (mobile: fewer than desktop's 40)
const COMPARE_CAP = 5;   // ahead/behind calls (mobile: fewer than desktop's 8)
const WINDOW_DAYS = 14;

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

export async function fetchRepoPulse(
  pat: string,
  repoFullName: string,
  defaultBranch: string,
  repoInfo: { description: string | null; language: string | null; pushed_at: string },
  colors: PulseColors = DEFAULT_PULSE_COLORS,
  now: Date = new Date(),
): Promise<RepoPulseLive> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();

  const get = <T,>(path: string, fallback: T): Promise<T> =>
    cachedGithubGet<T>(pat, path).catch((e: unknown) => {
      if (
        e instanceof Error &&
        (e.name === 'GithubAuthError' || e.name === 'GithubRateLimitError')
      ) {
        throw e;
      }
      return fallback;
    });

  const [commits, pulls, branches, wfResp, runResp, languages] = await Promise.all([
    get<GhCommitItem[]>(
      `repos/${repoFullName}/commits?per_page=100&since=${since}`,
      [],
    ),
    get<GhPull[]>(
      `repos/${repoFullName}/pulls?state=all&per_page=100&sort=created&direction=desc`,
      [],
    ),
    get<GhBranchItem[]>(
      `repos/${repoFullName}/branches?per_page=100`,
      [],
    ),
    get<{ workflows: GhWorkflowItem[] }>(
      `repos/${repoFullName}/actions/workflows`,
      { workflows: [] },
    ),
    get<{ workflow_runs: GhRun[] }>(
      `repos/${repoFullName}/actions/runs?per_page=100`,
      { workflow_runs: [] },
    ),
    get<Record<string, number>>(
      `repos/${repoFullName}/languages`,
      {},
    ),
  ]);

  const detailShas = commits.slice(0, DETAIL_CAP).map((c) => c.sha);
  const details = (
    await Promise.all(
      detailShas.map((sha) =>
        get<GhCommitDetail | null>(`repos/${repoFullName}/commits/${sha}`, null),
      ),
    )
  ).filter((d): d is GhCommitDetail => d != null);

  const compareTargets = branches
    .filter((b) => b.name !== defaultBranch)
    .slice(0, COMPARE_CAP);
  const compareResults = await Promise.all(
    compareTargets.map((b) =>
      get<GhCompare>(
        `repos/${repoFullName}/compare/${defaultBranch}...${b.name}`,
        { ahead_by: 0, behind_by: 0 },
      ).then((r) => [b.name, r] as const),
    ),
  );
  const compares = Object.fromEntries(compareResults);

  const velocity = mapVelocity(commits, pulls, details, WINDOW_DAYS, now);
  const { ci, workflows } = mapCI(runResp.workflow_runs, wfResp.workflows);
  const contributors = mapContributors(commits, details, colors);

  return {
    repo: {
      name: repoFullName,
      branch: defaultBranch,
      desc: repoInfo.description ?? '',
      lang: repoInfo.language ? repoInfo.language.toLowerCase() : '—',
      pushedMin: minutesSince(repoInfo.pushed_at),
    },
    velocity,
    churnAreas: mapChurnAreas(details, colors),
    hottestFiles: mapHottestFiles(details),
    contributors,
    ci,
    workflows,
    branches: mapBranches(branches, pulls, compares, defaultBranch, colors),
    reviewBuckets: mapReviewLatency(pulls),
    kpis: deriveKpis(velocity, ci, pulls, contributors, now),
    languages,
    partialDiffs: commits.length > DETAIL_CAP,
  };
}
