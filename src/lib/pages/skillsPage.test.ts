import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectSkills, groupSkillNames, relativeAge } from './skillsPage';

const full = () => ({
  skills: [
    { id: 's1', name: 'Review checklist', kind: 'context', source: 'packaged', desc: 'd', projects: ['p'], enabled: true, pinned: true, packaged: true },
    { id: 's2', name: 'CI template', kind: 'context', source: 'user', desc: '', projects: [], enabled: false, pinned: false },
  ],
  groups: [{ id: 'g1', name: 'Quality', hue: 'var(--info)', skillIds: ['s1', 'gone'] }],
  lessons: {
    project: 'p',
    pending: [{ id: 'l1', mistake: 'm', cause: 'c', rule: 'r', status: 'pending', seen: 2, provenance: 'pane 1', createdAt: 1000, updatedAt: 2000 }],
  },
});

describe('selectSkills', () => {
  it('parses a full payload', () => {
    const m = selectSkills(full())!;
    assert.equal(m.skills.length, 2);
    assert.equal(m.skills[0].pinned, true);
    assert.equal(m.skills[1].enabled, false);
    assert.equal(m.groups[0].name, 'Quality');
    assert.equal(m.lessons?.pending[0].seen, 2);
  });

  it('returns undefined for missing / malformed payloads', () => {
    assert.equal(selectSkills(undefined), undefined);
    assert.equal(selectSkills({}), undefined);
    assert.equal(selectSkills({ skills: 5 }), undefined);
  });

  it('tolerates absent groups / lessons', () => {
    const m = selectSkills({ skills: [] })!;
    assert.deepEqual(m.groups, []);
    assert.equal(m.lessons, null);
  });

  it('carries lesson provenance + timestamps (#245 S1 — previously dropped)', () => {
    const l = selectSkills(full())!.lessons!.pending[0];
    assert.equal(l.provenance, 'pane 1');
    assert.equal(l.createdAt, 1000);
    assert.equal(l.updatedAt, 2000);
    // Epoch ms on BOTH sides — the security-domain ISO-string trap does not exist here.
    assert.equal(typeof l.createdAt, 'number');
  });

  it('defaults missing lesson timestamps to 0 rather than NaN', () => {
    const m = selectSkills({ skills: [], lessons: { project: 'p', pending: [{ id: 'l1' }] } })!;
    const l = m.lessons!.pending[0];
    assert.equal(l.createdAt, 0);
    assert.equal(l.provenance, '');
  });

  it('sorts the pending queue newest first, keeping ties in payload order', () => {
    const m = selectSkills({
      skills: [],
      lessons: {
        project: 'p',
        pending: [
          { id: 'old', createdAt: 100 },
          { id: 'newest', createdAt: 900 },
          { id: 'tieA', createdAt: 500 },
          { id: 'tieB', createdAt: 500 },
        ],
      },
    })!;
    assert.deepEqual(m.lessons!.pending.map((l) => l.id), ['newest', 'tieA', 'tieB', 'old']);
  });

  it('drops the CSS hue rather than handing it to a native colour prop (#245 S2)', () => {
    // Desktop hues are `var(--accent)` / `oklch(...)` — React Native can parse neither, so the
    // field is deliberately absent from the VM. See the note on SkillGroupVM.
    const g = selectSkills(full())!.groups[0];
    assert.equal('hue' in g, false);
  });
});

describe('relativeAge', () => {
  const now = 1_000_000_000_000;
  const ago = (ms: number) => relativeAge(now - ms, now);

  it('renders each bucket', () => {
    assert.equal(ago(5_000), 'just now');
    assert.equal(ago(5 * 60_000), '5m ago');
    assert.equal(ago(3 * 3_600_000), '3h ago');
    assert.equal(ago(2 * 86_400_000), '2d ago');
    assert.equal(ago(45 * 86_400_000), '1mo ago');
    assert.equal(ago(400 * 86_400_000), '1y ago');
  });

  it('is empty for a missing timestamp, so a pre-field desktop shows no bogus age', () => {
    assert.equal(relativeAge(0, now), '');
    assert.equal(relativeAge(Number.NaN, now), '');
  });

  it('is empty for a future timestamp rather than rendering a negative age', () => {
    assert.equal(relativeAge(now + 60_000, now), '');
  });
});

describe('groupSkillNames', () => {
  it('resolves member names and drops ids no longer present', () => {
    const m = selectSkills(full())!;
    assert.deepEqual(groupSkillNames(m.groups[0], m.skills), ['Review checklist']);
  });
});
