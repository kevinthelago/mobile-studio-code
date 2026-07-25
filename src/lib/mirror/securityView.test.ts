import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_SECURITY_VIEW, auditKind, selectSecurityView } from './securityView';

/**
 * Fixtures are literal `buildSecurityPayload` output (base-studio-code
 * `tunnel/lib/storeProjections.ts:396`) for the real packaged roles in
 * `src-tauri/data/roles/` — i.e. the projection drops `color`/`origin` and
 * flattens `net.allow` to `net`.
 *
 * This is the point of #237: the suite this replaces asserted an INVENTED shape
 * and so stayed green while the page rendered blank. Anything asserted here has
 * to be something the desktop actually sends.
 */

/** `autonomous.json` as projected — permissive, has commands and both globs. */
const PF_AUTO = {
  id: 'pf_auto',
  name: 'Autonomous (trusted)',
  category: 'user',
  desc: "Runs unattended — auto-approves the full allowlist and most tools.",
  mode: 'allow',
  commands: ['cargo', 'npm', 'pnpm', 'pytest', 'make', 'node', 'docker', 'gh', 'aws'],
  tools: {
    read: 'allow', grep: 'allow', glob: 'allow', edit: 'allow',
    write: 'allow', bash: 'allow', web: 'allow', task: 'allow',
  },
  paths: { allow: ['**/*'], deny: ['**/.env', '**/secrets/**'] },
  net: ['*'],
  builtin: true,
};

/** `read-only-review.json` as projected — deny-by-default, no commands. */
const PF_REVIEW = {
  id: 'pf_review',
  name: 'Read-only review',
  category: 'user',
  desc: 'Inspect, search, and comment — never mutates the tree.',
  mode: 'deny',
  commands: [],
  tools: {
    read: 'allow', grep: 'allow', glob: 'allow', edit: 'deny',
    write: 'deny', bash: 'ask', web: 'ask', task: 'allow',
  },
  paths: { allow: [], deny: ['**/*'] },
  net: ['api.github.com'],
  builtin: true,
};

/** `AuditRecord` rows exactly as `parseAuditLog` emits them, newest first. */
const AUDIT = [
  { ts: '2026-07-09T14:32:00.000Z', pane: 't0p1', toolName: 'WebFetch', target: 'https://docs.rs/tokio' },
  { ts: '2026-07-09T14:30:05.000Z', pane: 't0p1', toolName: 'Bash', target: 'cargo test --workspace' },
  { ts: '2026-07-09T14:28:11.000Z', pane: 't1p0', toolName: 'Edit', target: 'src/lib/agent.ts' },
];

const FULL = {
  profiles: [PF_AUTO, PF_REVIEW],
  paneRoles: { t0p1: 'worker', t1p0: 'director' },
  paneProfiles: { t0p1: 'pf_auto', t1p0: 'pf_review' },
  audit: AUDIT,
};

describe('selectSecurityView — degenerate input', () => {
  it('returns the empty view when the domain has not been pushed', () => {
    assert.deepEqual(selectSecurityView(undefined), EMPTY_SECURITY_VIEW);
    assert.deepEqual(selectSecurityView(null), EMPTY_SECURITY_VIEW);
  });

  it('survives wire garbage as the empty view', () => {
    assert.deepEqual(selectSecurityView('junk'), EMPTY_SECURITY_VIEW);
    assert.deepEqual(selectSecurityView([1, 2]), EMPTY_SECURITY_VIEW);
    const v = selectSecurityView({
      profiles: 7, paneRoles: 'nope', paneProfiles: [], audit: 'nope',
    });
    assert.equal(v.empty, true);
  });

  it('treats an empty-but-well-formed payload as empty', () => {
    const v = selectSecurityView({ profiles: [], paneRoles: {}, paneProfiles: {}, audit: [] });
    assert.deepEqual(v, EMPTY_SECURITY_VIEW);
  });

  it('a partial payload fills only its own section', () => {
    const v = selectSecurityView({ profiles: [PF_REVIEW] });
    assert.equal(v.empty, false);
    assert.equal(v.profiles.length, 1);
    assert.deepEqual(v.audit, []);
    assert.deepEqual(v.assignments, []);
  });

  it('is non-empty when only the transient pane records are present', () => {
    // Panes launched, no audit polled yet, profiles slice not pushed.
    const v = selectSecurityView({ paneRoles: { t0p0: 'director' } });
    assert.equal(v.empty, false);
    assert.equal(v.assignments.length, 1);
  });
});

