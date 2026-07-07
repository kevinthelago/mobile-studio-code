import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime, scopeLabel } from './payload';

const NOW = 1_700_000_000_000;

describe('relativeTime', () => {
  it('renders — for null/garbage timestamps', () => {
    assert.equal(relativeTime(null, NOW), '—');
    assert.equal(relativeTime(undefined, NOW), '—');
    assert.equal(relativeTime(Number.NaN, NOW), '—');
    assert.equal(relativeTime(0, NOW), '—');
    assert.equal(relativeTime(-5, NOW), '—');
  });

  it('renders just now inside the 45s window', () => {
    assert.equal(relativeTime(NOW - 10_000, NOW), 'just now');
    assert.equal(relativeTime(NOW, NOW), 'just now');
  });

  it('renders minutes, hours, days in the past', () => {
    assert.equal(relativeTime(NOW - 5 * 60_000, NOW), '5m ago');
    assert.equal(relativeTime(NOW - 3 * 3_600_000, NOW), '3h ago');
    assert.equal(relativeTime(NOW - 4 * 86_400_000, NOW), '4d ago');
  });

  it('renders future times with an "in" prefix (nextRunAt)', () => {
    assert.equal(relativeTime(NOW + 10_000, NOW), 'in moments');
    assert.equal(relativeTime(NOW + 15 * 60_000, NOW), 'in 15m');
    assert.equal(relativeTime(NOW + 6 * 3_600_000, NOW), 'in 6h');
  });
});

describe('scopeLabel', () => {
  it('treats an empty/absent projects list as global', () => {
    assert.equal(scopeLabel([]), 'Global');
    assert.equal(scopeLabel(undefined), 'Global');
    assert.equal(scopeLabel('not-an-array'), 'Global');
  });

  it('counts scoped projects with singular/plural', () => {
    assert.equal(scopeLabel(['p1']), '1 project');
    assert.equal(scopeLabel(['p1', 'p2', 'p3']), '3 projects');
  });
});
