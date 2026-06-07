import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaneInput, encodeSubmit, ENTER } from './input';

// ── Frame shape (must match shared fixture clientToServer.pane_input) ─────────

test('buildPaneInput produces the canonical pane_input frame', () => {
  assert.deepEqual(buildPaneInput('t0p0', '\r'), {
    type: 'pane_input', paneId: 't0p0', data: '\r',
  });
});

test('the payload field is `data` (not text/input) and the id key is camelCase paneId', () => {
  const f = buildPaneInput('t1p2', 'ls') as Record<string, unknown>;
  assert.equal(f.type, 'pane_input');
  assert.equal(f.data, 'ls');
  assert.equal(f.paneId, 't1p2');
  assert.ok(!('text' in f), 'must not use `text`');
  assert.ok(!('input' in f), 'must not use `input`');
  assert.ok(!('pane_id' in f), 'must not use snake_case pane_id');
});

test('paneId is echoed verbatim (a real desktop pane id like t{tab}p{pane})', () => {
  assert.equal(buildPaneInput('t3p1', 'x').paneId, 't3p1');
});

// ── Enter / carriage return ───────────────────────────────────────────────────

test('encodeSubmit appends a carriage return (raw-mode Enter)', () => {
  assert.equal(ENTER, '\r');
  assert.equal(encodeSubmit('git status'), 'git status\r');
});

test('a bare Enter sends just the carriage return', () => {
  assert.equal(encodeSubmit(''), '\r');
});

// ── Verbatim control bytes (no sanitizing/stripping) ──────────────────────────

test('control and escape bytes pass through untouched', () => {
  // Ctrl-C and an up-arrow escape sequence must survive intact.
  assert.equal(buildPaneInput('t0p0', '\x03').data, '\x03');
  assert.equal(buildPaneInput('t0p0', '\x1b[A').data, '\x1b[A');
  assert.equal(encodeSubmit('\x03'), '\x03\r');
});
