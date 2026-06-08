import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalMarkdown, canonicalJson, hashContent } from './canonical';
import { mergeText, mergedText } from './diff3';
import { mergeJsonById, mergedJson } from './jsonMerge';
import { reconcile, applyResolutions, type FileMap } from './reconcile';

// The shared cross-app contract (also implemented by base-studio-code). Read via fs
// to avoid JSON-import-assertion friction under tsx.
const fx = JSON.parse(
  readFileSync('src/lib/planner/sync/plannerCore.fixtures.json', 'utf8'),
) as {
  canonical: {
    markdown: { in: string; out: string }[];
    json: { in: unknown; out: string }[];
    hash: { in: string; out: string }[];
  };
  mergeText: { base: string; mine: string; theirs: string; conflicts: number; merged?: string }[];
  mergeJsonById: { base: Record<string, unknown>[]; mine: Record<string, unknown>[]; theirs: Record<string, unknown>[]; conflicts: number; merged?: Record<string, unknown>[] }[];
  reconcile: { base: FileMap; local: FileMap; remote: FileMap; conflicts: number; result?: FileMap }[];
};

test('fixture: canonical markdown + JSON + hash', () => {
  for (const c of fx.canonical.markdown) assert.equal(canonicalMarkdown(c.in), c.out);
  for (const c of fx.canonical.json) assert.equal(canonicalJson(c.in), c.out);
  for (const c of fx.canonical.hash) assert.equal(hashContent(c.in), c.out);
});

test('fixture: text merge cases', () => {
  for (const c of fx.mergeText) {
    const m = mergeText(c.base, c.mine, c.theirs);
    assert.equal(m.conflicts, c.conflicts, JSON.stringify(c));
    if (c.merged !== undefined) assert.equal(mergedText(m), c.merged);
  }
});

test('fixture: JSON-by-id merge cases', () => {
  for (const c of fx.mergeJsonById) {
    const m = mergeJsonById(c.base, c.mine, c.theirs);
    assert.equal(m.conflicts, c.conflicts, JSON.stringify(c));
    if (c.merged !== undefined) assert.deepEqual(mergedJson(m), c.merged);
  }
});

test('fixture: reconcile cases', () => {
  for (const c of fx.reconcile) {
    const rec = reconcile(c.base, c.local, c.remote);
    assert.equal(rec.conflicts, c.conflicts, JSON.stringify(c));
    if (c.result !== undefined) assert.deepEqual(applyResolutions(rec), c.result);
  }
});
