// Variant A — iOS Liquid Glass
// Translucent floating chrome, the editor + terminal scrolls beneath it.
// Background subtly tinted to give the glass something to refract.

function VariantGlass() {
  const W = 390, H = 844;

  // Liquid glass palette — vivid but desaturated, set against soft tinted bg.
  const palette = {
    kw: '#c084fc', fn: '#67d3ff', st: '#f0a37e', nm: '#ffd479',
    cm: 'rgba(160,170,200,0.55)', ty: '#7ee2c4', op: '#cdd2e0',
    pn: 'rgba(220,225,240,0.5)', pa: '#ffaecf', id: '#e6e9f2',
  };

  // Glass surface helper — a tinted panel with backdrop-blur + inner shine.
  const glass = (extra = {}) => ({
    background: 'rgba(28,32,46,0.55)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: '0.5px solid rgba(255,255,255,0.10)',
    boxShadow:
      'inset 0 0.5px 0 rgba(255,255,255,0.18), 0 6px 24px rgba(0,0,0,0.25)',
    ...extra,
  });

  // Tiny ambient orbs behind everything — gives backdrop-filter color to grab.
  const orb = (left, top, size, color) => (
    <div style={{
      position: 'absolute', left, top, width: size, height: size,
      borderRadius: '50%', background: color, filter: 'blur(60px)',
      opacity: 0.55, pointerEvents: 'none',
    }} />
  );

  const navIcon = (svg, active) => (
    <button style={{
      width: 44, height: 44, borderRadius: 22, border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.65)',
      cursor: 'pointer', flexShrink: 0,
    }}>{svg}</button>
  );

  const I_files = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5a2 2 0 012-2h3l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></svg>);
  const I_edit = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 14l1-4 8-8 3 3-8 8-4 1z"/></svg>);
  const I_term = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l3 3-3 3M9 13h6"/></svg>);
  const I_search = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="5"/><path d="M13 13l3.5 3.5"/></svg>);
  const I_git = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="15" r="2"/><circle cx="14" cy="10" r="2"/><path d="M6 7v6M8 5h4a2 2 0 012 2v1"/></svg>);

  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden',
      background: '#0b0d14',
      fontFamily: '-apple-system, "SF Pro Text", system-ui',
      color: '#e6e9f2',
    }}>
      {/* Ambient color so the glass has something to refract */}
      {orb(-80, 80, 280, '#5b3fc8')}
      {orb(220, 240, 240, '#1f6dd9')}
      {orb(-40, 560, 260, '#0f5b6b')}
      {orb(180, 720, 220, '#7a2a6a')}

      {/* Status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 28px 8px', fontSize: 15, fontWeight: 600, zIndex: 30,
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="#fff"><rect x="0" y="6" width="3" height="5" rx="0.6"/><rect x="4.5" y="4" width="3" height="7" rx="0.6"/><rect x="9" y="2" width="3" height="9" rx="0.6"/><rect x="13" y="0" width="3" height="11" rx="0.6"/></svg>
          <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="#fff" strokeOpacity="0.7"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5"/><rect x="2" y="2" width="16" height="7" rx="1" fill="#fff"/></svg>
        </span>
      </div>

      {/* TOP CHROME — file path pill, hovers above content */}
      <div style={{
        position: 'absolute', top: 60, left: 16, right: 16, height: 48,
        ...glass({ borderRadius: 24 }),
        display: 'flex', alignItems: 'center', padding: '0 8px 0 16px', gap: 10, zIndex: 25,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6"><path d="M2 3h3l1 1h6v7H2z"/></svg>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>app</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>llm</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>client.py</span>
          <span style={{ marginLeft: 8, width: 6, height: 6, borderRadius: 3, background: '#ffaecf' }} />
        </div>
        <button style={{
          width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.10)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 7l3 3 5-7"/></svg>
        </button>
      </div>

      {/* EDITOR */}
      <div style={{
        position: 'absolute', top: 116, left: 0, right: 0, bottom: 380,
        overflow: 'hidden', padding: '8px 0',
      }}>
        <div style={{
          fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
          fontSize: 12.5, lineHeight: '20px',
        }}>
          {SAMPLE_CODE.map((line) => (
            <div key={line.n} style={{ display: 'flex', padding: '0 4px 0 0' }}>
              <div style={{
                width: 36, textAlign: 'right', paddingRight: 12,
                color: 'rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums',
                userSelect: 'none', flexShrink: 0,
              }}>{line.n}</div>
              <div style={{ whiteSpace: 'pre', color: palette.id }}>
                {renderTokens(line.tokens, palette)}
              </div>
            </div>
          ))}
        </div>
        {/* gutter glyph for the dirty line */}
        <div style={{
          position: 'absolute', left: 30, top: 8 + 19 * 20 - 1, width: 4, height: 22,
          background: '#ffaecf', borderRadius: 2,
        }} />
      </div>

      {/* DIVIDER label — “Claude” chip */}
      <div style={{
        position: 'absolute', top: 460, left: 0, right: 0, display: 'flex',
        justifyContent: 'center', zIndex: 24,
      }}>
        <div style={{
          ...glass({ borderRadius: 14 }),
          padding: '6px 12px 6px 10px', display: 'flex', alignItems: 'center', gap: 7,
          fontSize: 12, fontWeight: 600, letterSpacing: 0.2, color: 'rgba(255,255,255,0.85)',
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: 7,
            background: 'linear-gradient(135deg, #d97757, #ffaecf)',
          }} />
          Claude · sonnet 4.5
          <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.18)', margin: '0 2px' }} />
          <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>2 tools</span>
        </div>
      </div>

      {/* TERMINAL — glass panel with claude transcript */}
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 88, top: 484,
        ...glass({ borderRadius: 28 }),
        padding: '20px 18px 12px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', zIndex: 22,
      }}>
        <div style={{ flex: 1, overflow: 'hidden', fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontSize: 12, lineHeight: 1.55 }}>
          {/* prompt */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>›</span>
            <span style={{ color: '#fff' }}>add streaming to the messages call</span>
          </div>
          {/* thinking */}
          <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: '#7ee2c4' }} />
            reading client.py · 28 lines
          </div>
          {/* tool */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 10px',
            border: '0.5px solid rgba(255,255,255,0.08)', marginBottom: 10,
          }}>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>edit · client.py</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
              <span style={{ color: '#7ee2c4' }}>+4</span>
              <span style={{ color: '#ffaecf' }}>−1</span>
            </div>
          </div>
          {/* reply */}
          <div style={{
            color: 'rgba(255,255,255,0.85)', fontFamily: '-apple-system, system-ui',
            fontSize: 13.5, lineHeight: 1.45, letterSpacing: -0.1, textWrap: 'pretty',
          }}>
            Switched to <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 4, fontSize: 12, fontFamily: '"SF Mono", monospace' }}>client.messages.stream()</code> and yielded text deltas. It's now an AsyncIterator — you'll need to await it.
          </div>
        </div>
        {/* input pill inside the terminal panel */}
        <div style={{
          marginTop: 10,
          height: 44, borderRadius: 22, padding: '0 6px 0 16px',
          background: 'rgba(0,0,0,0.25)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Ask Claude…</span>
          <div style={{ flex: 1 }} />
          <button style={{
            width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #d97757, #c084fc)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 11V3M3 7l4-4 4 4"/></svg>
          </button>
        </div>
      </div>

      {/* BOTTOM NAV — floating glass pill */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 30, height: 60,
        ...glass({ borderRadius: 32 }),
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '0 8px', zIndex: 30,
      }}>
        {navIcon(I_files, false)}
        {navIcon(I_search, false)}
        {navIcon(I_edit, true)}
        {navIcon(I_term, false)}
        {navIcon(I_git, false)}
      </div>

      {/* home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.55)', zIndex: 40,
      }} />
    </div>
  );
}

window.VariantGlass = VariantGlass;
