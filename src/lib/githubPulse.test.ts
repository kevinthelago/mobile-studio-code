import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayWindow, tallyByDay, sumByDay,
  mapVelocity, mapChurnAreas, mapHottestFiles,
  mapContributors, mapCI, mapReviewLatency, mapBranches,
  deriveKpis, medianLatencyH,
  isBot, areaOf, quartileScale, buildBranchGraphLayout,
  languageStats,
  type GhCommitItem, type GhCommitDetail, type GhPull,
  type GhBranchItem, type GhWorkflowItem, type GhRun,
} from './githubPulse.js';

// Fixed reference point so day-window tests are deterministic.
const NOW = new Date('2025-01-14T12:00:00Z');

// ── isBot ─────────────────────────────────────────────────────────────────────

describe('isBot', () => {
  test('detects [bot] suffix', () => {
    assert.ok(isBot({ login: 'renovate[bot]' }));
  });
  test('detects Bot type', () => {
    assert.ok(isBot({ login: 'app', type: 'Bot' }));
  });
  test('returns false for humans', () => {
    assert.ok(!isBot({ login: 'alice' }));
  });
  test('returns false for null account', () => {
    assert.ok(!isBot(null));
  });
});

// ── dayWindow ─────────────────────────────────────────────────────────────────

describe('dayWindow', () => {
  test('returns correct number of days', () => {
    const w = dayWindow(7, NOW);
    assert.equal(w.labels.length, 7);
    assert.equal(w.keys.length, 7);
  });

  test('last key is today in UTC', () => {
    const w = dayWindow(7, NOW);
    assert.equal(w.keys[6], '2025-01-14');
  });

  test('keys are in ascending date order', () => {
    const w = dayWindow(3, NOW);
    assert.ok(w.keys[0] < w.keys[1]);
    assert.ok(w.keys[1] < w.keys[2]);
  });
});

// ── tallyByDay ────────────────────────────────────────────────────────────────

describe('tallyByDay', () => {
  test('counts matching ISO strings', () => {
    const w = dayWindow(3, NOW); // Jan 12, 13, 14
    const out = tallyByDay(w, ['2025-01-12T10:00:00Z', '2025-01-13T08:00:00Z', '2025-01-13T16:00:00Z']);
    assert.deepEqual(out, [1, 2, 0]);
  });

  test('ignores null/undefined', () => {
    const w = dayWindow(3, NOW);
    const out = tallyByDay(w, [null, undefined, '2025-01-14T00:00:00Z']);
    assert.equal(out[2], 1);
  });
});

// ── sumByDay ──────────────────────────────────────────────────────────────────

describe('sumByDay', () => {
  test('sums values into the correct day bucket', () => {
    const w = dayWindow(3, NOW);
    const out = sumByDay(w, [
      { date: '2025-01-12T10:00:00Z', value: 10 },
      { date: '2025-01-12T11:00:00Z', value: 5 },
      { date: '2025-01-14T00:00:00Z', value: 3 },
    ]);
    assert.deepEqual(out, [15, 0, 3]);
  });
});

// ── areaOf ────────────────────────────────────────────────────────────────────

describe('areaOf', () => {
  test('root file', () => { assert.equal(areaOf('README.md'), '(root)'); });
  test('nested file returns top dir with slash', () => {
    assert.equal(areaOf('src/lib/foo.ts'), 'src/');
  });
  test('crates two-level deep', () => {
    assert.equal(areaOf('crates/core/src/lib.rs'), 'crates/core');
  });
});

// ── mapVelocity ───────────────────────────────────────────────────────────────

describe('mapVelocity', () => {
  const commits: GhCommitItem[] = [
    { sha: 'a', commit: { message: 'fix', author: { name: 'alice', date: '2025-01-14T10:00:00Z' } }, author: { login: 'alice' } },
    { sha: 'b', commit: { message: 'feat', author: { name: 'bob', date: '2025-01-13T10:00:00Z' } }, author: { login: 'bob' } },
  ];
  const pulls: GhPull[] = [
    { number: 1, title: 'p1', user: { login: 'alice' }, created_at: '2025-01-13T10:00:00Z', merged_at: '2025-01-14T10:00:00Z', draft: false, state: 'closed', head: { ref: 'feature' } },
  ];

  test('produces arrays of the right length', () => {
    const v = mapVelocity(commits, pulls, [], 7, NOW);
    assert.equal(v.labels.length, 7);
    assert.equal(v.commits.length, 7);
  });

  test('counts commits on correct days', () => {
    const v = mapVelocity(commits, pulls, [], 7, NOW);
    const todayIdx = v.labels.length - 1;
    assert.equal(v.commits[todayIdx], 1); // 'a' on Jan 14
    assert.equal(v.commits[todayIdx - 1], 1); // 'b' on Jan 13
  });

  test('tallies merged PRs', () => {
    const v = mapVelocity(commits, pulls, [], 7, NOW);
    const todayIdx = v.labels.length - 1;
    assert.equal(v.merged[todayIdx], 1);
  });
});

