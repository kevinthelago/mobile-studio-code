import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectSkills, groupSkillNames } from './skillsPage';

const full = () => ({
  skills: [
    { id: 's1', name: 'Review checklist', kind: 'context', source: 'packaged', desc: 'd', projects: ['p'], enabled: true, pinned: true, packaged: true },
    { id: 's2', name: 'CI template', kind: 'context', source: 'user', desc: '', projects: [], enabled: false, pinned: false },
  ],
  groups: [{ id: 'g1', name: 'Quality', hue: 'var(--info)', skillIds: ['s1', 'gone'] }],
  lessons: { project: 'p', pending: [{ id: 'l1', mistake: 'm', cause: 'c', rule: 'r', status: 'pending', seen: 2 }] },
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
});

describe('groupSkillNames', () => {
  it('resolves member names and drops ids no longer present', () => {
    const m = selectSkills(full())!;
    assert.deepEqual(groupSkillNames(m.groups[0], m.skills), ['Review checklist']);
  });
});
