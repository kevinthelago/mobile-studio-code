import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectGlance, glanceL0Input, fleetToAgents, agentPaneId, type GlancePayload,
} from './glancePage';
import { buildGlanceScene } from '../graph';

/**
 * The fixture is the real `develop` shape (#238): `ProjectLite` carries `health` + `activity`
 * (base-studio-code#2541) and the payload carries `fleets` + `personaRoles` (#2530). There is no
 * `status` field — reading one is what made every node render idle for ~12 days.
 */
const payload = (): GlancePayload => ({
  projects: [
    { id: 'core', name: 'Core', role: 'infra', category: 'maintain', health: 'error', activity: 'building', reason: 'build failing', faults: 2 },
    { id: 'web', name: 'Web' },
  ],
  links: [{ id: 'e1', from: 'web', to: 'core', kind: 'api' }],
  drill: 'core',
  drillFleet: {
    streams: [
      { id: 'auth', name: 'Auth', persona: 'p-auth', dependsOn: [] },
      { id: 'ui', name: 'UI', persona: 'p-ui', dependsOn: ['auth'] },
    ],
    director: { enabled: true, role: 'planner' },
  },
  fleets: {
    core: {
      streams: [{ id: 'auth', name: 'Auth', persona: 'p-auth', dependsOn: [] }],
      director: { enabled: true, role: 'planner' },
    },
    web: {
      streams: [{ id: 'shell', name: 'Shell', persona: 'p-shell', dependsOn: [] }],
    },
  },
  personaRoles: { 'p-auth': 'reviewer', 'p-shell': 'tester' },
});

