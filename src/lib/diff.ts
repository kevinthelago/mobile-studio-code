export type DiffStat = { adds: number; dels: number };

const MAX_DP_CELLS = 4_000_000; // ~2000×2000 lines before falling back

/**
 * Count added/removed lines between two file versions, the way `git diff
 * --numstat` reports them. Uses an LCS over lines: adds = lines in `after`
 * outside the longest common subsequence, dels = lines in `before` outside it.
 * Falls back to a coarse line-count delta for very large files to avoid a
 * pathological O(n·m) blowup.
 */
export function lineDiffStat(before: string, after: string): DiffStat {
  if (before === after) return { adds: 0, dels: 0 };
  const a = before.length ? before.split('\n') : [];
  const b = after.length ? after.split('\n') : [];
  const n = a.length;
  const m = b.length;
  if (n === 0) return { adds: m, dels: 0 };
  if (m === 0) return { adds: 0, dels: n };

  if (n * m > MAX_DP_CELLS) {
    return { adds: Math.max(0, m - n), dels: Math.max(0, n - m) };
  }

  // Rolling-row LCS DP to keep memory at O(m).
  let prev = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    const cur = new Array<number>(m + 1).fill(0);
    const ai = a[i - 1];
    for (let j = 1; j <= m; j++) {
      cur[j] = ai === b[j - 1]
        ? prev[j - 1] + 1
        : (prev[j] >= cur[j - 1] ? prev[j] : cur[j - 1]);
    }
    prev = cur;
  }
  const lcs = prev[m];
  return { adds: m - lcs, dels: n - lcs };
}