describe('selectSecurityView — audit', () => {
  it('reads the wire fields (ts/pane/toolName/target), not the invented ones', () => {
    const v = selectSecurityView(FULL);
    const first = v.audit[0];
    assert.equal(first.pane, 't0p1');
    assert.equal(first.toolName, 'WebFetch');
    assert.equal(first.target, 'https://docs.rs/tokio');
    assert.equal(first.at, Date.UTC(2026, 6, 9, 14, 32, 0));
    // No row may render as a bare em-dash — every row carries real content.
    for (const e of v.audit) {
      assert.ok(e.toolName.length > 0, 'toolName is populated');
      assert.ok(e.pane.length > 0, 'pane is populated');
      assert.notEqual(e.at, null);
    }
  });

  it('sorts newest first on the parsed epoch', () => {
    const shuffled = { audit: [AUDIT[2], AUDIT[0], AUDIT[1]] };
    const v = selectSecurityView(shuffled);
    assert.deepEqual(v.audit.map((e) => e.toolName), ['WebFetch', 'Bash', 'Edit']);
  });

  it('sinks unparseable timestamps below dated rows, holding wire order', () => {
    const v = selectSecurityView({
      audit: [
        { ts: 'garbage-a', pane: 't0p0', toolName: 'Read', target: 'a.ts' },
        AUDIT[1],
        { ts: 'garbage-b', pane: 't0p0', toolName: 'Read', target: 'b.ts' },
        AUDIT[0],
      ],
    });
    assert.deepEqual(v.audit.map((e) => e.target), [
      'https://docs.rs/tokio', 'cargo test --workspace', 'a.ts', 'b.ts',
    ]);
    // The raw value survives so the row can still show something.
    assert.equal(v.audit[2].at, null);
    assert.equal(v.audit[2].ts, 'garbage-a');
  });

  it('derives kind with the desktop sets', () => {
    assert.equal(auditKind('Bash'), 'cmd');
    assert.equal(auditKind('WebFetch'), 'net');
    assert.equal(auditKind('WebSearch'), 'net');
    assert.equal(auditKind('Edit'), 'tool');
    assert.equal(auditKind('Read'), 'tool');
    assert.deepEqual(selectSecurityView(FULL).audit.map((e) => e.kind), ['net', 'cmd', 'tool']);
  });

  it('drops records with nothing renderable and tolerates an empty target', () => {
    const v = selectSecurityView({
      audit: [{}, 'junk', null, { ts: '2026-07-09T14:00:00Z', pane: 't0p0', toolName: 'Read', target: '' }],
    });
    assert.equal(v.audit.length, 1);
    assert.equal(v.audit[0].target, '');
  });
});

describe('selectSecurityView — profiles', () => {
  it('carries the whole permission model, not just the name', () => {
    const [auto, review] = selectSecurityView(FULL).profiles;
    assert.equal(auto.name, 'Autonomous (trusted)');
    assert.equal(auto.mode, 'allow');
    assert.equal(auto.category, 'user');
    assert.equal(auto.builtin, true);
    assert.ok(auto.desc?.startsWith('Runs unattended'));
    assert.deepEqual(auto.paths, { allow: ['**/*'], deny: ['**/.env', '**/secrets/**'] });
    assert.deepEqual(auto.net, ['*']);
    assert.equal(auto.tools.bash, 'allow');
    assert.equal(review.mode, 'deny');
    assert.equal(review.tools.bash, 'ask');
    assert.deepEqual(review.paths, { allow: [], deny: ['**/*'] });
  });

  it('counts the tools RECORD in the summary (the Array.isArray bug)', () => {
    const [auto, review] = selectSecurityView(FULL).profiles;
    assert.equal(auto.summary, '9 commands · 8 tools · 3 paths · 1 host');
    assert.equal(review.summary, '8 tools · 1 path · 1 host');
  });

  it('falls back to the id for an unnamed profile and reports a bare one', () => {
    const v = selectSecurityView({ profiles: [{ id: 'pf_bare' }, {}] });
    assert.equal(v.profiles[0].name, 'pf_bare');
    assert.equal(v.profiles[0].summary, null);
    assert.equal(v.profiles[0].mode, null);
    assert.equal(v.profiles[0].builtin, false);
    assert.equal(v.profiles[1].id, 'profile-1');
  });

  it('ignores mistyped capability fields rather than throwing', () => {
    const v = selectSecurityView({
      profiles: [{ id: 'p', tools: ['read'], paths: 'nope', net: 3, commands: { a: 1 } }],
    });
    assert.deepEqual(v.profiles[0].tools, {});
    assert.deepEqual(v.profiles[0].paths, { allow: [], deny: [] });
    assert.deepEqual(v.profiles[0].net, []);
    assert.equal(v.profiles[0].summary, null);
  });
});

describe('selectSecurityView — assignments (joined, not received)', () => {
  it('joins paneRoles and paneProfiles by paneId and resolves the profile name', () => {
    const v = selectSecurityView(FULL);
    assert.deepEqual(
      v.assignments.map((a) => [a.pane, a.role, a.profile]),
      [['t0p1', 'worker', 'Autonomous (trusted)'], ['t1p0', 'director', 'Read-only review']],
    );
  });

  it('keeps a pane that has a role but no profile', () => {
    const v = selectSecurityView({
      profiles: [PF_REVIEW],
      paneRoles: { t0p0: 'director', t0p1: 'worker' },
      paneProfiles: { t0p0: 'pf_review' },
    });
    assert.equal(v.assignments.length, 2);
    const orphan = v.assignments.find((a) => a.pane === 't0p1')!;
    assert.equal(orphan.role, 'worker');
    assert.equal(orphan.profileId, null);
    assert.equal(orphan.profile, null);
  });

  it('keeps a pane that has a profile but no role', () => {
    const v = selectSecurityView({ profiles: [PF_REVIEW], paneProfiles: { t2p0: 'pf_review' } });
    assert.deepEqual(
      v.assignments.map((a) => [a.pane, a.role, a.profile]),
      [['t2p0', null, 'Read-only review']],
    );
  });

  it('falls back to the raw id when the profile list has no match', () => {
    const v = selectSecurityView({
      profiles: [PF_REVIEW],
      paneProfiles: { t0p0: 'pf_deleted' },
    });
    assert.equal(v.assignments[0].profileId, 'pf_deleted');
    assert.equal(v.assignments[0].profile, 'pf_deleted');
  });

  it('never reads a top-level `assignments` key (the invented shape)', () => {
    const v = selectSecurityView({
      assignments: [{ subject: 'api', profile: 'API worker' }],
    });
    assert.deepEqual(v.assignments, []);
    assert.equal(v.empty, true);
  });
});
