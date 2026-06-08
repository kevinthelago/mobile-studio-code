// Per-file 3-way merge dispatcher. JSON arrays of {id} (issues.json / phases.json)
// use the structured merge; everything else uses diff3. Produces a unified result the
// reconcile loop and the conflict editor consume.

import { canonicalJson, canonicalize } from './canonical';
import { mergeText, mergedText, type TextMerge } from './diff3';
import { mergeJsonById, mergedJson, type JsonMerge } from './jsonMerge';

export type MergeResult =
  | { kind: 'text'; clean: boolean; conflicts: number; merge: TextMerge; merged?: string }
  | { kind: 'json'; clean: boolean; conflicts: number; merge: JsonMerge; merged?: string };

/** JSON files we attempt to merge structurally by element id. */
const STRUCTURED = new Set(['issues.json', 'phases.json', 'fleet.json', 'skills.json', 'repos.json']);

function fileName(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

function asArray(content: string): Record<string, unknown>[] | null {
  try {
    const v: unknown = JSON.parse(content);
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : null;
  } catch {
    return null;
  }
}

/**
 * 3-way merge a single file's content. base/mine/theirs are canonical strings.
 * For a structured JSON file whose elements all carry ids, merges by id; otherwise
 * falls back to diff3 over the canonical text. `merged` is set only when clean.
 */
export function mergeFile(path: string, base: string, mine: string, theirs: string): MergeResult {
  if (STRUCTURED.has(fileName(path))) {
    const b = asArray(base ?? '[]') ?? [];
    const m = asArray(mine);
    const t = asArray(theirs);
    if (m && t) {
      const merge = mergeJsonById(b, m, t);
      if (merge.hadIds) {
        return {
          kind: 'json',
          clean: merge.conflicts === 0,
          conflicts: merge.conflicts,
          merge,
          merged: merge.conflicts === 0 ? canonicalJson(mergedJson(merge)) : undefined,
        };
      }
    }
    // fall through to text merge (non-array / missing ids / unparseable)
  }
  const merge = mergeText(base, mine, theirs);
  return {
    kind: 'text',
    clean: merge.clean,
    conflicts: merge.conflicts,
    merge,
    merged: merge.clean ? mergedText(merge) : undefined,
  };
}

export { canonicalize };
