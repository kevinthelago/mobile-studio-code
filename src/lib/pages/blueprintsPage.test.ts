import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectBlueprints, selectOrgPersonas, blueprintTeamToOrgInput } from './blueprintsPage';
import { buildOrgScene } from '../graph';

const payload = () => ({
  active: 'default',
  library: [
    { id: 'default', name: 'Default', desc: 'greenfield', category: 'greenfield', mode: 'create', tags: ['app'], uses: 4, stageCount: 6, hasTeam: true, uiKit: { id: 'react', version: '1.0', themeId: 'midnight' } },
    { id: 'api', name: 'API', desc: '', stageCount: 4, hasTeam: false },
  ],
  activeTeam: {
    positions: [
      { nodeId: 'dir', kind: 'agent', personaId: 'director' },
      { nodeId: 'w1', kind: 'agent', personaId: 'worker' },
      { nodeId: 'w2', kind: 'agent', personaId: 'worker' },
    ],
    relationships: [
      { id: 'r1', archetype: 'manages', from: 'dir', to: 'w1' },
      { id: 'r2', archetype: 'manages', from: 'dir', to: 'w2' },
    ],
  },
});

describe('selectBlueprints', () => {
  it('parses the library + active team', () => {
    const m = selectBlueprints(payload())!;
    assert.equal(m.library.length, 2);
    assert.equal(m.library[0].hasTeam, true);
    assert.equal(m.library[0].uiKit?.themeId, 'midnight');
    assert.equal(m.activeTeam?.positions.length, 3);
  });

  it('returns undefined for missing / malformed payloads', () => {
    assert.equal(selectBlueprints(undefined), undefined);
    assert.equal(selectBlueprints({}), undefined);
  });

  it('treats an empty team as null', () => {
    const m = selectBlueprints({ active: 'x', library: [], activeTeam: { positions: [] } })!;
    assert.equal(m.activeTeam, null);
  });
});

describe('blueprintTeamToOrgInput', () => {
  it('maps positions/relationships and resolves referenced personas', () => {
    const m = selectBlueprints(payload())!;
    const personas = selectOrgPersonas({ personas: [
      { id: 'director', name: 'Director', role: 'director' },
      { id: 'worker', name: 'Worker', role: 'worker' },
      { id: 'unused', name: 'Nope', role: 'worker' },
    ] });
    const input = blueprintTeamToOrgInput(m.activeTeam!, personas);
    assert.equal(input.positions.length, 3);
    assert.equal(input.personas.length, 2); // only referenced (director + worker)
    // Worker personas stack: the two worker positions collapse into one pool node.
    const scene = buildOrgScene(input);
    const poolNode = scene.nodes.find((n) => (n.stackCount ?? 0) >= 2);
    assert.ok(poolNode, 'the two worker positions pool into one stacked card');
  });

  it('tolerates no personas (renders without pooling)', () => {
    const m = selectBlueprints(payload())!;
    const input = blueprintTeamToOrgInput(m.activeTeam!);
    assert.equal(input.personas.length, 0);
    const scene = buildOrgScene(input);
    assert.equal(scene.nodes.length, 3); // no pooling → all three positions
  });
});

describe('selectOrgPersonas', () => {
  it('returns [] for missing payloads', () => {
    assert.deepEqual(selectOrgPersonas(undefined), []);
    assert.deepEqual(selectOrgPersonas({}), []);
  });
});
