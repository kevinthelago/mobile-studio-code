import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectGlance, glanceL0Input, fleetToAgents, agentPaneId, type GlancePayload,
} from './glancePage';
import { buildGlanceScene } from '../graph';

const payload = (): GlancePayload => ({
  projects: [
    { id: 'core', name: 'Core', role: 'infra', status: 'building', faults: 2 },
    { id: 'web', name: 'Web' },
  ],
  links: [{ id: 'e1', from: 'web', to: 'core', kind: 'api' }],
  drill: 'core',
  drillFleet: {
    streams: [
      { id: 'auth', name: 'Auth', dependsOn: [] },
      { id: 'ui', name: 'UI', dependsOn: ['auth'] },
    ],
    director: { enabled: true },
  },
});

describe('selectGlance', () => {
  it('parses a full payload', () => {
    const m = selectGlance(payload())!;
    assert.equal(m.projects.length, 2);
    assert.equal(m.projects[0].faults, 2);
    assert.equal(m.drill, 'core');
    assert.equal(m.drillFleet?.streams.length, 2);
  });

  it('returns undefined for missing / malformed payloads', () => {
    assert.equal(selectGlance(undefined), undefined);
    assert.equal(selectGlance(null), undefined);
    assert.equal(selectGlance({}), undefined);
    assert.equal(selectGlance({ projects: 'nope' }), undefined);
  });

  it('drops junk project + link entries but keeps the good ones', () => {
    const m = selectGlance({ projects: [{ id: 'ok' }, { name: 'no id' }, 42], links: [{ from: 'a' }] })!;
    assert.equal(m.projects.length, 1);
    assert.equal(m.projects[0].id, 'ok');
    assert.equal(m.links.length, 0);
  });

  it('treats a fleet with no streams array as no fleet', () => {
    const m = selectGlance({ projects: [{ id: 'x' }], drillFleet: { director: { enabled: true } } })!;
    assert.equal(m.drillFleet, null);
  });
});

describe('glanceL0Input', () => {
  it('attaches agents only to the drilled project', () => {
    const input = glanceL0Input(selectGlance(payload())!);
    const core = input.projects.find((p) => p.id === 'core')!;
    const web = input.projects.find((p) => p.id === 'web')!;
    assert.ok(core.agents && core.agents.length >= 2);
    assert.equal(web.agents, undefined);
  });

  it('defaults role deterministically + status to idle for un-resolved projects', () => {
    const a = glanceL0Input(selectGlance({ projects: [{ id: 'web', name: 'Web' }] })!);
    const b = glanceL0Input(selectGlance({ projects: [{ id: 'web', name: 'Web' }] })!);
    assert.equal(a.projects[0].status, 'idle');
    assert.equal(a.projects[0].role, b.projects[0].role); // deterministic
  });

  it('produces a scene the #220 adapter can lay out', () => {
    const scene = buildGlanceScene(glanceL0Input(selectGlance(payload())!));
    assert.equal(scene.nodes.length, 2);
    assert.ok(scene.worldW > 0);
    // The drilled project is drillable.
    assert.equal(scene.nodes.find((n) => n.id === 'core')!.drillId, 'core');
  });
});

describe('fleetToAgents', () => {
  it('adds a director hub every stream depends on', () => {
    const agents = fleetToAgents(payload().drillFleet!);
    const director = agents.find((a) => a.id === 'director')!;
    assert.equal(director.role, 'director');
    const auth = agents.find((a) => a.id === 'auth')!;
    assert.ok(auth.dependsOn!.includes('director'));
    assert.ok(!director.dependsOn?.includes('director'));
  });

  it('omits the director hub when not enabled', () => {
    const agents = fleetToAgents({ streams: [{ id: 'a' }], director: { enabled: false } });
    assert.equal(agents.find((a) => a.id === 'director'), undefined);
  });
});

describe('agentPaneId', () => {
  it('builds the <project>:<stream> session identity', () => {
    assert.equal(agentPaneId('core', 'auth'), 'core:auth');
  });
});
