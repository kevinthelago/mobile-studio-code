// Line-based 3-way merge (diff3). Non-overlapping edits on either side auto-merge;
// edits that overlap the same region become conflict hunks. Pure + deterministic.
//
// Algorithm: the lines unchanged in ALL THREE (base lines that are in both
// LCS(base,mine) and LCS(base,theirs)) are stable anchors. Between consecutive
// anchors we have (baseSeg, mineSeg, theirsSeg); each region is resolved by which
// side(s) changed it — only a both-sides-divergent region is a conflict.

import { toLines, fromLines } from './canonical';

export type TextRegion =
  | { type: 'stable'; lines: string[] }
  | { type: 'conflict'; mine: string[]; theirs: string[] };

export interface TextMerge {
  regions: TextRegion[];
  conflicts: number;
  clean: boolean;
}

function arrEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Matched index pairs of the longest common subsequence of a and b. */
function lcsPairs(a: string[], b: string[]): { a: number; b: number }[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: { a: number; b: number }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push({ a: i, b: j }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** 3-way merge of line arrays. */
export function mergeLines(base: string[], mine: string[], theirs: string[]): TextMerge {
  const mMap = new Map<number, number>();
  for (const p of lcsPairs(base, mine)) mMap.set(p.a, p.b);
  const tMap = new Map<number, number>();
  for (const p of lcsPairs(base, theirs)) tMap.set(p.a, p.b);

  // Base indices unchanged in BOTH sides, ascending — the stable anchors.
  const anchors = [...mMap.keys()].filter((b) => tMap.has(b)).sort((x, y) => x - y);

  const regions: TextRegion[] = [];
  const pushStable = (lines: string[]) => {
    if (!lines.length) return;
    const last = regions[regions.length - 1];
    if (last && last.type === 'stable') last.lines.push(...lines);
    else regions.push({ type: 'stable', lines: [...lines] });
  };

  let pb = -1, pm = -1, pt = -1;
  const steps = [...anchors.map((b) => ({ b, m: mMap.get(b)!, t: tMap.get(b)! })),
    { b: base.length, m: mine.length, t: theirs.length }]; // end sentinel

  let conflicts = 0;
  for (const step of steps) {
    const baseSeg = base.slice(pb + 1, step.b);
    const mineSeg = mine.slice(pm + 1, step.m);
    const theirsSeg = theirs.slice(pt + 1, step.t);

    const mineChanged = !arrEq(mineSeg, baseSeg);
    const theirsChanged = !arrEq(theirsSeg, baseSeg);
    if (!mineChanged && !theirsChanged) pushStable(baseSeg);
    else if (mineChanged && !theirsChanged) pushStable(mineSeg);
    else if (!mineChanged && theirsChanged) pushStable(theirsSeg);
    else if (arrEq(mineSeg, theirsSeg)) pushStable(mineSeg);
    else { regions.push({ type: 'conflict', mine: mineSeg, theirs: theirsSeg }); conflicts++; }

    if (step.b < base.length) pushStable([base[step.b]]); // the anchor line itself
    pb = step.b; pm = step.m; pt = step.t;
  }

  return { regions, conflicts, clean: conflicts === 0 };
}

/** The clean merged text (only valid when there are no conflicts). */
export function mergedText(merge: TextMerge): string {
  const lines: string[] = [];
  for (const r of merge.regions) if (r.type === 'stable') lines.push(...r.lines);
  return fromLines(lines);
}

/** Render conflicts as git-style markers (for preview / a textual fallback editor). */
export function renderWithMarkers(merge: TextMerge): string {
  const lines: string[] = [];
  for (const r of merge.regions) {
    if (r.type === 'stable') lines.push(...r.lines);
    else {
      lines.push('<<<<<<< mine', ...r.mine, '=======', ...r.theirs, '>>>>>>> theirs');
    }
  }
  return fromLines(lines);
}

/** Convenience: 3-way merge over canonical string content. */
export function mergeText(base: string, mine: string, theirs: string): TextMerge {
  return mergeLines(toLines(base), toLines(mine), toLines(theirs));
}
