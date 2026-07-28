import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectComponents, selectThemes, groupByKit, groupThemes, hasComposition, compositionInput,
  compositionEdges, toGlanceInput, OTHER_THEME_GROUP, type CompositionNode,
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
    { id: 'default', label: 'Default', description: 'base', tech: 'react', vars: {}, builtin: true },
    { id: 'midnight', label: 'Midnight', description: 'dark', tech: 'react', vars: { '--bg': '#000', '--fg': '#fff' }, builtin: true },
    { id: 'paper', label: 'Paper', description: 'light surface', tech: 'svelte', base: 'light', vars: { '--bg': '#fff' } },
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

  // ── #241 C5: composes never crosses a kit boundary ────────────────────────

  it('draws NO edge between same-named components in different kits', () => {
    // The desktop resolves `composes` by name within ONE kit (model.ts:100-106 — "kits never
    // cross"). Mobile used a global name map, so this produced a phantom edge. Not hypothetical:
    // react-ui, algo-viz, matrix-viz and graph-viz are all seeded together.
    const m = selectComponents({
      kits: [{ id: 'kit-a', name: 'A' }, { id: 'kit-b', name: 'B' }],
      components: [
        { id: 'a1', name: 'Button', kitId: 'kit-a', composes: [] },
        { id: 'b1', name: 'Panel', kitId: 'kit-b', composes: ['Button'] }, // Button is in kit-a
      ],
    })!;
    assert.deepEqual(compositionInput(m).links, []);
    assert.equal(hasComposition(m), false);
  });

  it('still links same-named components WITHIN one kit', () => {
    const m = selectComponents({
      kits: [{ id: 'kit-a', name: 'A' }],
      components: [
        { id: 'a1', name: 'Button', kitId: 'kit-a', composes: [] },
        { id: 'a2', name: 'Panel', kitId: 'kit-a', composes: ['Button'] },
      ],
    })!;
    assert.deepEqual(compositionInput(m).links.map((l) => [l.from, l.to]), [['a2', 'a1']]);
  });

  it('resolves each kit independently when a name exists in both', () => {
    const m = selectComponents({
      kits: [{ id: 'kit-a', name: 'A' }, { id: 'kit-b', name: 'B' }],
      components: [
        { id: 'a1', name: 'Button', kitId: 'kit-a', composes: [] },
        { id: 'a2', name: 'Panel', kitId: 'kit-a', composes: ['Button'] },
        { id: 'b1', name: 'Button', kitId: 'kit-b', composes: [] },
        { id: 'b2', name: 'Panel', kitId: 'kit-b', composes: ['Button'] },
      ],
    })!;
    // Each Panel links to ITS OWN kit's Button — never the other's.
    assert.deepEqual(
      compositionInput(m).links.map((l) => [l.from, l.to]).sort(),
      [['a2', 'a1'], ['b2', 'b1']],
    );
  });

  it('hasComposition agrees with the edge pass (they share one implementation)', () => {
    const m = selectComponents(components())!;
    assert.equal(hasComposition(m), compositionInput(m).links.length > 0);
  });
});

