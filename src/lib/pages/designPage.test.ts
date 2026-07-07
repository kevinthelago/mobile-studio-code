import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectComponents, selectThemes, groupByKit, hasComposition, compositionInput,
} from './designPage';
import { buildGlanceScene } from '../graph';

const components = () => ({
  kits: [{ id: 'react', name: 'React kit', tech: 'react', style: 'studio', stack: 'React · TS', dot: '#61dafb', builtin: true }],
  components: [
    { id: 'c1', name: 'Button', kitId: 'react', role: 'primitive', version: '1.0', used: 12, tags: ['control'], variants: ['solid'], composes: [] },
    { id: 'c2', name: 'Toolbar', kitId: 'react', role: 'composite', version: '1.0', used: 3, tags: [], variants: [], composes: ['Button'] },
    { id: 'c3', name: 'Orphan', kitId: 'ghost', role: 'layout', version: '1', used: 0, tags: [], variants: [], composes: [] },
  ],
  usage: [{ projectKey: 'p1', kitId: 'react', live: true, auto: false }],
});

const themes = () => ({
  active: 'midnight',
  themes: [
    { id: 'default', label: 'Default', description: 'base', vars: {}, builtin: true },
    { id: 'midnight', label: 'Midnight', description: 'dark', vars: { '--bg': '#000', '--fg': '#fff' }, builtin: true },
  ],
});

describe('selectComponents', () => {
  it('parses kits, components, and usage', () => {
    const m = selectComponents(components())!;
    assert.equal(m.kits.length, 1);
    assert.equal(m.components.length, 3);
    assert.equal(m.usage[0].live, true);
  });

  it('returns undefined for missing / malformed payloads', () => {
    assert.equal(selectComponents(undefined), undefined);
    assert.equal(selectComponents({}), undefined);
  });
});

describe('groupByKit', () => {
  it('groups components under their kit and buckets orphans into "other"', () => {
    const groups = groupByKit(selectComponents(components())!);
    const react = groups.find((g) => g.kit.id === 'react')!;
    assert.equal(react.components.length, 2);
    assert.equal(react.consumers.length, 1);
    const other = groups.find((g) => g.kit.id === '__other__')!;
    assert.equal(other.components[0].name, 'Orphan');
  });
});

describe('composition graph', () => {
  it('detects composition edges', () => {
    assert.equal(hasComposition(selectComponents(components())!), true);
    assert.equal(hasComposition(selectComponents({ components: [{ id: 'x', name: 'X', composes: [] }] })!), false);
  });

  it('builds an input the glance adapter can lay out (edge component→composed)', () => {
    const input = compositionInput(selectComponents(components())!);
    assert.equal(input.links.length, 1);
    assert.equal(input.links[0].from, 'c2'); // Toolbar composes Button
    assert.equal(input.links[0].to, 'c1');
    const scene = buildGlanceScene(input);
    assert.equal(scene.nodes.length, 3);
  });
});

describe('selectThemes', () => {
  it('parses and flags the active theme + var counts', () => {
    const m = selectThemes(themes())!;
    assert.equal(m.active, 'midnight');
    assert.equal(m.themes.find((t) => t.id === 'midnight')!.active, true);
    assert.equal(m.themes.find((t) => t.id === 'midnight')!.varCount, 2);
    assert.equal(m.themes.find((t) => t.id === 'default')!.active, false);
  });

  it('returns undefined for missing / malformed payloads', () => {
    assert.equal(selectThemes(undefined), undefined);
    assert.equal(selectThemes({}), undefined);
  });
});
