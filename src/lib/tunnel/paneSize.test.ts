import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fitTerminalFontSize, attachPaneSize, createPaneState,
  BASE_TERMINAL_FONT, MIN_TERMINAL_FONT,
} from './paneSize';
import type { PaneDescriptor, PaneState, TunnelServerMessage } from '../types';

const DESC: PaneDescriptor = { id: 't0p0', cwd: '/x', name: 'pane', status: 'running' };

// ── Protocol shape ──────────────────────────────────────────────────────────

test('pane_size matches the shared fixture shape and is a valid server message', () => {
  // Mirrors base-studio-code shared fixture serverToClient.pane_size.
  const frame: TunnelServerMessage = { type: 'pane_size', paneId: 't0p0', cols: 80, rows: 24 };
  assert.deepEqual(JSON.parse(JSON.stringify(frame)), {
    type: 'pane_size', paneId: 't0p0', cols: 80, rows: 24,
  });
});

// ── Font fitting (the desktop dictates the size) ──────────────────────────────

test('fits the font so cols span the available width', () => {
  // 80 cols at 0.6em advance → 80*0.6 = 48 cells of width; 384/48 = 8px.
  assert.equal(fitTerminalFontSize(384, 80), 8);
});

test('never enlarges past the base font when width is generous', () => {
  assert.equal(fitTerminalFontSize(4000, 80), BASE_TERMINAL_FONT);
});

test('never shrinks below the minimum font for very wide grids', () => {
  assert.equal(fitTerminalFontSize(10, 240), MIN_TERMINAL_FONT);
});

test('falls back to the base font on degenerate inputs', () => {
  assert.equal(fitTerminalFontSize(0, 80), BASE_TERMINAL_FONT);
  assert.equal(fitTerminalFontSize(384, 0), BASE_TERMINAL_FONT);
});

// ── Applying / buffering pane_size ────────────────────────────────────────────

test('applies pane_size to a mounted pane', () => {
  const panes: Record<string, PaneState> = {
    t0p0: createPaneState(DESC, { active: true, size: null, now: 1 }),
  };
  const next = attachPaneSize(panes, 't0p0', { cols: 80, rows: 24 });
  assert.deepEqual(next.t0p0.ptySize, { cols: 80, rows: 24 });
});

test('is a no-op (buffered by caller) when the pane is not mounted yet', () => {
  const panes: Record<string, PaneState> = {};
  // pane_size arrived before pane_list created the pane — caller keeps the size
  // in its cache; the panes map is untouched.
  assert.equal(attachPaneSize(panes, 't0p0', { cols: 80, rows: 24 }), panes);
});

test('is a no-op when the size is unchanged (same reference, no re-render)', () => {
  const panes: Record<string, PaneState> = {
    t0p0: createPaneState(DESC, { active: true, size: { cols: 80, rows: 24 }, now: 1 }),
  };
  assert.equal(attachPaneSize(panes, 't0p0', { cols: 80, rows: 24 }), panes);
});

test('a pane created from a buffered size carries it on mount', () => {
  // pane_size replayed before pane_list → size cached, then applied at creation.
  const cached = { cols: 100, rows: 30 };
  const pane = createPaneState(DESC, { active: false, size: cached, now: 5 });
  assert.deepEqual(pane.ptySize, cached);
  assert.equal(pane.streamingState, 'minimized');
});
