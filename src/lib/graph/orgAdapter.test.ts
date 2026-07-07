import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrgScene,
  buildPoolScene,
  collapseOrg,
  detectPools,
  poolSubgraph,
  type OrgGraphInput,
} from './orgAdapter';
import { SAMPLE_ORG } from './sampleData';

// ── pool detection (desktop orgPools.ts semantics) ──────────────────────────

test('worker-role personas placed ≥2× collapse into one pool with the member count', () => {
  const pools = detectPools(SAMPLE_ORG);
  assert.equal(pools.length, 1);
  const pool = pools[0];
  assert.equal(pool.nodeId, 'pool:engineer');
  assert.equal(pool.count, 3);
  assert.deepEqual(pool.memberNodeIds, ['n-eng-a', 'n-eng-b', 'n-eng-c']);
});

test('mixed external wiring stacks anyway but clears homogeneous (#2436 shape)', () => {
  const pools = detectPools(SAMPLE_ORG);
  assert.equal(pools[0].homogeneous, false); // Engineer C is stewarded, A/B overseen
});

test('identical external wiring is homogeneous', () => {
  const org: OrgGraphInput = {
    personas: [
      { id: 'boss', role: 'director' },
      { id: 'eng', role: 'worker' },
    ],
    positions: [
      { nodeId: 'b', kind: 'agent', personaId: 'boss' },
      { nodeId: 'e1', kind: 'agent', personaId: 'eng' },
      { nodeId: 'e2', kind: 'agent', personaId: 'eng' },
    ],
    relationships: [
      { id: 'r1', archetype: 'manages', from: 'b', to: 'e1' },
      { id: 'r2', archetype: 'manages', from: 'b', to: 'e2' },
    ],
  };
  const pools = detectPools(org);
  assert.equal(pools[0].homogeneous, true);
});

test('an explicit pooled:false opts a worker persona out; a single placement never pools', () => {
  const org: OrgGraphInput = {
    ...SAMPLE_ORG,
    personas: SAMPLE_ORG.personas.map((p) => (p.id === 'engineer' ? { ...p, pooled: false } : p)),
  };
  assert.equal(detectPools(org).length, 0);
});

// ── collapse ────────────────────────────────────────────────────────────────

test('collapse replaces members with one synthetic node, dedupes edges, drops the internal mesh', () => {
  const pools = detectPools(SAMPLE_ORG);
  const collapsed = collapseOrg(SAMPLE_ORG, pools);
  const ids = collapsed.positions.map((p) => p.nodeId);
  assert.ok(ids.includes('pool:engineer'));
  assert.ok(!ids.includes('n-eng-a') && !ids.includes('n-eng-b') && !ids.includes('n-eng-c'));
  // 3 manages edges → 1; 2 oversees → 1; peers (internal) → dropped; stewards/consults/serves kept.
  const kinds = collapsed.relationships.map((r) => r.archetype).sort();
  assert.deepEqual(kinds, ['consults', 'manages', 'oversees', 'serves', 'stewards']);
  assert.ok(!collapsed.relationships.some((r) => r.archetype === 'peers'));
});

// ── drill: pool → member subgraph ───────────────────────────────────────────

test('poolSubgraph keeps the members, their edges, and the boundary neighbors', () => {
  const pool = detectPools(SAMPLE_ORG)[0];
  const sub = poolSubgraph(SAMPLE_ORG, pool);
  const ids = sub.positions.map((p) => p.nodeId).sort();
  // Members + everyone their edges reach (director, reviewer, commons) — NOT the external user.
  assert.deepEqual(ids, ['n-commons', 'n-director', 'n-eng-a', 'n-eng-b', 'n-eng-c', 'n-reviewer']);
  // The internal peer mesh IS visible inside the drill.
  assert.ok(sub.relationships.some((r) => r.archetype === 'peers'));
});

test('buildPoolScene renders the members as individual (unstacked) cards', () => {
  const scene = buildPoolScene(SAMPLE_ORG, 'pool:engineer');
  const a = scene.nodes.find((n) => n.id === 'n-eng-a')!;
  assert.equal(a.stackCount, undefined);
  assert.equal(a.title, 'Engineer A');
  assert.equal(scene.nodes.length, 6);
});

test('buildPoolScene with an unknown pool falls back to the parent view', () => {
  const scene = buildPoolScene(SAMPLE_ORG, 'pool:nope');
  assert.ok(scene.nodes.some((n) => n.id === 'pool:engineer'));
});

// ── parent scene ────────────────────────────────────────────────────────────

test('the parent scene shows the stacked pool card with count badge + drill id', () => {
  const scene = buildOrgScene(SAMPLE_ORG);
  const pool = scene.nodes.find((n) => n.id === 'pool:engineer')!;
  assert.equal(pool.stackCount, 3);
  assert.equal(pool.homogeneous, false);
  assert.equal(pool.drillId, 'pool:engineer');
  assert.match(pool.subtitle!, /× 3 · mixed wiring/);
  // Scaffold singletons never stack.
  assert.equal(scene.nodes.find((n) => n.id === 'n-director')?.stackCount, undefined);
});

test('hierarchy layering: manager row sits above the pool row, resource below it', () => {
  const scene = buildOrgScene(SAMPLE_ORG);
  const y = (id: string) => scene.nodes.find((n) => n.id === id)!.y + scene.nodes.find((n) => n.id === id)!.h / 2;
  assert.ok(y('n-director') < y('pool:engineer'), 'director above the engineer stack');
  assert.ok(y('pool:engineer') < y('n-commons'), 'stewarded resource below the stack');
});

test('the same input builds byte-identical scenes (deterministic layout)', () => {
  assert.deepEqual(buildOrgScene(SAMPLE_ORG), buildOrgScene(SAMPLE_ORG));
});

test('bidirectional archetypes are double-ended; styles map to dashes', () => {
  const scene = buildOrgScene(SAMPLE_ORG);
  const consults = scene.edges.find((e) => e.label === 'Consults')!;
  assert.ok(consults.arrowStart, 'consults draws a source arrowhead');
  assert.equal(consults.dash, '1 6'); // dotted
  const manages = scene.edges.find((e) => e.label === 'Manages')!;
  assert.equal(manages.arrowStart, undefined);
  assert.equal(manages.dash, ''); // solid
});
