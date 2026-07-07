import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_MIRROR, applyMirrorFrame, type MirrorFrame } from './state';

const frame = (domain: string, rev: number, json: unknown = {}): MirrorFrame => ({
  domain, rev, json,
});

describe('applyMirrorFrame', () => {
  it('stores a first frame for a domain', () => {
    const s = applyMirrorFrame(EMPTY_MIRROR, frame('skills', 1, { items: [] }));
    assert.deepEqual(s.skills, { rev: 1, json: { items: [] } });
  });

  it('keeps domains independent', () => {
    let s = applyMirrorFrame(EMPTY_MIRROR, frame('skills', 3, 'a'));
    s = applyMirrorFrame(s, frame('themes', 1, 'b'));
    assert.equal(s.skills?.json, 'a');
    assert.equal(s.themes?.json, 'b');
    assert.equal(s.skills?.rev, 3);
    assert.equal(s.themes?.rev, 1);
  });

  it('replaces the payload on a higher rev', () => {
    let s = applyMirrorFrame(EMPTY_MIRROR, frame('glance', 1, 'old'));
    s = applyMirrorFrame(s, frame('glance', 2, 'new'));
    assert.deepEqual(s.glance, { rev: 2, json: 'new' });
  });

  it('ignores a frame with rev equal to the current rev (same reference back)', () => {
    const s1 = applyMirrorFrame(EMPTY_MIRROR, frame('glance', 5, 'kept'));
    const s2 = applyMirrorFrame(s1, frame('glance', 5, 'dropped'));
    assert.equal(s2, s1);
    assert.equal(s2.glance?.json, 'kept');
  });

  it('ignores a frame with rev lower than the current rev (replay protection)', () => {
    const s1 = applyMirrorFrame(EMPTY_MIRROR, frame('glance', 5, 'kept'));
    const s2 = applyMirrorFrame(s1, frame('glance', 4, 'stale'));
    assert.equal(s2, s1);
    assert.equal(s2.glance?.json, 'kept');
  });

  it('a lower rev never clears an existing payload', () => {
    const s1 = applyMirrorFrame(EMPTY_MIRROR, frame('automations', 10, [1, 2]));
    const s2 = applyMirrorFrame(s1, frame('automations', 2, null));
    assert.deepEqual(s2.automations, { rev: 10, json: [1, 2] });
  });

  it('drops malformed frames without touching state', () => {
    const s1 = applyMirrorFrame(EMPTY_MIRROR, frame('ok', 1));
    // Empty domain
    assert.equal(applyMirrorFrame(s1, frame('', 2)), s1);
    // Non-finite rev
    assert.equal(applyMirrorFrame(s1, frame('ok', Number.NaN)), s1);
    assert.equal(applyMirrorFrame(s1, frame('ok', Number.POSITIVE_INFINITY)), s1);
    // Non-string domain / missing fields (wire garbage)
    assert.equal(
      applyMirrorFrame(s1, { domain: 7, rev: 2, json: {} } as unknown as MirrorFrame),
      s1,
    );
    assert.equal(applyMirrorFrame(s1, null as unknown as MirrorFrame), s1);
  });

  it('does not mutate the previous state object', () => {
    const s1 = applyMirrorFrame(EMPTY_MIRROR, frame('a', 1, 'v1'));
    const s2 = applyMirrorFrame(s1, frame('a', 2, 'v2'));
    assert.equal(s1.a?.json, 'v1');
    assert.equal(s2.a?.json, 'v2');
    assert.deepEqual(EMPTY_MIRROR, {});
  });

  it('accepts rev 0 as a first frame and negative-to-positive progressions', () => {
    const s1 = applyMirrorFrame(EMPTY_MIRROR, frame('d', 0, 'zero'));
    assert.equal(s1.d?.rev, 0);
    const s2 = applyMirrorFrame(s1, frame('d', 1, 'one'));
    assert.equal(s2.d?.json, 'one');
  });
});
