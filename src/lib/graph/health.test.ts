import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rollUpHealth, HEALTH_RANK } from './health';
import type { GlanceHealth } from './glanceAdapter';

/** `from` depends on `to`. */
const dep = (from: string, to: string) => ({ from, to });

const nodes = (spec: Record<string, GlanceHealth>) =>
  Object.entries(spec).map(([id, health]) => ({ id, health }));

describe('rollUpHealth', () => {
  it('leaves an isolated node on its own health', () => {
    const out = rollUpHealth(nodes({ a: 'healthy', b: 'error' }), []);
    assert.deepEqual(out.get('a'), { health: 'healthy', inherited: false });
    assert.deepEqual(out.get('b'), { health: 'error', inherited: false });
  });

  it('escalates a dependency error onto its dependent, marked inherited', () => {
    // web depends on api; api is broken.
    const out = rollUpHealth(nodes({ web: 'healthy', api: 'error' }), [dep('web', 'api')]);
    assert.deepEqual(out.get('web'), { health: 'error', inherited: true });
    assert.deepEqual(out.get('api'), { health: 'error', inherited: false });
  });

  it('escalates transitively through the chain', () => {
    const out = rollUpHealth(
      nodes({ web: 'healthy', api: 'healthy', db: 'error' }),
      [dep('web', 'api'), dep('api', 'db')],
    );
    assert.equal(out.get('web')!.health, 'error');
    assert.equal(out.get('web')!.inherited, true);
  });

  it('takes the WORST of several dependencies', () => {
    const out = rollUpHealth(
      nodes({ web: 'idle', a: 'warning', b: 'error' }),
      [dep('web', 'a'), dep('web', 'b')],
    );
    assert.equal(out.get('web')!.health, 'error');
  });

  it('does not escalate below the node\'s own health', () => {
    const out = rollUpHealth(nodes({ web: 'error', api: 'warning' }), [dep('web', 'api')]);
    assert.deepEqual(out.get('web'), { health: 'error', inherited: false });
  });

  it('never propagates idle or healthy (rank 0)', () => {
    const out = rollUpHealth(nodes({ web: 'idle', api: 'healthy' }), [dep('web', 'api')]);
    assert.deepEqual(out.get('web'), { health: 'idle', inherited: false });
  });

  it('treats off as absorbing for the node itself', () => {
    // web is deactivated and depends on a broken api: the deliberate mute wins.
    const out = rollUpHealth(nodes({ web: 'off', api: 'error' }), [dep('web', 'api')]);
    assert.deepEqual(out.get('web'), { health: 'off', inherited: false });
  });

  it('off does not PROPAGATE — a node depending on an off node is unaffected by it', () => {
    const out = rollUpHealth(nodes({ a: 'healthy', off: 'off' }), [dep('a', 'off')]);
    assert.deepEqual(out.get('a'), { health: 'healthy', inherited: false });
  });

  it('off does not SHIELD: the walk continues through it to its own dependencies', () => {
    // This is the desktop's behaviour verbatim (`worstFrom` short-circuits only at `start`).
    // Deactivating `web` mutes web's own dot, but `other` still depends — transitively — on the
    // broken api, so it still lights up. Asserted explicitly because it is the surprising half
    // of the rule, and a "tidier" local fix here would silently disagree with the desktop.
    const out = rollUpHealth(
      nodes({ other: 'healthy', web: 'off', api: 'error' }),
      [dep('other', 'web'), dep('web', 'api')],
    );
    assert.deepEqual(out.get('other'), { health: 'error', inherited: true });
  });

  it('terminates on a mutual-dependency cycle', () => {
    const out = rollUpHealth(
      nodes({ analytics: 'error', reporting: 'idle' }),
      [dep('analytics', 'reporting'), dep('reporting', 'analytics')],
    );
    assert.equal(out.get('reporting')!.health, 'error');
    assert.equal(out.get('reporting')!.inherited, true);
    assert.equal(out.get('analytics')!.inherited, false);
  });

  it('ignores edges whose endpoints are not in the node set', () => {
    const out = rollUpHealth(nodes({ a: 'healthy' }), [dep('a', 'ghost'), dep('ghost', 'a')]);
    assert.deepEqual(out.get('a'), { health: 'healthy', inherited: false });
  });

  it('ranks only warning and error as propagating', () => {
    assert.equal(HEALTH_RANK.idle, 0);
    assert.equal(HEALTH_RANK.healthy, 0);
    assert.equal(HEALTH_RANK.off, 0);
    assert.ok(HEALTH_RANK.warning > 0);
    assert.ok(HEALTH_RANK.error > HEALTH_RANK.warning);
  });
});