// ── mapChurnAreas ─────────────────────────────────────────────────────────────

describe('mapChurnAreas', () => {
  const details: GhCommitDetail[] = [
    {
      sha: 'x', commit: { message: 'm', author: { name: 'a', date: '2025-01-14T00:00:00Z' } }, author: null,
      files: [
        { filename: 'src/lib/foo.ts', additions: 50, deletions: 10, changes: 60 },
        { filename: 'src/lib/bar.ts', additions: 30, deletions: 5, changes: 35 },
        { filename: 'docs/README.md', additions: 5, deletions: 0, changes: 5 },
      ],
    },
  ];

  test('groups into areas', () => {
    const areas = mapChurnAreas(details);
    const names = areas.map((a) => a.area);
    assert.ok(names.includes('src/'));
    assert.ok(names.includes('docs/'));
  });

  test('sums additions across files in the same area', () => {
    const areas = mapChurnAreas(details);
    const src = areas.find((a) => a.area === 'src/');
    assert.ok(src);
    assert.equal(src.add, 80);
  });

  test('assigns colors', () => {
    const areas = mapChurnAreas(details);
    assert.ok(areas.every((a) => a.color.length > 0));
  });

  test('returns at most 6 areas', () => {
    const manyFiles: GhCommitDetail['files'] = Array.from({ length: 20 }, (_, i) => ({
      filename: `dir${i}/file.ts`,
      additions: 10, deletions: 5, changes: 15,
    }));
    const d: GhCommitDetail[] = [{
      sha: 'z', commit: { message: 'm', author: { name: 'a', date: '' } }, author: null,
      files: manyFiles,
    }];
    assert.ok(mapChurnAreas(d).length <= 6);
  });
});

// ── mapHottestFiles ───────────────────────────────────────────────────────────

describe('mapHottestFiles', () => {
  const details: GhCommitDetail[] = [
    {
      sha: 'a', commit: { message: 'm', author: null }, author: null,
      files: [
        { filename: 'hot.ts', additions: 100, deletions: 50, changes: 150 },
        { filename: 'cold.ts', additions: 1, deletions: 1, changes: 2 },
      ],
    },
  ];

  test('sorts by total churn descending', () => {
    const files = mapHottestFiles(details);
    assert.equal(files[0].p, 'hot.ts');
  });

  test('weight equals additions + deletions', () => {
    const files = mapHottestFiles(details);
    assert.equal(files[0].w, 150);
  });
});

// ── mapContributors ───────────────────────────────────────────────────────────

describe('mapContributors', () => {
  const commits: GhCommitItem[] = [
    { sha: 'a', commit: { message: 'm', author: { name: 'alice', date: '' } }, author: { login: 'alice' } },
    { sha: 'b', commit: { message: 'm', author: { name: 'alice', date: '' } }, author: { login: 'alice' } },
    { sha: 'c', commit: { message: 'm', author: { name: 'renovate[bot]', date: '' } }, author: { login: 'renovate[bot]' } },
  ];

  test('counts commits per contributor', () => {
    const cs = mapContributors(commits, []);
    const alice = cs.find((c) => c.name === 'alice');
    assert.equal(alice?.commits, 2);
  });

  test('marks bot contributors', () => {
    const cs = mapContributors(commits, []);
    const bot = cs.find((c) => c.name === 'renovate[bot]');
    assert.ok(bot?.bot);
  });

  test('sorts by commit count descending', () => {
    const cs = mapContributors(commits, []);
    assert.equal(cs[0].name, 'alice');
  });
});

// ── mapCI ─────────────────────────────────────────────────────────────────────

