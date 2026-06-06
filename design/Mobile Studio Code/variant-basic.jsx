// Variant E — Flat Basic
// Plain, light, no-frills. White surfaces, gray borders, blue accent.
// The "Material/Bootstrap baseline" — what you'd ship if design had no opinion.
// Useful as a control to compare the other variants against.

function VariantBasic() {
  const W = 390, H = 844;

  const palette = {
    kw: '#0550ae', fn: '#5d3eb2', st: '#0a7d4a', nm: '#b35b00',
    cm: '#6a737d', ty: '#0a7d4a', op: '#24292f',
    pn: '#6a737d', pa: '#953800', id: '#24292f',
  };

  const ACCENT = '#0969da';

  const navIcon = (svg, label, active) => (
    <button style={{
      flex: 1, height: 56, border: 'none', cursor: 'pointer',
      background: 'transparent', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 2,
      color: active ? ACCENT : '#57606a',
      fontFamily: 'inherit',
    }}>
      {svg}
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </button>
  );

  const I_files = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5a2 2 0 012-2h3l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></svg>);
  const I_edit = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 14l1-4 8-8 3 3-8 8-4 1z"/></svg>);
  const I_term = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l3 3-3 3M9 13h6"/></svg>);
  const I_search = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="5"/><path d="M13 13l3.5 3.5"/></svg>);
  const I_git = (<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="15" r="2"/><circle cx="14" cy="10" r="2"/><path d="M6 7v6M8 5h4a2 2 0 012 2v1"/></svg>);

  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden',
      background: '#fff',
      fontFamily: '-apple-system, "SF Pro Text", system-ui',
      color: '#24292f',
    }}>
      {/* status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 28px 8px', fontSize: 15, fontWeight: 600, zIndex: 30,
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="#000"><rect x="0" y="6" width="3" height="5" rx="0.6"/><rect x="4.5" y="4" width="3" height="7" rx="0.6"/><rect x="9" y="2" width="3" height="9" rx="0.6"/><rect x="13" y="0" width="3" height="11" rx="0.6"/></svg>
          <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="#000" strokeOpacity="0.7"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5"/><rect x="2" y="2" width="16" height="7" rx="1" fill="#000"/></svg>
        </span>
      </div>

      {/* App bar */}
      <div style={{
        position: 'absolute', top: 54, left: 0, right: 0, height: 52,
        background: '#fff', borderBottom: '1px solid #d0d7de',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
      }}>
        <button style={{
          width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#24292f',
        }}>
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2h16M2 7h16M2 12h16"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>client.py</div>
          <div style={{ fontSize: 11, color: '#57606a' }}>llm-cli / app / llm</div>
        </div>
        <button style={{
          padding: '6px 12px', borderRadius: 6, border: '1px solid #d0d7de',
          background: '#f6f8fa', fontSize: 13, fontWeight: 500, color: '#24292f', cursor: 'pointer',
        }}>Save</button>
      </div>

      {/* editor */}
      <div style={{
        position: 'absolute', top: 106, left: 0, right: 0, height: 360,
        overflow: 'hidden', borderBottom: '1px solid #d0d7de',
      }}>
        <div style={{
          fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
          fontSize: 12.5, lineHeight: '20px', padding: '8px 0',
        }}>
          {SAMPLE_CODE.map((line) => (
            <div key={line.n} style={{ display: 'flex' }}>
              <div style={{
                width: 40, textAlign: 'right', paddingRight: 12,
                color: '#8c959f', fontVariantNumeric: 'tabular-nums', userSelect: 'none', flexShrink: 0,
              }}>{line.n}</div>
              <div style={{ whiteSpace: 'pre' }}>
                {renderTokens(line.tokens, palette)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* claude tab header */}
      <div style={{
        position: 'absolute', top: 466, left: 0, right: 0, height: 36,
        background: '#f6f8fa', borderBottom: '1px solid #d0d7de',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8,
        fontSize: 13, fontWeight: 500,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: '#1a7f37' }} />
        Claude
        <span style={{ color: '#57606a', fontWeight: 400, fontSize: 12 }}>· sonnet 4.5</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#57606a', fontSize: 12 }}>connected</span>
      </div>

      {/* terminal */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 502, bottom: 84,
        padding: '12px 14px 8px', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflow: 'hidden', fontFamily: '"SF Mono", monospace', fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: ACCENT, fontWeight: 600 }}>You</span>
            <div style={{ color: '#24292f' }}>add streaming to the messages call</div>
          </div>
          <div style={{ color: '#57606a', fontSize: 11.5, marginBottom: 6 }}>
            ◦ Read client.py · ◦ Edited client.py (+4 −1)
          </div>
          <div style={{ color: '#24292f', fontFamily: '-apple-system, system-ui', fontSize: 13.5, lineHeight: 1.45, textWrap: 'pretty' }}>
            Switched to <code style={{ background: '#f6f8fa', border: '1px solid #d0d7de', padding: '1px 4px', borderRadius: 3, fontSize: 12 }}>client.messages.stream()</code> and yielded text deltas. The function is now an AsyncIterator — await it.
          </div>
        </div>
        <div style={{
          marginTop: 8, height: 38, borderRadius: 6,
          border: '1px solid #d0d7de', background: '#fff',
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 0 10px',
        }}>
          <span style={{ color: '#8c959f', fontSize: 13 }}>Ask Claude…</span>
          <div style={{ flex: 1 }} />
          <button style={{
            padding: '6px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 600,
          }}>Send</button>
        </div>
      </div>

      {/* bottom nav — material-style tab bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 76,
        background: '#fff', borderTop: '1px solid #d0d7de',
        display: 'flex', paddingBottom: 20, zIndex: 30,
      }}>
        {navIcon(I_files, 'Files', false)}
        {navIcon(I_search, 'Find', false)}
        {navIcon(I_edit, 'Edit', true)}
        {navIcon(I_term, 'Run', false)}
        {navIcon(I_git, 'Git', false)}
      </div>

      {/* home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 3, background: '#000', opacity: 0.3, zIndex: 40,
      }} />
    </div>
  );
}

window.VariantBasic = VariantBasic;
