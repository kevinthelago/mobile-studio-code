import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFleetScene, buildGlanceScene, GLANCE_NODE_W, type GlanceGraphInput } from './glanceAdapter';
import { SAMPLE_GLANCE } from './sampleData';

const small = (): GlanceGraphInput => ({
  projects: [
    { id: 'core', role: 'infra', status: 'done' },
    { id: 'api', role: 'service', status: 'building' },
    { id: 'web', role: 'client', status: 'planning' },
  ],
  links: [
    { from: 'api', to: 'core', kind: 'api' }, // api depends on core
    { from: 'web', to: 'api', kind: 'api' }, // web depends on api
  ],
});

// ── layout determinism ──────────────────────────────────────────────────────

test('the same input builds byte-identical scenes (deterministic layout)', () => {
  const a = buildGlanceScene(SAMPLE_GLANCE);
  const b = buildGlanceScene(SAMPLE_GLANCE);
  assert.deepEqual(a, b);
});

test('dependencies land in EARLIER columns (depends-on layering, left→right)', () => {
  const scene = buildGlanceScene(small());
  const x = (id: string) => scene.nodes.find((n) => n.id === id)!.x;
  assert.ok(x('core') < x('api'), 'core (the dependency) sits left of api');
  assert.ok(x('api') < x('web'), 'api sits left of web');
  // Columns are exactly one layer gap apart — fixed spacing, no force pass.
  assert.equal(x('api') - x('core'), x('web') - x('api'));
});

test('every node lands inside the world bounds', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  for (const n of scene.nodes) {
    assert.ok(n.x >= 0 && n.y >= 0, `${n.id} in positive space`);
    assert.ok(n.x + n.w <= scene.worldW && n.y + n.h <= scene.worldH, `${n.id} inside world`);
  }
});

test('a graph with no links falls back to a grid (peers, not one column)', () => {
  const scene = buildGlanceScene({ projects: small().projects, links: [] });
  const xs = new Set(scene.nodes.map((n) => n.x));
  assert.ok(xs.size > 1, 'nodes spread over more than one column');
  assert.equal(scene.edges.length, 0);
});

// ── cycles + edges ──────────────────────────────────────────────────────────

test('mutual dependencies are flagged as cycle edges and bow apart', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  const cyc = scene.edges.filter((e) => e.isCycle);
  assert.equal(cyc.length, 2); // analytics↔reporting, both directions
  assert.notDeepEqual(cyc[0].d, cyc[1].d, 'the two directions take separated paths');
});

test('edges carry the pre-routed geometry + kind styling', () => {
  const scene = buildGlanceScene(small());
  for (const e of scene.edges) {
    assert.match(e.d, /^M .+ C .+/, 'cubic bezier path');
    assert.match(e.arrow, /^M .+ Z$/, 'closed arrowhead');
    assert.ok(e.width > 0);
  }
});

// ── drill: L0 → L1 fleet subgraph ───────────────────────────────────────────

test('a project with agents is drillable; one without is not', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  assert.equal(scene.nodes.find((n) => n.id === 'identity-svc')?.drillId, 'identity-svc');
  assert.equal(scene.nodes.find((n) => n.id === 'auth-core')?.drillId, undefined);
});

test('the fleet scene contains exactly the project agents, wired by dependsOn', () => {
  const fleet = buildFleetScene(SAMPLE_GLANCE, 'identity-svc');
  assert.deepEqual(
    fleet.nodes.map((n) => n.id).sort(),
    ['identity-svc:director', 'identity-svc:reviewer', 'identity-svc:w1', 'identity-svc:w2', 'identity-svc:w3'],
  );
  // Workers depend on the director → the director column is left of the workers.
  const x = (id: string) => fleet.nodes.find((n) => n.id === id)!.x;
  assert.ok(x('identity-svc:director') < x('identity-svc:w1'));
  assert.ok(x('identity-svc:w1') < x('identity-svc:reviewer'));
  // dependsOn edges: 3 workers→director + reviewer→3 workers.
  assert.equal(fleet.edges.length, 6);
});

test('drilling an unknown project yields an empty scene', () => {
  const fleet = buildFleetScene(SAMPLE_GLANCE, 'nope');
  assert.equal(fleet.nodes.length, 0);
  assert.equal(fleet.edges.length, 0);
});

test('node cards carry the glance card content (title/subtitle/status/accent)', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  const analytics = scene.nodes.find((n) => n.id === 'analytics')!;
  assert.equal(analytics.title, 'analytics');
  assert.match(analytics.subtitle!, /data · blocked · 2 faults/);
  assert.ok(analytics.statusColor);
  assert.equal(analytics.pulse, true); // blocked pulses
  assert.equal(analytics.w, GLANCE_NODE_W);
});
