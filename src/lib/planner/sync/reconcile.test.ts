import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, applyResolutions, type FileMap } from './reconcile';

const byType = (rec: ReturnType<typeof reconcile>) =>
  Object.fromEntries(rec.actions.map((a) => [a.path, a.type]));

test('edits to different files both apply (keep-local + take-remote)', () => {
  const base: FileMap = { 'goal.md': 'g\n', 'scope.md': 's\n' };
  const local: FileMap = { 'goal.md': 'G\n', 'scope.md': 's\n' };  // local edited goal
  const remote: FileMap = { 'goal.md': 'g\n', 'scope.md': 'S\n' }; // remote edited scope
  const rec = reconcile(base, local, remote);
  assert.equal(rec.clean, true);
  assert.deepEqual(byType(rec), { 'goal.md': 'keep-local', 'scope.md': 'take-remote' });
  assert.deepEqual(applyResolutions(rec), { 'goal.md': 'G\n', 'scope.md': 'S\n' });
});

test('non-overlapping edits to the SAME file auto-merge', () => {
  const base: FileMap = { 'goal.md': 'a\nb\nc\n' };
  const local: FileMap = { 'goal.md': 'A\nb\nc\n' };
  const remote: FileMap = { 'goal.md': 'a\nb\nC\n' };
  const rec = reconcile(base, local, remote);
  assert.equal(rec.clean, true);
  assert.equal(applyResolutions(rec)['goal.md'], 'A\nb\nC\n');
});

test('overlapping edits to the same file are a conflict; resolution builds the map', () => {
  const base: FileMap = { 'goal.md': 'a\nb\nc\n' };
  const local: FileMap = { 'goal.md': 'a\nMINE\nc\n' };
  const remote: FileMap = { 'goal.md': 'a\nTHEIRS\nc\n' };
  const rec = reconcile(base, local, remote);
  assert.equal(rec.conflicts, 1);
  assert.equal(rec.clean, false);
  assert.throws(() => applyResolutions(rec)); // must resolve first
  assert.deepEqual(applyResolutions(rec, { 'goal.md': 'a\nMINE\nc\n' }), { 'goal.md': 'a\nMINE\nc\n' });
});

test('structured JSON merge flows through reconcile', () => {
  const base: FileMap = { 'issues.json': '[{"id":"1","title":"a"}]' };
  const local: FileMap = { 'issues.json': '[{"id":"1","title":"a"},{"id":"2","title":"b"}]' };   // added 2
  const remote: FileMap = { 'issues.json': '[{"id":"1","title":"a-edited"}]' };                  // edited 1
  const rec = reconcile(base, local, remote);
  assert.equal(rec.clean, true);
  const merged = applyResolutions(rec)['issues.json'];
  assert.match(merged, /a-edited/);
  assert.match(merged, /"id": "2"/);
});

test('new file on one side is added; absence is not a deletion', () => {
  const base: FileMap = { 'goal.md': 'g\n' };
  const local: FileMap = { 'goal.md': 'g\n', 'scope.md': 'new\n' }; // local added scope
  const remote: FileMap = { };                                      // remote dropped goal (absence)
  const rec = reconcile(base, local, remote);
  assert.equal(rec.clean, true);
  const out = applyResolutions(rec);
  assert.equal(out['scope.md'], 'new\n');  // added
  assert.equal(out['goal.md'], 'g\n');     // NOT deleted by remote's absence
});

test('nothing changed → all unchanged', () => {
  const m: FileMap = { 'goal.md': 'g\n' };
  const rec = reconcile(m, m, m);
  assert.equal(rec.conflicts, 0);
  assert.ok(rec.actions.every((a) => a.type === 'unchanged'));
});
