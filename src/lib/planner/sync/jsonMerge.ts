// Structured 3-way merge for JSON arrays of objects keyed by a stable `id`
// (issues.json / phases.json). Merges element-by-element: non-overlapping element
// edits combine cleanly; only the same element changed differently on both sides is
// a conflict (GitHub-style, but per element). Falls back to text merge (hadIds=false)
// when any element lacks an id, so the caller can diff3 the canonical JSON instead.
//
// Deletions WITHIN an array are content edits and DO sync (the "deletions local-only"
// decision is about whole projects/files, not array elements).

import { canonicalJson } from './canonical';

export type JsonEntry =
  | { id: string; type: 'clean'; value: Record<string, unknown> }
  | { id: string; type: 'conflict'; mine: Record<string, unknown> | null; theirs: Record<string, unknown> | null };

export interface JsonMerge {
  hadIds: boolean;
  entries: JsonEntry[];
  conflicts: number;
}

type Obj = Record<string, unknown>;

function eq(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

function indexById(arr: Obj[], idKey: string): Map<string, Obj> | null {
  const map = new Map<string, Obj>();
  for (const el of arr) {
    const id = el[idKey];
    if (typeof id !== 'string' && typeof id !== 'number') return null; // missing/!scalar id
    const key = String(id);
    if (map.has(key)) return null; // duplicate id — can't merge structurally
    map.set(key, el);
  }
  return map;
}

/** Ordered union of ids: mine's order first, then theirs-only, then base-only. */
function orderedIds(mine: Map<string, Obj>, theirs: Map<string, Obj>, base: Map<string, Obj>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [mine, theirs, base]) {
    for (const id of m.keys()) if (!seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

export function mergeJsonById(base: Obj[], mine: Obj[], theirs: Obj[], idKey = 'id'): JsonMerge {
  const bMap = indexById(base, idKey);
  const mMap = indexById(mine, idKey);
  const tMap = indexById(theirs, idKey);
  if (!bMap || !mMap || !tMap) return { hadIds: false, entries: [], conflicts: 0 };

  const entries: JsonEntry[] = [];
  let conflicts = 0;

  for (const id of orderedIds(mMap, tMap, bMap)) {
    const b = bMap.get(id);
    const m = mMap.get(id);
    const t = tMap.get(id);

    if (m && t) {
      if (!b) {
        // Both added this id.
        if (eq(m, t)) entries.push({ id, type: 'clean', value: m });
        else { entries.push({ id, type: 'conflict', mine: m, theirs: t }); conflicts++; }
      } else {
        const cm = !eq(m, b), ct = !eq(t, b);
        if (!cm && !ct) entries.push({ id, type: 'clean', value: b });
        else if (cm && !ct) entries.push({ id, type: 'clean', value: m });
        else if (!cm && ct) entries.push({ id, type: 'clean', value: t });
        else if (eq(m, t)) entries.push({ id, type: 'clean', value: m });
        else { entries.push({ id, type: 'conflict', mine: m, theirs: t }); conflicts++; }
      }
    } else if (m && !t) {
      if (!b) entries.push({ id, type: 'clean', value: m });        // mine added
      else if (eq(m, b)) { /* theirs deleted, mine unchanged → drop */ }
      else { entries.push({ id, type: 'conflict', mine: m, theirs: null }); conflicts++; } // delete vs edit
    } else if (!m && t) {
      if (!b) entries.push({ id, type: 'clean', value: t });        // theirs added
      else if (eq(t, b)) { /* mine deleted, theirs unchanged → drop */ }
      else { entries.push({ id, type: 'conflict', mine: null, theirs: t }); conflicts++; }
    }
    // !m && !t → both deleted → drop
  }

  return { hadIds: true, entries, conflicts };
}

/** The clean merged array (only when there are no conflicts). */
export function mergedJson(merge: JsonMerge): Obj[] {
  return merge.entries.flatMap((e) => (e.type === 'clean' ? [e.value] : []));
}
