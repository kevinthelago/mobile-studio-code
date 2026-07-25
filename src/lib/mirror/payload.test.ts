import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clockTime, readIsoMs, readStringList, readStringMap, relativeTime, scopeLabel,
} from './payload';

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

describe('readStringList', () => {
  it('keeps trimmed non-empty strings', () => {
    assert.deepEqual(readStringList(['gh', ' git ', 'npm']), ['gh', 'git', 'npm']);
  });

  it('drops blanks and non-strings, and survives a non-array', () => {
    assert.deepEqual(readStringList(['gh', '', '   ', 7, null, {}]), ['gh']);
    assert.deepEqual(readStringList(undefined), []);
    assert.deepEqual(readStringList('gh'), []);
  });
});

describe('readStringMap', () => {
  it('keeps string-valued entries', () => {
    assert.deepEqual(readStringMap({ read: 'allow', bash: 'deny' }), { read: 'allow', bash: 'deny' });
  });

  it('drops non-string values and survives non-records', () => {
    assert.deepEqual(readStringMap({ read: 'allow', bash: 3, web: null }), { read: 'allow' });
    assert.deepEqual(readStringMap(undefined), {});
    assert.deepEqual(readStringMap(['allow']), {});
    assert.deepEqual(readStringMap('allow'), {});
  });
});

describe('readIsoMs', () => {
  it('parses the ISO-8601 shape the desktop audit log emits', () => {
    assert.equal(readIsoMs('2026-07-09T14:30:05.000Z'), Date.UTC(2026, 6, 9, 14, 30, 5));
    assert.equal(readIsoMs('2026-07-09T14:30:05Z'), Date.UTC(2026, 6, 9, 14, 30, 5));
  });

  it('returns null for absent values', () => {
    assert.equal(readIsoMs(undefined), null);
    assert.equal(readIsoMs(null), null);
    assert.equal(readIsoMs(''), null);
  });

  it('returns null for malformed or wrongly-typed values', () => {
    assert.equal(readIsoMs('not-a-date'), null);
    assert.equal(readIsoMs('2026-13-45T99:99:99Z'), null);
    // An epoch NUMBER is the shape we wrongly assumed before #237 — reject it
    // loudly rather than silently half-working.
    assert.equal(readIsoMs(1_700_000_000_000), null);
    assert.equal(readIsoMs({ ts: '2026-07-09T14:30:05Z' }), null);
  });

  it('feeds relativeTime', () => {
    const ms = readIsoMs('2026-07-09T14:30:05Z')!;
    assert.equal(relativeTime(ms, ms + 5 * 60_000), '5m ago');
  });
});

describe('clockTime', () => {
  it('renders — for null/garbage timestamps', () => {
    assert.equal(clockTime(null), '—');
    assert.equal(clockTime(undefined), '—');
    assert.equal(clockTime(Number.NaN), '—');
    assert.equal(clockTime(0), '—');
  });

  it('renders a zero-padded local 24h time', () => {
    const ms = readIsoMs('2026-07-09T14:30:05Z')!;
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    assert.match(clockTime(ms), /^\d{2}:\d{2}:\d{2}$/);
    assert.equal(clockTime(ms), `${pad(d.getHours())}:${pad(d.getMinutes())}:05`);
  });

  it('renders midnight as 00:00:00, never 24:00:00', () => {
    const midnight = new Date(2026, 6, 9, 0, 0, 0).getTime();
    assert.equal(clockTime(midnight), '00:00:00');
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
