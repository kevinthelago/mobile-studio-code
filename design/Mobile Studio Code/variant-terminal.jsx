// Variant C — Terminal Native
// Pure dark, monospace everywhere, sharp corners, ASCII-flavored chrome.
// The whole IDE *feels* like one terminal — editor is just a numbered buffer,
// nav is a status line. Single phosphor accent.

function VariantTerminal() {
  const W = 390, H = 844;

  const palette = {
    kw: '#7dd3fc', fn: '#a3e635', st: '#fbbf77', nm: '#fcd34d',
    cm: '#525866', ty: '#86efac', op: '#9ca3af',
    pn: '#6b7280', pa: '#f0a3c0', id: '#d4d4d8',
  };

  const ACCENT = '#a3e635';

  const navItem = (label, num, active) => (
    <div style={{
      flex: 1, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      borderRight: '1px solid #1f2430',
      background: active ? '#13161e' : 'transparent',
      color: active ? ACCENT : '#6b7280',
      fontSize: 11, letterSpacing: 0.4,
    }}>
      <span style={{ color: active ? ACCENT : '#3f4651', fontWeight: 700 }}>{num}</span>
      {label}
    </div>
  );

  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden',
      background: '#08090d',
      fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
      color: '#d4d4d8',
    }}>
      {/* status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 28px 8px', fontSize: 15, fontWeight: 600, zIndex: 30,
        fontFamily: '-apple-system, system-ui', color: '#d4d4d8',
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="#d4d4d8"><rect x="0" y="6" width="3" height="5" rx="0.6"/><rect x="4.5" y="4" width="3" height="7" rx="0.6"/><rect x="9" y="2" width="3" height="9" rx="0.6"/><rect x="13" y="0" width="3" height="11" rx="0.6"/></svg>
          <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="#d4d4d8" strokeOpacity="0.7"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5"/><rect x="2" y="2" width="16" height="7" rx="1" fill="#d4d4d8"/></svg>
        </span>
      </div>

      {/* tab/breadcrumb bar — looks like tmux/vim status */}
      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0, height: 32,
        background: '#0d0f15', borderBottom: '1px solid #1f2430',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12,
        fontSize: 11.5,
      }}>
        <span style={{ color: ACCENT }}>●</span>
        <span style={{ color: '#525866' }}>~/llm-cli/app/llm/</span>
        <span style={{ color: '#fff' }}>client.py</span>
        <span style={{ color: '#f0a3c0' }}>[+]</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#525866' }}>py · utf-8 · LF</span>
      </div>

      {/* editor buffer */}
      <div style={{
        position: 'absolute', top: 88, left: 0, right: 0, bottom: 380,
        overflow: 'hidden',
      }}>
        <div style={{
          fontSize: 12.5, lineHeight: '20px', padding: '8px 0',
        }}>
          {SAMPLE_CODE.map((line, i) => {
            const isCurrent = i === 4; // highlight one line
            return (
              <div key={line.n} style={{
                display: 'flex',
                background: isCurrent ? '#0f1218' : 'transparent',
                borderLeft: isCurrent ? `2px solid ${ACCENT}` : '2px solid transparent',
              }}>
                <div style={{
                  width: 40, textAlign: 'right', paddingRight: 12,
                  color: isCurrent ? ACCENT : '#3f4651',
                  fontVariantNumeric: 'tabular-nums', userSelect: 'none', flexShrink: 0,
                }}>{line.n}</div>
                <div style={{ whiteSpace: 'pre', color: palette.id }}>
                  {renderTokens(line.tokens, palette)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* status line dividing editor from terminal — vim style */}
      <div style={{
        position: 'absolute', top: 460, left: 0, right: 0, height: 22,
        background: ACCENT, color: '#08090d',
        display: 'flex', alignItems: 'center', padding: '0 12px',
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
      }}>
        <span>NORMAL</span>
        <span style={{ margin: '0 10px', opacity: 0.5 }}>│</span>
        <span style={{ opacity: 0.85 }}>client.py</span>
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.85 }}>5:21</span>
        <span style={{ margin: '0 10px', opacity: 0.5 }}>│</span>
        <span style={{ opacity: 0.85 }}>38%</span>
      </div>

      {/* terminal pane */}
      <div style={{
        position: 'absolute', top: 482, left: 0, right: 0, bottom: 96,
        padding: '12px 14px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: '#0a0c11',
      }}>
        <div style={{ flex: 1, overflow: 'hidden', fontSize: 12, lineHeight: 1.55 }}>
          <div style={{ color: '#525866', marginBottom: 6 }}>$ claude --model sonnet-4.5</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <span style={{ color: ACCENT }}>❯</span>
            <span style={{ color: '#d4d4d8' }}>add streaming to the messages call</span>
          </div>
          <div style={{ color: '#525866', marginBottom: 4 }}>read client.py · 28L</div>
          <div style={{ color: '#525866', marginBottom: 10 }}>
            edit client.py <span style={{ color: ACCENT }}>+4</span> <span style={{ color: '#f0a3c0' }}>−1</span>
          </div>
          <div style={{ color: '#d4d4d8', textWrap: 'pretty' }}>
            switched to <span style={{ color: ACCENT }}>client.messages.stream()</span> and
            yielded text deltas. now an AsyncIterator — await it.
          </div>
        </div>

        {/* input — solid block cursor */}
        <div style={{
          marginTop: 8, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12.5,
        }}>
          <span style={{ color: ACCENT }}>❯</span>
          <span style={{ color: '#525866' }}>run it</span>
          <span style={{ width: 9, height: 16, background: ACCENT, marginLeft: 1 }} />
        </div>
      </div>

      {/* bottom nav — numbered, tmux-window style */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 28, height: 36,
        background: '#0a0c11', borderTop: '1px solid #1f2430',
        display: 'flex', zIndex: 30,
      }}>
        {navItem('FILES', '1', false)}
        {navItem('FIND', '2', false)}
        {navItem('EDIT', '3', true)}
        {navItem('TERM', '4', false)}
        {navItem('GIT', '5', false)}
      </div>

      {/* home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 3, background: '#3f4651', zIndex: 40,
      }} />
    </div>
  );
}

window.VariantTerminal = VariantTerminal;