describe('toGlanceInput / compositionEdges (the shared Studio selector)', () => {
  const node = (o: Partial<CompositionNode> & { id: string }): CompositionNode => ({
    name: o.id, scope: 's', role: 'primitive', composes: [], ...o,
  });

  it('matches by NAME for components', () => {
    const nodes = [node({ id: 'c1', name: 'Button' }), node({ id: 'c2', composes: ['Button'] })];
    assert.deepEqual(compositionEdges(nodes, 'name').map((l) => [l.from, l.to]), [['c2', 'c1']]);
  });

  it('matches by ID for algorithms — the same list resolves differently', () => {
    // Algorithms compose by id, components by name; a shared selector must not assume one.
    const nodes = [node({ id: 'c1', name: 'Button' }), node({ id: 'c2', composes: ['c1'] })];
    assert.deepEqual(compositionEdges(nodes, 'id').map((l) => [l.from, l.to]), [['c2', 'c1']]);
    assert.deepEqual(compositionEdges(nodes, 'id').length, 1);
    // ...and the name-matched reference finds nothing in id mode.
    assert.deepEqual(compositionEdges([node({ id: 'x', composes: ['Button'] })], 'id'), []);
  });

  it('resolves globally when every node shares one scope', () => {
    const nodes = [
      node({ id: 'n1', name: 'A', scope: 'all' }),
      node({ id: 'n2', name: 'B', scope: 'all', composes: ['A'] }),
    ];
    assert.equal(compositionEdges(nodes, 'name').length, 1);
  });

  it('drops a self-reference and an unresolvable one', () => {
    const nodes = [node({ id: 'n1', name: 'A', composes: ['A', 'Nope'] })];
    assert.deepEqual(compositionEdges(nodes, 'name'), []);
  });

  it('takes the FIRST match on a duplicate name, mirroring the desktop find()', () => {
    const nodes = [
      node({ id: 'first', name: 'Dup' }),
      node({ id: 'second', name: 'Dup' }),
      node({ id: 'ref', composes: ['Dup'] }),
    ];
    assert.deepEqual(compositionEdges(nodes, 'name').map((l) => l.to), ['first']);
  });

  it('maps roles through the caller palette and rests both glance axes', () => {
    const input = toGlanceInput([node({ id: 'n1', role: 'layout' })], { layout: 'infra' }, 'name');
    assert.equal(input.projects[0].role, 'infra');
    assert.equal(input.projects[0].health, 'idle');
    assert.equal(input.projects[0].activity, 'idle');
  });

  it('falls back to `service` for an unmapped role', () => {
    const input = toGlanceInput([node({ id: 'n1', role: 'mystery' })], {}, 'name');
    assert.equal(input.projects[0].role, 'service');
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

  it('reads base, defaulting to dark when absent (#2545 — "absent implies dark")', () => {
    const m = selectThemes(themes())!;
    assert.equal(m.themes.find((t) => t.id === 'paper')!.base, 'light');
    assert.equal(m.themes.find((t) => t.id === 'midnight')!.base, 'dark');
  });

  it('treats any non-light base as dark rather than guessing', () => {
    const m = selectThemes({
      active: 'x',
      themes: [
        { id: 'a', label: 'A', base: 'sepia' },   // a value from a newer desktop
        { id: 'b', label: 'B', base: 7 },          // corrupt
      ],
    })!;
    assert.equal(m.themes[0].base, 'dark');
    assert.equal(m.themes[1].base, 'dark');
  });

  it('reads tech, and leaves it empty when absent or blank', () => {
    const m = selectThemes({
      active: 'x',
      themes: [{ id: 'a', label: 'A', tech: 'react' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C', tech: '  ' }],
    })!;
    assert.equal(m.themes[0].tech, 'react');
    assert.equal(m.themes[1].tech, '');
    assert.equal(m.themes[2].tech, '');
  });
});

describe('groupThemes', () => {
  it('sections themes by tech, preserving wire order within a group', () => {
    const groups = groupThemes(selectThemes(themes())!);
    assert.deepEqual(groups.map((g) => g.tech), ['react', 'svelte']);
    assert.deepEqual(groups[0].themes.map((t) => t.id), ['default', 'midnight']);
    assert.deepEqual(groups[1].themes.map((t) => t.id), ['paper']);
    assert.equal(groups[0].label, 'react', 'the label is the raw slug — the view uppercases it');
  });

  it('orders groups by first appearance, not alphabetically', () => {
    const m = selectThemes({
      active: 'x',
      themes: [
        { id: 'a', label: 'A', tech: 'zeta' },
        { id: 'b', label: 'B', tech: 'alpha' },
        { id: 'c', label: 'C', tech: 'zeta' },
      ],
    })!;
    assert.deepEqual(groupThemes(m).map((g) => g.tech), ['zeta', 'alpha']);
    assert.deepEqual(groupThemes(m)[0].themes.map((t) => t.id), ['a', 'c']);
  });

  it('forces the tech-less bucket last however it arrives', () => {
    const m = selectThemes({
      active: 'x',
      themes: [
        { id: 'a', label: 'A' },                  // no tech — arrives FIRST
        { id: 'b', label: 'B', tech: 'react' },
      ],
    })!;
    const groups = groupThemes(m);
    assert.deepEqual(groups.map((g) => g.tech), ['react', OTHER_THEME_GROUP]);
  });

  it('keeps the other bucket as the only group when nothing has a tech', () => {
    const m = selectThemes({ active: 'x', themes: [{ id: 'a', label: 'A' }] })!;
    assert.deepEqual(groupThemes(m).map((g) => g.tech), [OTHER_THEME_GROUP]);
  });

  it('returns [] for an empty theme list', () => {
    assert.deepEqual(groupThemes({ themes: [], active: '' }), []);
  });
});
