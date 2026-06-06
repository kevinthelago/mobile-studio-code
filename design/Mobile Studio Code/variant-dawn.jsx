// Variant D — Soft Dark / Dawn
// Warm dark background, single accent (clay), gentle inset cards.
// Modern but not glassy — feels like a dedicated tool, not iOS.

function VariantDawn() {
  const W = 390, H = 844;

  const palette = {
    kw: '#e0a3ff', fn: '#9bd9ff', st: '#ffb088', nm: '#ffd479',
    cm: '#5a5550', ty: '#a8e6c4', op: '#a8a095',
    pn: '#6a655f', pa: '#ffaecf', id: '#e8e2d8',
  };

  const ACCENT = '#d97757';

  const navIcon = (svg, active) => (
    <button style={{
      width: 52, height: 44, borderRadius: 14, border: 'none', cursor: 'pointer',
      background: active ? 'rgba(217,119,87,0.14)' : 'transparent',
      color: active ? ACCENT : '#7a736b',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{svg}</button>
  );

  const I_files = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 5a2 2 0 012-2h3l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></svg>);
  const I_edit = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 14l1-4 8-8 3 3-8 8-4 1z"/></svg>);
  const I_term = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l3 3-3 3M9 13h6"/></svg>);
  const I_search = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="9" cy="9" r="5"/><path d="M13 13l3.5 3.5"/></svg>);
  const I_git = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="15" r="2"/><circle cx="14" cy="10" r="2"/><path d="M6 7v6M8 5h4a2 2 0 012 2v1"/></svg>);

  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden',
      background: '#1a1612',
      fontFamily: '-apple-system, "SF Pro Text", system-ui',
      color: '#e8e2d8',
    }}>
      {/* status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 28px 8px', fontSize: 15, fontWeight: 600, zIndex: 30,
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="#e8e2d8"><rect x="0" y="6" width="3" height="5" rx="0.6"/><rect x="4.5" y="4" width="3" height="7" rx="0.6"/><rect x="9" y="2" width="3" height="9" rx="0.6"/><rect x="13" y="0" width="3" height="11" rx="0.6"/></svg>
          <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="#e8e2d8" strokeOpacity="0.7"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5"/><rect x="2" y="2" width="16" height="7" rx="1" fill="#e8e2d8"/></svg>
        </span>
      </div>

      {/* header — workspace + file tabs */}
      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0, padding: '4px 16px 0',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'linear-gradient(135deg,#d97757,#7a3a2a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>L</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: -0.2 }}>llm-cli</div>
            <div style={{ fontSize: 11, color: '#7a736b' }}>main · clean</div>
          </div>
          <button style={{
            width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', color: '#a8a095',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="1"/><circle cx="2" cy="7" r="1"/><circle cx="12" cy="7" r="1"/></svg>
          </button>
        </div>
        {/* file tabs */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, overflow: 'hidden' }}>
          <div style={{
            padding: '6px 10px', borderRadius: 9, fontSize: 12, fontWeight: 500,
            background: '#251f1a', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 6,
            border: '1px solid #3a322b',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: ACCENT }} />
            client.py
          </div>
          <div style={{ padding: '6px 10px', borderRadius: 9, fontSize: 12, color: '#7a736b' }}>cli.py</div>
          <div style={{ padding: '6px 10px', borderRadius: 9, fontSize: 12, color: '#7a736b' }}>config.toml</div>
        </div>
      </div>

      {/* editor card */}
      <div style={{
        position: 'absolute', top: 158, left: 12, right: 12, height: 308,
        background: '#13100d', borderRadius: 18,
        border: '1px solid #2a241f',
        overflow: 'hidden', padding: '10px 0',
      }}>
        <div style={{
          fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
          fontSize: 12, lineHeight: '20px',
        }}>
          {SAMPLE_CODE.map((line, i) => (
            <div key={line.n} style={{ display: 'flex' }}>
              <div style={{
                width: 36, textAlign: 'right', paddingRight: 10,
                color: '#3f3833', fontVariantNumeric: 'tabular-nums', userSelect: 'none', flexShrink: 0,
              }}>{line.n}</div>
              <div style={{ whiteSpace: 'pre', color: palette.id }}>
                {renderTokens(line.tokens, palette)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* claude panel header */}
      <div style={{
        position: 'absolute', top: 478, left: 24, right: 24,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11.5, letterSpacing: 0.4, textTransform: 'uppercase',
        color: '#7a736b', fontWeight: 600,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: ACCENT }} />
        Claude
        <span style={{ flex: 1, height: 1, background: '#2a241f' }} />
        <span style={{ color: '#5a5550', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>sonnet 4.5</span>
      </div>

      {/* terminal card */}
      <div style={{
        position: 'absolute', left: 12, right: 12, top: 504, bottom: 96,
        background: '#13100d', borderRadius: 18,
        border: '1px solid #2a241f',
        padding: '14px 16px 8px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflow: 'hidden', fontFamily: '"JetBrains Mono", monospace', fontSize: 12, lineHeight: 1.55 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <span style={{ color: ACCENT }}>›</span>
            <span style={{ color: '#fff' }}>add streaming to the messages call</span>
          </div>
          <div style={{
            padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
            display: 'inline-flex', gap: 10, alignItems: 'center', marginBottom: 8,
            fontSize: 11,
          }}>
            <span style={{ color: '#7a736b' }}>edit</span>
            <span style={{ color: '#a8a095' }}>client.py</span>
            <span style={{ color: '#a8e6c4' }}>+4</span>
            <span style={{ color: '#ffaecf' }}>−1</span>
          </div>
          <div style={{
            color: '#d8d2c8', fontFamily: '-apple-system, system-ui',
            fontSize: 13.5, lineHeight: 1.45, textWrap: 'pretty',
          }}>
            Switched to <code style={{ background: '#2a241f', padding: '1px 5px', borderRadius: 4, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: ACCENT }}>client.messages.stream()</code> and yielded text deltas. AsyncIterator now — await it.
          </div>
        </div>
        <div style={{
          marginTop: 10, height: 40, borderRadius: 12,
          background: '#0a0805', border: '1px solid #2a241f',
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 0 12px',
        }}>
          <span style={{ color: '#5a5550', fontSize: 13 }}>Ask Claude…</span>
          <div style={{ flex: 1 }} />
          <button style={{
            width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: ACCENT, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.5 10.5V2.5M3 6l3.5-3.5L10 6"/></svg>
          </button>
        </div>
      </div>

      {/* bottom nav — solid bar with subtle inset highlight */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 84,
        background: '#13100d', borderTop: '1px solid #2a241f',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '8px 16px 0', zIndex: 30,
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

window.VariantDawn = VariantDawn;