describe('mapCI', () => {
  const workflows: GhWorkflowItem[] = [
    { id: 1, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' },
  ];
  const runs: GhRun[] = [
    { id: 1, name: 'CI', conclusion: 'success', status: 'completed', created_at: '2025-01-14T10:00:00Z', updated_at: '2025-01-14T10:10:00Z', workflow_id: 1 },
    { id: 2, name: 'CI', conclusion: 'failure', status: 'completed', created_at: '2025-01-13T10:00:00Z', updated_at: '2025-01-13T10:05:00Z', workflow_id: 1 },
    { id: 3, name: 'CI', conclusion: null, status: 'in_progress', created_at: '2025-01-14T12:00:00Z', updated_at: '2025-01-14T12:00:00Z', workflow_id: 1 },
  ];

  test('pass rate is correct', () => {
    const { ci } = mapCI(runs, workflows);
    assert.equal(ci.passRate, 50);
  });

  test('skips in-progress runs', () => {
    const { ci } = mapCI(runs, workflows);
    assert.equal(ci.runs, 2);
  });

  test('per-workflow summary', () => {
    const { workflows: wf } = mapCI(runs, workflows);
    assert.equal(wf.length, 1);
    assert.equal(wf[0].name, 'CI');
  });
});

// ── mapReviewLatency ──────────────────────────────────────────────────────────

describe('mapReviewLatency', () => {
  const pulls: GhPull[] = [
    { number: 1, title: '', user: null, created_at: '2025-01-14T10:00:00Z', merged_at: '2025-01-14T10:20:00Z', draft: false, state: 'closed', head: { ref: 'a' } }, // <30m
    { number: 2, title: '', user: null, created_at: '2025-01-13T10:00:00Z', merged_at: '2025-01-14T10:00:00Z', draft: false, state: 'closed', head: { ref: 'b' } }, // 8h+
    { number: 3, title: '', user: null, created_at: '2025-01-14T00:00:00Z', merged_at: null, draft: false, state: 'open', head: { ref: 'c' } }, // unmerged
  ];

  test('buckets correctly', () => {
    const buckets = mapReviewLatency(pulls);
    assert.equal(buckets[0].v, 1);   // <30m
    assert.equal(buckets[4].v, 1);   // 8h+
  });

  test('skips unmerged PRs', () => {
    const buckets = mapReviewLatency(pulls);
    const total = buckets.reduce((s, b) => s + b.v, 0);
    assert.equal(total, 2);
  });
});

// ── medianLatencyH ────────────────────────────────────────────────────────────

describe('medianLatencyH', () => {
  test('returns 0 for empty list', () => {
    assert.equal(medianLatencyH([]), 0);
  });

  test('computes median correctly (odd count)', () => {
    const pulls: GhPull[] = [
      { number: 1, title: '', user: null, created_at: '2025-01-14T00:00:00Z', merged_at: '2025-01-14T01:00:00Z', draft: false, state: 'closed', head: { ref: 'a' } },  // 1h
      { number: 2, title: '', user: null, created_at: '2025-01-14T00:00:00Z', merged_at: '2025-01-14T03:00:00Z', draft: false, state: 'closed', head: { ref: 'b' } },  // 3h
      { number: 3, title: '', user: null, created_at: '2025-01-14T00:00:00Z', merged_at: '2025-01-14T05:00:00Z', draft: false, state: 'closed', head: { ref: 'c' } },  // 5h
    ];
    assert.equal(medianLatencyH(pulls), 3);
  });
});

// ── mapBranches ───────────────────────────────────────────────────────────────

describe('mapBranches', () => {
  const branches: GhBranchItem[] = [
    { name: 'main', commit: { sha: 'a' } },
    { name: 'feature', commit: { sha: 'b' } },
  ];
  const pulls: GhPull[] = [
    { number: 1, title: 'PR', user: { login: 'alice' }, created_at: '2025-01-13T00:00:00Z', merged_at: null, draft: false, state: 'open', head: { ref: 'feature' } },
  ];

  test('marks default branch as integration', () => {
    const bs = mapBranches(branches, pulls, {}, 'main');
    const main = bs.find((b) => b.n === 'main');
    assert.equal(main?.status, 'integration');
  });

  test('marks branch with open PR as open-pr', () => {
    const bs = mapBranches(branches, pulls, {}, 'main');
    const feat = bs.find((b) => b.n === 'feature');
    assert.equal(feat?.status, 'open-pr');
  });

  test('ahead/behind from compare result', () => {
    const bs = mapBranches(
      branches, pulls, { feature: { ahead_by: 3, behind_by: 1 } }, 'main',
    );
    const feat = bs.find((b) => b.n === 'feature');
    assert.equal(feat?.ahead, 3);
    assert.equal(feat?.behind, 1);
  });
});

// ── deriveKpis ────────────────────────────────────────────────────────────────

describe('deriveKpis', () => {
  test('commitsWeek sums the last 7 days', () => {
    const velocity = {
      labels: Array.from({ length: 14 }, (_, i) => `d${i}`),
      commits: [...Array(7).fill(0), ...Array(7).fill(2)],
      merged: Array(14).fill(0),
      opened: Array(14).fill(0),
      adds: Array(14).fill(0),
      dels: Array(14).fill(0),
    };
    const ci = { passRate: 100, runs: 5, passed: 5, failed: 0, cancelled: 0, avgMin: 3 };
    const kpis = deriveKpis(velocity, ci, [], [], NOW);
    assert.equal(kpis.commitsWeek, 14); // 7 days × 2
  });
});

// ── quartileScale ─────────────────────────────────────────────────────────────

describe('quartileScale', () => {
  test('all zeros → all zeros', () => {
    const out = quartileScale([0, 0, 0]);
    assert.deepEqual(out, [0, 0, 0]);
  });

  test('single non-zero → level 1 (0.25)', () => {
    const out = quartileScale([0, 5, 0]);
    assert.equal(out[1], 0.25);
  });

  test('values span 0.25–1.0', () => {
    const out = quartileScale([1, 2, 3, 4, 5]);
    assert.ok(out.every((v) => v === 0 || (v >= 0.25 && v <= 1)));
  });
});

// ── buildBranchGraphLayout ────────────────────────────────────────────────────

describe('buildBranchGraphLayout', () => {
  const mainCommits: GhCommitItem[] = [
    { sha: 'a1', commit: { message: 'first', author: { name: 'alice', date: '2025-01-12T10:00:00Z' } }, author: { login: 'alice' } },
    { sha: 'a2', commit: { message: 'second', author: { name: 'alice', date: '2025-01-13T10:00:00Z' } }, author: { login: 'alice' } },
  ];

  test('returns empty layout for no commits', () => {
    const layout = buildBranchGraphLayout([], 'main', []);
    assert.equal(layout.points.length, 0);
    assert.equal(layout.edges.length, 0);
  });

  test('produces one point per unique sha', () => {
    const layout = buildBranchGraphLayout(mainCommits, 'main', []);
    assert.equal(layout.points.length, 2);
  });

  test('marks the rightmost commit as HEAD', () => {
    const layout = buildBranchGraphLayout(mainCommits, 'main', []);
    const heads = layout.points.filter((p) => p.isHead);
    assert.equal(heads.length, 1);
    assert.equal(heads[0].sha, 'a2'); // latest date → HEAD
  });

  test('deduplicates shared shas across lanes', () => {
    const branchComp = {
      name: 'feature',
      mergeBaseSha: 'a1',
      commits: [
        { sha: 'a1', commit: { message: 'shared', author: { name: 'alice', date: '2025-01-12T10:00:00Z' } }, author: { login: 'alice' } },
        { sha: 'b1', commit: { message: 'feature', author: { name: 'bob', date: '2025-01-14T10:00:00Z' } }, author: { login: 'bob' } },
      ],
    };
    const layout = buildBranchGraphLayout(mainCommits, 'main', [branchComp]);
    // a1 shared, a2 main, b1 feature = 3 unique
    assert.equal(layout.points.length, 3);
  });

  test('height accounts for lane count', () => {
    const layout = buildBranchGraphLayout(mainCommits, 'main', []);
    assert.ok(layout.height > 0);
  });
});

// ── languageStats ─────────────────────────────────────────────────────────────

describe('languageStats', () => {
  test('aggregates bytes across repos', () => {
    const stats = languageStats({
      'owner/a': { langBytes: { TypeScript: 1000, Rust: 500 } },
      'owner/b': { langBytes: { TypeScript: 2000 } },
    });
    assert.equal(stats.totals['TypeScript'], 3000);
    assert.equal(stats.totals['Rust'], 500);
    assert.equal(stats.repoCount, 2);
  });

  test('skips repos with no language data', () => {
    const stats = languageStats({
      'owner/empty': { langBytes: {} },
      'owner/full': { langBytes: { Go: 100 } },
    });
    assert.equal(stats.repoCount, 1);
  });
});
