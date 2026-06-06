// Variant B — Minimal / Paper
// Light, off-white, single-accent (warm clay). Type-driven. No chrome flourishes.
// Inspired by paper notebooks; the IDE is a quiet document, Claude is a gentle annotation.

function VariantPaper() {
  const W = 390, H = 844;

  const palette = {
    kw: '#9b3d2e', fn: '#5a4a2a', st: '#7a6a3a', nm: '#b67d3a',
    cm: '#a8a095', ty: '#5a6a4a', op: '#5a4a3a',
    pn: '#b8aea0', pa: '#7a4a2a', id: '#3a3530',
  };

  const navItem = (label, active) => (
    <button style={{
      flex: 1, height: 44, border: 'none', cursor: 'pointer',
      background: 'transparent', fontFamily: 'inherit',
      fontSize: 11.5, fontWeight: 500, letterSpacing: 0.6, textTransform: 'uppercase',
      color: active ? '#1a1612' : '#9b9288',
      borderTop: active ? '1.5px solid #c96442' : '1.5px solid transparent',
      paddingTop: 8,
    }}>{label}</button>
  );

  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden',
      background: '#f6f3ec',
      fontFamily: 'ui-serif, "Iowan Old Style", Georgia, serif',
      color: '#1a1612',
    }}>
      {/* status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 28px 8px', fontSize: 15, fontWeight: 600, zIndex: 30,
        fontFamily: '-apple-system, system-ui',
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="#1a1612"><rect x="0" y="6" width="3" height="5" rx="0.6"/><rect x="4.5" y="4" width="3" height="7" rx="0.6"/><rect x="9" y="2" width="3" height="9" rx="0.6"/><rect x="13" y="0" width="3" height="11" rx="0.6"/></svg>
          <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="#1a1612" strokeOpacity="0.7"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5"/><rect x="2" y="2" width="16" height="7" rx="1" fill="#1a1612"/></svg>
        </span>
      </div>

      {/* header — workspace name + breadcrumb. Spacious, generous type. */}
      <div style={{ position: 'absolute', top: 60, left: 24, right: 24 }}>
        <div style={{
          fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase',
          color: '#a8a095', fontFamily: '-apple-system, system-ui', fontWeight: 500,
        }}>Workspace · llm-cli</div>
        <div style={{
          fontSize: 26, fontWeight: 500, letterSpacing: -0.6, marginTop: 4,
          display: 'flex', alignItems: 'baseline', gap: 8,
        }}>
          client.py
          <span style={{ fontSize: 13, color: '#c96442', fontFamily: '-apple-system, system-ui', fontWeight: 500 }}>· modified</span>
        </div>
        <div style={{
          fontSize: 12, color: '#a8a095', marginTop: 2, fontFamily: '"iA Writer Mono", ui-monospace, monospace',
        }}>app/llm/client.py · 13 lines · python</div>
      </div>

      {/* editor */}
      <div style={{
        position: 'absolute', top: 154, left: 0, right: 0, bottom: 376,
        overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: '"iA Writer Mono", ui-monospace, Menlo, monospace',
          fontSize: 12.5, lineHeight: '20px', padding: '8px 16px 8px 0',
        }}>
          {SAMPLE_CODE.map((line) => (
            <div key={line.n} style={{ display: 'flex' }}>
              <div style={{
                width: 40, textAlign: 'right', paddingRight: 14,
                color: '#cdc4b6', fontVariantNumeric: 'tabular-nums', userSelect: 'none', flexShrink: 0,
              }}>{line.n}</div>
              <div style={{ whiteSpace: 'pre' }}>
                {renderTokens(line.tokens, palette)}
              </div>
            </div>
          ))}
        </div>
        {/* hairline below editor */}
        <div style={{ position: 'absolute', bottom: 0, left: 24, right: 24, height: 1, background: '#e6dfd0' }} />
      </div>

      {/* terminal — flat, paper-on-paper, monospace */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 100, top: 470,
        padding: '14px 24px', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase',
          color: '#a8a095', fontFamily: '-apple-system, system-ui', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: '#c96442' }} />
          Claude
          <span style={{ flex: 1, height: 1, background: '#e6dfd0', marginLeft: 4 }} />
          <span style={{ color: '#bcb3a4' }}>sonnet 4.5</span>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', fontFamily: '"iA Writer Mono", ui-monospace, monospace', fontSize: 12, lineHeight: 1.55 }}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ color: '#c96442' }}>›</span>
            <span style={{ color: '#1a1612', marginLeft: 8 }}>add streaming to the messages call</span>
          </div>
          <div style={{ color: '#a8a095', marginBottom: 6 }}>· read client.py</div>
          <div style={{ color: '#a8a095', marginBottom: 10 }}>
            · edit client.py <span style={{ color: '#5a7a4a' }}>+4</span> <span style={{ color: '#9b3d2e' }}>−1</span>
          </div>
          <div style={{
            color: '#3a3530', fontFamily: 'ui-serif, Georgia, serif',
            fontSize: 14.5, lineHeight: 1.5, letterSpacing: -0.1, textWrap: 'pretty',
          }}>
            Switched to <span style={{ fontFamily: '"iA Writer Mono", monospace', fontSize: 12.5, color: '#9b3d2e' }}>client.messages.stream()</span> and yielded text deltas. It's now an AsyncIterator — you'll need to await it.
          </div>
        </div>

        {/* input — single underline, no box */}
        <div style={{
          marginTop: 12, paddingBottom: 6, borderBottom: '1px solid #1a1612',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: '#c96442', fontFamily: '"iA Writer Mono", monospace', fontSize: 13 }}>›</span>
          <span style={{ color: '#a8a095', fontFamily: '"iA Writer Mono", monospace', fontSize: 13, flex: 1 }}>ask claude</span>
          <span style={{ width: 8, height: 16, background: '#1a1612' }} />
        </div>
      </div>

      {/* bottom nav — text labels with thin top divider */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 32, height: 56,
        borderTop: '1px solid #e6dfd0', background: '#f6f3ec',
        display: 'flex', alignItems: 'stretch', padding: '0 12px',
        fontFamily: '-apple-system, system-ui', zIndex: 30,
      }}>
        {navItem('Files', false)}
        {navItem('Find', false)}
        {navItem('Edit', true)}
        {navItem('Run', false)}
        {navItem('Git', false)}
      </div>

      {/* home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 3, background: '#1a1612', opacity: 0.3, zIndex: 40,
      }} />
    </div>
  );
}

window.VariantPaper = VariantPaper;
