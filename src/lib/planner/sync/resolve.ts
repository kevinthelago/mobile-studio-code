// Build resolved file content from a MergeResult + the user's per-conflict choices.
// Text conflicts: pick mine/theirs/both/edited per hunk. JSON-by-id conflicts: a
// resolved element per conflicting id (the editor merges fields). Pure + testable.

import { fromLines, canonicalJson } from './canonical';
import type { TextMerge } from './diff3';
import type { JsonMerge } from './jsonMerge';

type Obj = Record<string, unknown>;

export type TextChoice = 'mine' | 'theirs' | 'both' | { text: string };

/** Assemble final text from a TextMerge given a choice per conflict hunk, in order. */
export function assembleText(merge: TextMerge, choices: TextChoice[]): string {
  const lines: string[] = [];
  let ci = 0;
  for (const r of merge.regions) {
    if (r.type === 'stable') { lines.push(...r.lines); continue; }
    const choice = choices[ci++] ?? 'mine';
    if (choice === 'mine') lines.push(...r.mine);
    else if (choice === 'theirs') lines.push(...r.theirs);
    else if (choice === 'both') lines.push(...r.mine, ...r.theirs);
    else lines.push(...choice.text.replace(/\n$/, '').split('\n'));
  }
  return fromLines(lines);
}

/**
 * Assemble final JSON from a JsonMerge. `resolved` maps each CONFLICTING element id
 * to the chosen/merged element (or null to drop it). Clean elements pass through.
 */
export function assembleJson(merge: JsonMerge, resolved: Record<string, Obj | null>): string {
  const out: Obj[] = [];
  for (const e of merge.entries) {
    if (e.type === 'clean') out.push(e.value);
    else { const r = resolved[e.id]; if (r) out.push(r); }
  }
  return canonicalJson(out);
}

function eq(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/** Keys where two elements differ (the fields the editor must resolve). */
export function conflictingFields(mine: Obj, theirs: Obj): string[] {
  return [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter((k) => !eq(mine[k], theirs[k]));
}

/**
 * Merge one conflicting element field-by-field. Matching fields pass through;
 * differing fields take the chosen side (default 'mine'). One side null (delete vs
 * edit) ⇒ the other side wins as a whole.
 */
export function mergeElementFields(
  mine: Obj | null, theirs: Obj | null, fieldChoice: Record<string, 'mine' | 'theirs'>,
): Obj | null {
  if (!mine && !theirs) return null;
  if (!mine) return theirs;
  if (!theirs) return mine;
  const out: Obj = {};
  for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
    out[k] = eq(mine[k], theirs[k]) ? mine[k] : (fieldChoice[k] === 'theirs' ? theirs[k] : mine[k]);
  }
  return out;
}
