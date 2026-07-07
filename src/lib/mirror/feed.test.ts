import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mirrorFramesFrom } from './feed';
import { applyMirrorFrame, EMPTY_MIRROR } from './state';
import type { StoreStateMap } from '../tunnel/storeState';

describe('mirrorFramesFrom', () => {
  it('derives one frame per domain, parsing the serialized projection', () => {
    const map: StoreStateMap = {
      glance: { rev: 3, json: JSON.stringify({ projects: [] }) },
      skills: { rev: 1, json: JSON.stringify({ skills: ['a'] }) },
    };
    const frames = mirrorFramesFrom(map).sort((a, b) => a.domain.localeCompare(b.domain));
    assert.deepEqual(frames, [
      { domain: 'glance', rev: 3, json: { projects: [] } },
      { domain: 'skills', rev: 1, json: { skills: ['a'] } },
    ]);
  });

  it('malformed JSON parses to undefined (page falls back, no crash)', () => {
    const frames = mirrorFramesFrom({ glance: { rev: 1, json: '{not json' } });
    assert.equal(frames.length, 1);
    assert.equal(frames[0].json, undefined);
  });

  it('is empty for an empty map', () => {
    assert.deepEqual(mirrorFramesFrom({}), []);
  });

  it('re-folding the same map is idempotent (rev-dedup → same state ref)', () => {
    const map: StoreStateMap = { skills: { rev: 2, json: JSON.stringify({ skills: ['a'] }) } };
    let state = EMPTY_MIRROR;
    for (const f of mirrorFramesFrom(map)) state = applyMirrorFrame(state, f);
    const afterFirst = state;
    for (const f of mirrorFramesFrom(map)) state = applyMirrorFrame(state, f);
    assert.equal(state, afterFirst); // same reference — no re-render
    assert.deepEqual(state.skills.json, { skills: ['a'] });
  });

  it('a newer rev for a domain supersedes the held one', () => {
    let state = EMPTY_MIRROR;
    for (const f of mirrorFramesFrom({ skills: { rev: 1, json: '"old"' } })) state = applyMirrorFrame(state, f);
    for (const f of mirrorFramesFrom({ skills: { rev: 2, json: '"new"' } })) state = applyMirrorFrame(state, f);
    assert.equal(state.skills.json, 'new');
    assert.equal(state.skills.rev, 2);
  });
});