describe('selectGlance', () => {
  it('parses a full payload including the two axes and the #2530 records', () => {
    const m = selectGlance(payload())!;
    assert.equal(m.projects.length, 2);
    assert.equal(m.projects[0].health, 'error');
    assert.equal(m.projects[0].activity, 'building');
    assert.equal(m.projects[0].category, 'maintain');
    assert.equal(m.projects[0].reason, 'build failing');
    assert.equal(m.projects[0].faults, 2);
    assert.equal(m.drill, 'core');
    assert.deepEqual(Object.keys(m.fleets).sort(), ['core', 'web']);
    assert.equal(m.personaRoles['p-auth'], 'reviewer');
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

  it('defaults the #2530 records when an older desktop omits them', () => {
    const m = selectGlance({ projects: [{ id: 'x' }] })!;
    assert.deepEqual(m.fleets, {});
    assert.deepEqual(m.personaRoles, {});
  });

  // ── union validation (the #238 guard) ─────────────────────────────────────

  it('rejects union values it does not recognise instead of casting them through', () => {
    const m = selectGlance({
      projects: [{
        id: 'x', health: 'exploded', activity: 'vibing', category: 'nonsense', role: 'mystery',
      }],
    })!;
    assert.equal(m.projects[0].health, undefined);
    assert.equal(m.projects[0].activity, undefined);
    assert.equal(m.projects[0].category, undefined);
    assert.equal(m.projects[0].role, undefined);
  });

  it('does not resurrect the deleted `status` field', () => {
    const m = selectGlance({ projects: [{ id: 'x', status: 'building' }] })!;
    assert.equal((m.projects[0] as unknown as Record<string, unknown>).status, undefined);
    assert.equal(m.projects[0].activity, undefined);
  });

  it('falls back an unknown edge kind to `api` rather than an unindexable value', () => {
    const m = selectGlance({
      projects: [{ id: 'a' }, { id: 'b' }],
      links: [{ id: 'e', from: 'a', to: 'b', kind: 'quantum-entangles' }],
    })!;
    assert.equal(m.links[0].kind, 'api');
  });

  it('accepts the widened edge kinds', () => {
    const m = selectGlance({
      projects: [{ id: 'a' }, { id: 'b' }],
      links: [
        { id: 'e1', from: 'a', to: 'b', kind: 'uses-kit' },
        { id: 'e2', from: 'b', to: 'a', kind: 'requires' },
      ],
    })!;
    assert.deepEqual(m.links.map((l) => l.kind), ['uses-kit', 'requires']);
  });

  it('a payload from a newer desktop lays out instead of throwing', () => {
    const m = selectGlance({
      projects: [{ id: 'a', health: 'quantum', activity: 'transcending' }, { id: 'b' }],
      links: [{ id: 'e', from: 'a', to: 'b', kind: 'telepathy' }],
    })!;
    assert.doesNotThrow(() => buildGlanceScene(glanceL0Input(m)));
  });
});

describe('glanceL0Input', () => {
  it('makes EVERY project in `fleets` drillable, not just the drilled one', () => {
    const input = glanceL0Input(selectGlance(payload())!);
    const core = input.projects.find((p) => p.id === 'core')!;
    const web = input.projects.find((p) => p.id === 'web')!;
    assert.ok(core.agents && core.agents.length > 0);
    // `web` is NOT the desktop's drilled project — pre-#2530 it had no fleet at all.
    assert.ok(web.agents && web.agents.length > 0);
  });

  it('falls back to drillFleet for the drilled project when `fleets` is absent', () => {
    const p = payload();
    const m = selectGlance({ ...p, fleets: undefined })!;
    const input = glanceL0Input(m);
    assert.ok(input.projects.find((p2) => p2.id === 'core')!.agents!.length >= 2);
    assert.equal(input.projects.find((p2) => p2.id === 'web')!.agents, undefined);
  });

  it('defaults both axes to idle for an unresolved project', () => {
    const input = glanceL0Input(selectGlance({ projects: [{ id: 'web', name: 'Web' }] })!);
    assert.equal(input.projects[0].health, 'idle');
    assert.equal(input.projects[0].activity, 'idle');
    assert.equal(input.projects[0].role, 'service');
  });

  it('carries category and reason through to the adapter', () => {
    const input = glanceL0Input(selectGlance(payload())!);
    const core = input.projects.find((p) => p.id === 'core')!;
    assert.equal(core.category, 'maintain');
    assert.equal(core.reason, 'build failing');
  });

  it('produces a scene the #220 adapter can lay out', () => {
    const scene = buildGlanceScene(glanceL0Input(selectGlance(payload())!));
    assert.equal(scene.nodes.length, 2);
    assert.ok(scene.worldW > 0);
    assert.equal(scene.nodes.find((n) => n.id === 'core')!.drillId, 'core');
  });

  it('rolls a project error up onto its dependent', () => {
    // web depends on core, and core is in `error`.
    const scene = buildGlanceScene(glanceL0Input(selectGlance(payload())!));
    const web = scene.nodes.find((n) => n.id === 'web')!;
    assert.equal(web.statusMuted, true);
    assert.equal(web.statusColor, scene.nodes.find((n) => n.id === 'core')!.statusColor);
  });
});

describe('fleetToAgents', () => {
  it('resolves each stream role from personaRoles instead of hardcoding worker', () => {
    const agents = fleetToAgents(payload().drillFleet!, payload().personaRoles);
    assert.equal(agents.find((a) => a.id === 'auth')!.role, 'reviewer');
    // A stream whose persona has no mapping still degrades to worker.
    assert.equal(agents.find((a) => a.id === 'ui')!.role, 'worker');
  });

  it('defaults every stream to worker when personaRoles is absent', () => {
    const agents = fleetToAgents(payload().drillFleet!);
    assert.equal(agents.find((a) => a.id === 'auth')!.role, 'worker');
  });

  it('adds a director hub every stream depends on, keeping its own role', () => {
    const agents = fleetToAgents(payload().drillFleet!);
    const director = agents.find((a) => a.id === 'director')!;
    assert.equal(director.role, 'planner'); // retained from the wire, not hardcoded
    const auth = agents.find((a) => a.id === 'auth')!;
    assert.ok(auth.dependsOn!.includes('director'));
    assert.ok(!director.dependsOn?.includes('director'));
  });

  it('invents no activity for a stream', () => {
    for (const a of fleetToAgents(payload().drillFleet!)) assert.equal(a.activity, undefined);
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
