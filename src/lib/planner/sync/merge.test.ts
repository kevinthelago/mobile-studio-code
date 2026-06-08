import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalMarkdown, canonicalJson, hashContent } from './canonical';
import { mergeText, mergedText, renderWithMarkers } from './diff3';
import { mergeJsonById, mergedJson } from './jsonMerge';
import { mergeFile } from './merge';

// ── canonical ─────────────────────────────────────────────────────────────────

test('canonicalMarkdown normalizes line endings + trailing space + single final NL', () => {
  assert.equal(canonicalMarkdown('a  \r\nb\r\n\n\n'), 'a\nb\n');
  assert.equal(canonicalMarkdown(''), '');
});

test('canonicalJson sorts keys + 2-space + trailing NL (order-independent)', () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{\n  "a": 2,\n  "b": 1\n}\n');
  assert.equal(canonicalJson({ a: 2, b: 1 }), canonicalJson({ b: 1, a: 2 }));
});

test('hashContent is deterministic and differs on change', () => {
  assert.equal(hashContent('hello'), hashContent('hello'));
  assert.notEqual(hashContent('hello'), hashContent('hellp'));
});

// ── diff3 text merge ──────────────────────────────────────────────────────────

test('non-overlapping edits auto-merge with no conflict', () => {
  const base = 'goal\nscope\nstack\n';
  const mine = 'GOAL\nscope\nstack\n';      // changed line 1
  const theirs = 'goal\nscope\nSTACK\n';    // changed line 3
  const m = mergeText(base, mine, theirs);
  assert.equal(m.clean, true);
  assert.equal(mergedText(m), 'GOAL\nscope\nSTACK\n');
});

test('one-sided change is taken; identical change is not a conflict', () => {
  const base = 'a\nb\nc\n';
  assert.equal(mergedText(mergeText(base, 'a\nB\nc\n', base)), 'a\nB\nc\n');
  assert.equal(mergedText(mergeText(base, 'a\nB\nc\n', 'a\nB\nc\n')), 'a\nB\nc\n');
});

test('overlapping edits to the same line produce one conflict region', () => {
  const base = 'a\nb\nc\n';
  const m = mergeText(base, 'a\nMINE\nc\n', 'a\nTHEIRS\nc\n');
  assert.equal(m.clean, false);
  assert.equal(m.conflicts, 1);
  const conflict = m.regions.find((r) => r.type === 'conflict');
  assert.ok(conflict && conflict.type === 'conflict');
  assert.deepEqual(conflict.mine, ['MINE']);
  assert.deepEqual(conflict.theirs, ['THEIRS']);
  assert.match(renderWithMarkers(m), /<<<<<<< mine\nMINE\n=======\nTHEIRS\n>>>>>>> theirs/);
});

test('insertions on both sides at different places merge cleanly', () => {
  const base = 'a\nc\n';
  const m = mergeText(base, 'a\nb\nc\n', 'a\nc\nd\n');
  assert.equal(m.clean, true);
  assert.equal(mergedText(m), 'a\nb\nc\nd\n');
});

// ── structured JSON merge by id ───────────────────────────────────────────────

const iss = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, title, ...extra });

test('mergeJsonById: independent element edits merge; same element diverging conflicts', () => {
  const base = [iss('1', 'auth'), iss('2', 'ui')];
  const mine = [iss('1', 'auth', { acceptance: 'a' }), iss('2', 'ui')];   // edited #1
  const theirs = [iss('1', 'auth'), iss('2', 'ui', { acceptance: 'b' })]; // edited #2
  const m = mergeJsonById(base, mine, theirs);
  assert.equal(m.hadIds, true);
  assert.equal(m.conflicts, 0);
  assert.deepEqual(mergedJson(m), [iss('1', 'auth', { acceptance: 'a' }), iss('2', 'ui', { acceptance: 'b' })]);
});

test('mergeJsonById: same element changed differently → element conflict', () => {
  const base = [iss('1', 'auth')];
  const m = mergeJsonById(base, [iss('1', 'login')], [iss('1', 'signin')]);
  assert.equal(m.conflicts, 1);
  assert.equal(m.entries[0].type, 'conflict');
});

test('mergeJsonById: additions kept; unchanged-side deletion drops; edit-vs-delete conflicts', () => {
  // theirs added #3; mine deleted #2 (unchanged) — drop; #1 edit vs delete → conflict
  const base = [iss('1', 'a'), iss('2', 'b')];
  const mine = [iss('1', 'a-edited')];                 // edited 1, deleted 2
  const theirs = [iss('1', 'a'), iss('2', 'b'), iss('3', 'c')]; // added 3
  const m = mergeJsonById(base, mine, theirs);
  const ids = m.entries.map((e) => e.id);
  assert.deepEqual(ids.sort(), ['1', '3']); // 2 dropped (mine deleted, theirs unchanged)
  // wait: #1 mine edited, theirs unchanged → clean take mine; #3 theirs added → clean
  assert.equal(m.conflicts, 0);
  assert.deepEqual(mergedJson(m).map((e) => e.id).sort(), ['1', '3']);
});

test('mergeJsonById: bails (hadIds=false) when an element lacks an id', () => {
  const m = mergeJsonById([{ id: '1' }], [{ title: 'no id' }], [{ id: '1' }]);
  assert.equal(m.hadIds, false);
});

// ── dispatcher ────────────────────────────────────────────────────────────────

test('mergeFile routes issues.json to structured merge, .md to text', () => {
  const base = JSON.stringify([iss('1', 'a')]);
  const j = mergeFile('issues.json', base, JSON.stringify([iss('1', 'a', { x: 1 })]), base);
  assert.equal(j.kind, 'json');
  assert.equal(j.clean, true);
  assert.match(j.merged ?? '', /"x": 1/);

  const t = mergeFile('goal.md', 'a\nb\n', 'A\nb\n', 'a\nb\n');
  assert.equal(t.kind, 'text');
  assert.equal(t.merged, 'A\nb\n');
});

test('mergeFile falls back to text when JSON elements lack ids', () => {
  const r = mergeFile('repos.json', '[]', '[{"owner":"x"}]', '[]');
  assert.equal(r.kind, 'text'); // no id → text diff3 on canonical JSON
});
