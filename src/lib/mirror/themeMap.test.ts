import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isResolvedColor, mapKitTokens, parseKitThemes, parseRadius, type ThemeTokenTarget,
} from './themeMap';

const BASE: ThemeTokenTarget = {
  bg: '#0d0d0d',
  fg: '#e5e5e5',
  fgMuted: '#737373',
  fgDim: '#404040',
  accent: '#f59e0b',
  accent2: '#f59e0b',
  surface: '#171717',
  surfaceSolid: '#171717',
  borderColor: '#262626',
  radius: 6,
};

describe('isResolvedColor', () => {
  it('accepts hex and rgb/hsl literals', () => {
    assert.ok(isResolvedColor('#fff'));
    assert.ok(isResolvedColor('#0d0d0d'));
    assert.ok(isResolvedColor('#f59e0bcc'));
    assert.ok(isResolvedColor('rgb(10, 20, 30)'));
    assert.ok(isResolvedColor('rgba(10,20,30,0.5)'));
    assert.ok(isResolvedColor('hsl(200 50% 50%)'));
  });

  it('rejects var() references and color-mix expressions', () => {
    assert.equal(isResolvedColor('var(--bg-elev)'), false);
    assert.equal(isResolvedColor('color-mix(in oklch, var(--bg-panel), var(--accent) 7%)'), false);
    assert.equal(isResolvedColor('rgba(var(--x), 1)'), false);
    assert.equal(isResolvedColor(''), false);
    assert.equal(isResolvedColor('#gggggg'), false);
  });
});

describe('parseRadius', () => {
  it('parses px values and bare numbers', () => {
    assert.equal(parseRadius('14px'), 14);
    assert.equal(parseRadius('4'), 4);
    assert.equal(parseRadius(' 8.5px '), 8.5);
  });
  it('rejects non-numeric values', () => {
    assert.equal(parseRadius('var(--r)'), null);
    assert.equal(parseRadius('50%'), null);
    assert.equal(parseRadius(''), null);
  });
});

describe('mapKitTokens', () => {
  it('returns the base unchanged (same reference) with no vars', () => {
    assert.equal(mapKitTokens(BASE, undefined), BASE);
    assert.equal(mapKitTokens(BASE, null), BASE);
    assert.equal(mapKitTokens(BASE, {}), BASE);
  });

  it('returns the base when every var is unresolvable (desktop "warm" theme)', () => {
    const warm = {
      '--card-bg': 'color-mix(in oklch, var(--bg-panel), var(--accent) 7%)',
      '--card-border': 'color-mix(in oklch, var(--border-soft), var(--accent) 24%)',
    };
    assert.equal(mapKitTokens(BASE, warm), BASE);
  });

  it('maps resolved kit colors onto the native fields', () => {
    const mapped = mapKitTokens(BASE, {
      '--bg': '#101014',
      '--fg': '#fafafa',
      '--accent': '#7ee2c4',
      '--card-bg': '#1a1a22',
      '--border': '#33334a',
    });
    assert.notEqual(mapped, BASE);
    assert.equal(mapped.bg, '#101014');
    assert.equal(mapped.fg, '#fafafa');
    assert.equal(mapped.accent, '#7ee2c4');
    assert.equal(mapped.surface, '#1a1a22');
    assert.equal(mapped.borderColor, '#33334a');
    // Untouched fields fall back to the base look
    assert.equal(mapped.fgMuted, BASE.fgMuted);
    assert.equal(mapped.radius, BASE.radius);
  });

  it('keeps the accent pair and surface pair together', () => {
    const mapped = mapKitTokens(BASE, { '--accent': '#60a5fa', '--card-bg': '#222228' });
    assert.equal(mapped.accent2, '#60a5fa');
    assert.equal(mapped.surfaceSolid, '#222228');
  });

  it('takes the first resolvable alias and skips unresolvable ones', () => {
    const mapped = mapKitTokens(BASE, {
      '--card-bg': 'var(--bg-elev)', // unresolvable — skipped
      '--bg-panel': '#26262e',       // next alias wins
    });
    assert.equal(mapped.surface, '#26262e');
  });

  it('maps the kit radius', () => {
    const mapped = mapKitTokens(BASE, { '--card-radius': '14px' });
    assert.equal(mapped.radius, 14);
    // base untouched (pure)
    assert.equal(BASE.radius, 6);
  });
});

describe('parseKitThemes', () => {
  it('parses the desktop registry object shape', () => {
    const themes = parseKitThemes({
      version: 1,
      themes: [
        { id: 'default', label: 'Default', description: 'Base look.', vars: {} },
        { id: 'soft', label: 'Soft', vars: { '--card-radius': '14px', bad: 42 } },
      ],
    });
    assert.equal(themes.length, 2);
    assert.equal(themes[0].id, 'default');
    assert.equal(themes[1].vars['--card-radius'], '14px');
    // non-string var values are dropped
    assert.equal('bad' in themes[1].vars, false);
  });

  it('accepts a bare array and defaults label to id', () => {
    const themes = parseKitThemes([{ id: 'contrast' }]);
    assert.equal(themes.length, 1);
    assert.equal(themes[0].label, 'contrast');
    assert.deepEqual(themes[0].vars, {});
  });

  it('yields [] for malformed payloads', () => {
    assert.deepEqual(parseKitThemes(undefined), []);
    assert.deepEqual(parseKitThemes('nope'), []);
    assert.deepEqual(parseKitThemes({ themes: 'nope' }), []);
    assert.deepEqual(parseKitThemes([{ label: 'no id' }, null, 7]), []);
  });
});
