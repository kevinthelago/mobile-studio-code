// Guard for the data-driven UI (the design-system port). Two properties every BASELINE spec must
// hold, checked with only node-safe imports (no react-native): it VALIDATES against the vendored
// manifest contract, and every primitive it names is IMPLEMENTED natively — otherwise the KitRenderer
// would draw an "unimplemented primitive" marker in the running app. This is the payload-parity idea
// applied to UI specs: a spec that drifts from the contract or outruns the native registry fails here
// instead of rendering broken on a phone. Extend it by dropping a JSON into src/lib/kit/baseline/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneralNode } from './generalNode';
import { IMPLEMENTED_PRIMITIVES } from './implemented';
import { BASELINE_RECORDS } from './baseline';
import { selectLiveSpecs } from './liveSpecs';

/** Collect every `type` named anywhere in a node tree (children + node-valued props). */
function typesUsed(node: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(node)) { node.forEach((n) => typesUsed(n, into)); return into; }
  if (node && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    if (typeof n.type === 'string') into.add(n.type);
    if (n.children !== undefined) typesUsed(n.children, into);
    if (n.props && typeof n.props === 'object') {
      for (const v of Object.values(n.props as Record<string, unknown>)) {
        if (v && typeof v === 'object') typesUsed(v, into);
      }
    }
  }
  return into;
}

const impl = new Set<string>(IMPLEMENTED_PRIMITIVES);

test('the baseline is non-empty', () => {
  assert.ok(Object.keys(BASELINE_RECORDS).length > 0);
});

for (const [id, rec] of Object.entries(BASELINE_RECORDS)) {
  test(`${id}: validates against the vendored manifest contract`, () => {
    const errors = validateGeneralNode(rec.spec);
    assert.deepEqual(errors, [], `spec "${id}" has contract errors:\n${errors.join('\n')}`);
  });

  test(`${id}: every primitive it uses is implemented natively`, () => {
    const missing = [...typesUsed(rec.spec)].filter((tp) => !impl.has(tp));
    assert.deepEqual(missing, [], `spec "${id}" uses unimplemented primitives: ${missing.join(', ')}`);
  });
}

test('validateGeneralNode rejects an unknown primitive (the contract is live)', () => {
  const errors = validateGeneralNode({ type: 'NotAThing', children: 'x' });
  assert.ok(errors.some((e) => e.includes('unknown primitive')), errors.join('\n'));
});

// ── live-override selector (the desktop-pushed half) ──────────────────────────
test('selectLiveSpecs keeps only valid specs, keyed by component id', () => {
  const payload = {
    components: [
      { id: 'mobile.good', spec: { type: 'Text', props: { tone: 'accent' }, children: 'hi' } },
      { id: 'mobile.bad', spec: { type: 'NotAThing', children: 'x' } }, // fails validation → dropped
      { id: 'mobile.noSpec' }, // no spec → skipped
      { spec: { type: 'Text', children: 'x' } }, // no id → skipped
    ],
  };
  const live = selectLiveSpecs(payload);
  assert.deepEqual(Object.keys(live), ['mobile.good']);
  assert.equal(live['mobile.good'].type, 'Text');
});

test('selectLiveSpecs tolerates a summary-only payload (no spec field shipped yet)', () => {
  const payload = { kits: [], components: [{ id: 'mobile.skillsCard', name: 'SkillCard', role: 'composite' }], usage: [] };
  assert.deepEqual(selectLiveSpecs(payload), {});
});

test('selectLiveSpecs returns empty for a missing / malformed payload', () => {
  assert.deepEqual(selectLiveSpecs(undefined), {});
  assert.deepEqual(selectLiveSpecs({}), {});
  assert.deepEqual(selectLiveSpecs({ components: 'nope' }), {});
});
