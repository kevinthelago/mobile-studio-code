import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFleetScene, buildGlanceScene, GLANCE_NODE_W, type GlanceGraphInput } from './glanceAdapter';
import { SAMPLE_GLANCE } from './sampleData';

const small = (): GlanceGraphInput => ({
  projects: [
    { id: 'core', role: 'infra', health: 'healthy', activity: 'live' },
    { id: 'api', role: 'service', health: 'healthy', activity: 'building' },
    { id: 'web', role: 'client', health: 'idle', activity: 'planning' },
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

// ── the two axes (#238) ─────────────────────────────────────────────────────

test('node cards carry the glance card content (title/subtitle/health/accent)', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  const analytics = scene.nodes.find((n) => n.id === 'analytics')!;
  assert.equal(analytics.title, 'analytics');
  assert.ok(analytics.statusColor);
  assert.equal(analytics.pulse, true); // error pulses
  assert.equal(analytics.w, GLANCE_NODE_W);
});

test('a degraded node shows its REASON in place of the activity word', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  const analytics = scene.nodes.find((n) => n.id === 'analytics')!;
  // health `error` + reason ⇒ the why, not "waiting", and no "N faults" tail.
  assert.equal(analytics.subtitle, 'data · schema drift');
  assert.doesNotMatch(analytics.subtitle!, /faults/);
});

test('a healthy node shows its activity word', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  assert.equal(scene.nodes.find((n) => n.id === 'ledger')!.subtitle, 'harden · in review');
});

test('an `off` node renders dimmed, unpulsed, and labelled off', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  const web = scene.nodes.find((n) => n.id === 'web-app')!;
  assert.equal(web.dimmed, true);
  assert.equal(web.pulse, false);
  assert.equal(web.subtitle, 'greenfield · off');
});

test('a dependent inherits a dependency error with a MUTED dot', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  // reporting depends on analytics (error) — it lights up, but muted and unpulsed
  // so the node that actually failed stays the one you look at.
  const reporting = scene.nodes.find((n) => n.id === 'reporting')!;
  const analytics = scene.nodes.find((n) => n.id === 'analytics')!;
  assert.equal(reporting.statusColor, analytics.statusColor);
  assert.equal(reporting.statusMuted, true);
  assert.equal(reporting.pulse, false);
  assert.equal(analytics.statusMuted, false);
});

test('the accent comes from the lifecycle CATEGORY, not a hash of the id', () => {
  const scene = buildGlanceScene(SAMPLE_GLANCE);
  const byId = (id: string) => scene.nodes.find((n) => n.id === id)!;
  // Both `data`-category projects share one accent; a different category differs.
  assert.equal(byId('analytics').accentColor, byId('reporting').accentColor);
  assert.notEqual(byId('analytics').accentColor, byId('ledger').accentColor);
});

test('fleet nodes carry NO status dot (the wire ships no per-stream health)', () => {
  const fleet = buildFleetScene(SAMPLE_GLANCE, 'identity-svc');
  for (const n of fleet.nodes) assert.equal(n.statusColor, undefined);
});
