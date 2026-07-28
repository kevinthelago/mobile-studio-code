import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectOrg, selectOrgPersonas, selectOrgTeams, teamToOrgInput } from './orgPage';
import { buildOrgScene } from '../graph';

/** Shaped like the mirrored `org` payload: the whole team library + the persona refs. */
const payload = () => ({
  orgs: [
    {
      id: 'o1',
      name: 'Delivery',
      blurb: 'ships the product',
      builtin: true,
      positions: [
        { nodeId: 'dir', kind: 'agent', personaId: 'director' },
        { nodeId: 'w1', kind: 'agent', personaId: 'worker' },
        { nodeId: 'w2', kind: 'agent', personaId: 'worker' },
        { nodeId: 'db', kind: 'resource', label: 'Postgres' },
      ],
      relationships: [
        { id: 'r1', archetype: 'manages', from: 'dir', to: 'w1' },
        { id: 'r2', archetype: 'manages', from: 'dir', to: 'w2' },
        { id: 'r3', archetype: 'stewards', from: 'dir', to: 'db' },
      ],
    },
    {
      id: 'o2',
      name: 'Research',
      positions: [{ nodeId: 'a', kind: 'agent', personaId: 'director' }],
      relationships: [],
    },
  ],
  personas: [
    { id: 'director', name: 'Director', role: 'director', blurb: 'sets direction', model: 'opus', builtin: true },
    { id: 'worker', name: 'Worker', role: 'worker' },
  ],
});

describe('selectOrgTeams', () => {
  it('parses the whole team library, not just one team', () => {
    const teams = selectOrgTeams(payload());
    assert.equal(teams.length, 2);
    assert.deepEqual(teams.map((t) => t.id), ['o1', 'o2']);
    assert.equal(teams[0].positions.length, 4);
    assert.equal(teams[0].relationships.length, 3);
  });

  it('carries the picker fields — name, blurb, builtin', () => {
    const [delivery, research] = selectOrgTeams(payload());
    assert.equal(delivery.name, 'Delivery');
    assert.equal(delivery.blurb, 'ships the product');
    assert.equal(delivery.builtin, true);
    // Absent optionals stay undefined rather than becoming a misleading default.
    assert.equal(research.blurb, undefined);
    assert.equal(research.builtin, undefined);
  });

  it('falls back to the id when a team has no name', () => {
    const teams = selectOrgTeams({ orgs: [{ id: 'o9', positions: [{ nodeId: 'n', kind: 'agent' }] }] });
    assert.equal(teams[0].name, 'o9');
  });

  it('returns [] for missing / malformed payloads', () => {
    assert.deepEqual(selectOrgTeams(undefined), []);
    assert.deepEqual(selectOrgTeams({}), []);
    assert.deepEqual(selectOrgTeams({ orgs: 'nope' }), []);
    assert.deepEqual(selectOrgTeams({ orgs: [null, 42, { name: 'no id' }] }), []);
  });

  it('skips a team with zero renderable positions', () => {
    const teams = selectOrgTeams({
      orgs: [
        { id: 'empty', name: 'Empty', positions: [], relationships: [{ id: 'r', archetype: 'manages', from: 'a', to: 'b' }] },
        { id: 'ok', name: 'Ok', positions: [{ nodeId: 'n', kind: 'agent' }] },
      ],
    });
    assert.deepEqual(teams.map((t) => t.id), ['ok']);
  });

  it('drops malformed positions and relationships but keeps the team', () => {
    const teams = selectOrgTeams({
      orgs: [{
        id: 'o',
        positions: [{ nodeId: 'good', kind: 'agent' }, { kind: 'agent' }, null],
        relationships: [{ id: 'r1', archetype: 'peers', from: 'good', to: 'good' }, { from: 'good' }],
      }],
    });
    assert.equal(teams[0].positions.length, 1);
    assert.equal(teams[0].relationships.length, 1);
  });

  it('defaults an unknown position kind to agent and a missing archetype to manages', () => {
    const teams = selectOrgTeams({
      orgs: [{
        id: 'o',
        positions: [{ nodeId: 'n1', kind: 'wat' }, { nodeId: 'n2', kind: 'external', label: 'CI' }],
        relationships: [{ id: 'r', from: 'n1', to: 'n2' }],
      }],
    });
    assert.equal(teams[0].positions[0].kind, 'agent');
    assert.equal(teams[0].positions[1].kind, 'external');
    assert.equal(teams[0].relationships[0].archetype, 'manages');
  });
});

describe('selectOrgPersonas', () => {
  it('carries blurb, model and builtin (#235 — previously dropped)', () => {
    const [director] = selectOrgPersonas(payload());
    assert.equal(director.blurb, 'sets direction');
    assert.equal(director.model, 'opus');
    assert.equal(director.builtin, true);
    assert.equal(director.role, 'director');
  });

  it('parses personas that omit the optional fields', () => {
    const [, worker] = selectOrgPersonas(payload());
    assert.equal(worker.name, 'Worker');
    assert.equal(worker.blurb, undefined);
    assert.equal(worker.model, undefined);
    assert.equal(worker.builtin, undefined);
    assert.equal(worker.pooled, undefined);
  });

  it('falls back to the id when a persona has no name, and skips entries without an id', () => {
    const out = selectOrgPersonas({ personas: [{ id: 'p1' }, { name: 'no id' }] });
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'p1');
  });

  it('returns [] for missing payloads', () => {
    assert.deepEqual(selectOrgPersonas(undefined), []);
    assert.deepEqual(selectOrgPersonas({}), []);
  });
});

describe('selectOrg', () => {
  it('parses teams and personas together', () => {
    const model = selectOrg(payload());
    assert.equal(model.teams.length, 2);
    assert.equal(model.personas.length, 2);
  });

  it('degrades to empty rather than throwing on an absent payload', () => {
    assert.deepEqual(selectOrg(undefined), { teams: [], personas: [] });
  });
});

describe('teamToOrgInput', () => {
  it('renders a library team through the org adapter, pooling its workers', () => {
    const model = selectOrg(payload());
    const input = teamToOrgInput(model.teams[0], model.personas);
    assert.equal(input.positions.length, 4);
    assert.equal(input.personas.length, 2); // only the referenced ones
    const scene = buildOrgScene(input);
    assert.ok(scene.nodes.find((n) => (n.stackCount ?? 0) >= 2), 'the two worker positions pool');
  });

  it('passes blurb + model through to the persona the inspector reads', () => {
    const model = selectOrg(payload());
    const input = teamToOrgInput(model.teams[0], model.personas);
    const director = input.personas.find((p) => p.id === 'director');
    assert.equal(director?.blurb, 'sets direction');
    assert.equal(director?.model, 'opus');
  });

  it('tolerates no personas', () => {
    const model = selectOrg(payload());
    const input = teamToOrgInput(model.teams[1]);
    assert.equal(input.personas.length, 0);
    assert.equal(buildOrgScene(input).nodes.length, 1);
  });
});
