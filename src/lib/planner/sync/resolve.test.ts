import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeText } from './diff3';
import { mergeJsonById } from './jsonMerge';
import {
  assembleText, assembleJson, conflictingFields, mergeElementFields,
} from './resolve';

test('assembleText: pick mine / theirs / both per hunk', () => {
  const m = mergeText('a\nb\nc\n', 'a\nMINE\nc\n', 'a\nTHEIRS\nc\n');
  assert.equal(assembleText(m, ['mine']), 'a\nMINE\nc\n');
  assert.equal(assembleText(m, ['theirs']), 'a\nTHEIRS\nc\n');
  assert.equal(assembleText(m, ['both']), 'a\nMINE\nTHEIRS\nc\n');
  assert.equal(assembleText(m, [{ text: 'EDITED' }]), 'a\nEDITED\nc\n');
});

test('assembleText: stable regions pass through unchanged', () => {
  const m = mergeText('x\ny\n', 'x\ny\n', 'x\ny\n'); // no conflict
  assert.equal(assembleText(m, []), 'x\ny\n');
});

test('assembleJson: clean entries pass; conflicts take the resolved element (or drop)', () => {
  const m = mergeJsonById(
    [{ id: '1', t: 'a' }, { id: '2', t: 'b' }],
    [{ id: '1', t: 'mine' }, { id: '2', t: 'b' }],   // 1 conflicts
    [{ id: '1', t: 'theirs' }, { id: '2', t: 'b' }],
  );
  assert.equal(m.conflicts, 1);
  const out = JSON.parse(assembleJson(m, { '1': { id: '1', t: 'theirs' } }));
  assert.deepEqual(out, [{ id: '1', t: 'theirs' }, { id: '2', t: 'b' }]);
  // dropping a conflicting element (null) removes it
  assert.deepEqual(JSON.parse(assembleJson(m, { '1': null })), [{ id: '2', t: 'b' }]);
});

test('conflictingFields + mergeElementFields: field-by-field resolution', () => {
  const mine = { id: '1', title: 'same', body: 'mine-body', labels: ['a'] };
  const theirs = { id: '1', title: 'same', body: 'theirs-body', labels: ['b'] };
  assert.deepEqual(conflictingFields(mine, theirs).sort(), ['body', 'labels']);

  const merged = mergeElementFields(mine, theirs, { body: 'mine', labels: 'theirs' });
  assert.deepEqual(merged, { id: '1', title: 'same', body: 'mine-body', labels: ['b'] });
});

test('mergeElementFields: delete-vs-edit → the present side wins whole', () => {
  assert.deepEqual(mergeElementFields({ id: '1' }, null, {}), { id: '1' });
  assert.deepEqual(mergeElementFields(null, { id: '1' }, {}), { id: '1' });
  assert.equal(mergeElementFields(null, null, {}), null);
});
