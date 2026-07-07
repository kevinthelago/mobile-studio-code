import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_SECURITY_VIEW, selectSecurityView } from './securityView';

describe('selectSecurityView', () => {
  it('returns the empty view when the domain is absent (not yet published)', () => {
    assert.deepEqual(selectSecurityView(undefined), EMPTY_SECURITY_VIEW);
    assert.deepEqual(selectSecurityView(null), EMPTY_SECURITY_VIEW);
    assert.equal(selectSecurityView(undefined).empty, true);
  });

  it('survives wire garbage as the empty view', () => {
    assert.deepEqual(selectSecurityView('junk'), EMPTY_SECURITY_VIEW);
    assert.deepEqual(selectSecurityView([1, 2]), EMPTY_SECURITY_VIEW);
    const v = selectSecurityView({ audit: 'nope', profiles: 7, assignments: {} });
    assert.equal(v.empty, true);
  });

  it('maps audit entries newest first with actor/detail aliases', () => {
    const v = selectSecurityView({
      audit: [
        { id: 'e1', at: 1_000, action: 'git push', detail: 'denied', actor: 'worker-api' },
        { id: 'e2', at: 3_000, tool: 'Bash', note: 'allowed', session: 'director' },
        { id: 'e3', name: 'gh pr merge' }, // no timestamp → sorts last
      ],
    });
    assert.equal(v.empty, false);
    assert.deepEqual(v.audit.map((e) => e.id), ['e2', 'e1', 'e3']);
    assert.equal(v.audit[0].action, 'Bash');
    assert.equal(v.audit[0].detail, 'allowed');
    assert.equal(v.audit[0].actor, 'director');
    assert.equal(v.audit[2].at, null);
    assert.equal(v.audit[2].detail, null);
  });

  it('maps profiles with a capability summary when caps are present', () => {
    const v = selectSecurityView({
      profiles: [
        { id: 'p1', name: 'API worker', role: 'worker', commands: ['a', 'b'], writePaths: ['src/**'] },
        { id: 'p2' },
      ],
    });
    assert.equal(v.profiles[0].name, 'API worker');
    assert.equal(v.profiles[0].role, 'worker');
    assert.equal(v.profiles[0].summary, '2 commands · 1 write path');
    assert.equal(v.profiles[1].name, 'p2');
    assert.equal(v.profiles[1].summary, null);
  });

  it('maps assignments with subject/profile aliases and drops empty rows', () => {
    const v = selectSecurityView({
      assignments: [
        { stream: 'api', profile: 'API worker' },
        { session: 'director', profileId: 'director-default' },
        {},
      ],
    });
    assert.equal(v.assignments.length, 2);
    assert.deepEqual(
      v.assignments.map((a) => [a.subject, a.profile]),
      [['api', 'API worker'], ['director', 'director-default']],
    );
  });

  it('a partial payload fills only its own section', () => {
    const v = selectSecurityView({ profiles: [{ id: 'p', name: 'Solo' }] });
    assert.equal(v.empty, false);
    assert.deepEqual(v.audit, []);
    assert.deepEqual(v.assignments, []);
    assert.equal(v.profiles.length, 1);
  });
});
