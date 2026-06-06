// Find page — query, scope chips, results grouped by file with line previews.

const FIND_RESULTS = [
  { file: 'app/llm/client.py', matches: [
    { line: 6, before: '    client = ', match: 'AsyncAnthropic', after: '()' },
    { line: 8, before: '        model="', match: 'claude', after: '-sonnet-4-5",' },
  ]},
  { file: 'app/llm/cli.py', matches: [
    { line: 12, before: 'from anthropic import ', match: 'AsyncAnthropic', after: '' },
    { line: 24, before: '    async with ', match: 'AsyncAnthropic', after: '() as c:' },
  ]},
  { file: 'tests/test_client.py', matches: [
    { line: 4, before: 'mock = mock.', match: 'AsyncAnthropic', after: '()' },
  ]},
];

function FindPage() {
  const t = useTheme();
  const [q, setQ] = React.useState('AsyncAnthropic');
  const [scope, setScope] = React.useState('all');
  const [caseSensitive, setCaseSensitive] = React.useState(true);

  return (
    <>
      {/* Header */}
      <div style={{ position: 'absolute', top: 60, left: 24, right: 24, zIndex: 5 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600 }}>Search</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color: t.fg, marginTop: 2 }}>Find in workspace</div>
      </div>

      {/* Search input */}
      <div style={{ position: 'absolute', top: 134, left: 16, right: 16, zIndex: 5 }}>
        <Surface style={{
          height: 48, display: 'flex', alignItems: 'center', padding: '0 6px 0 14px', gap: 10,
        }} radius={24}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={t.fgMuted} strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="6" r="4"/><path d="M9.5 9.5L13 13"/></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: t.fg, fontSize: 14, fontFamily: t.fontMono }} />
          {/* live scan spinner */}
          <span style={{ width: 14, height: 14, borderRadius: 7, border: `2px solid ${t.borderColor}`, borderTopColor: t.accent, animation: 'msc-spin 0.8s linear infinite', flexShrink: 0 }} />
          {/* case-sensitivity toggle */}
          <button onClick={() => setCaseSensitive(!caseSensitive)} style={{
            width: 32, height: 32, borderRadius: t.sharp ? 4 : 16, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: caseSensitive ? t.accent : (t.glass ? 'rgba(255,255,255,0.10)' : t.surface),
            color: caseSensitive ? '#fff' : t.fgMuted, fontSize: 12, fontWeight: 700, fontFamily: t.fontMono,
          }}>Aa</button>
        </Surface>
      </div>

      {/* Scope chips */}
      <div style={{ position: 'absolute', top: 196, left: 16, right: 16, zIndex: 5, display: 'flex', gap: 8, overflowX: 'auto' }}>
        {[
          { id: 'all', label: 'All files', count: 5 },
          { id: 'open', label: 'Open', count: 1 },
          { id: 'py', label: '*.py', count: 4 },
          { id: 'tests', label: 'Tests', count: 1 },
        ].map((c) => {
          const active = c.id === scope;
          return (
            <button key={c.id} onClick={() => setScope(c.id)} style={{
              flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 16,
              border: t.glass ? '0.5px solid rgba(255,255,255,0.10)' : t.border,
              background: active ? t.accent : (t.glass ? 'rgba(255,255,255,0.06)' : t.surface),
              color: active ? '#fff' : t.fg,
              fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: t.fontUI,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {c.label}
              <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.85)' : t.fgDim, fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
            </button>
          );
        })}
      </div>

      {/* Results meta */}
      <div style={{ position: 'absolute', top: 244, left: 24, right: 24, fontSize: 11.5, color: t.fgDim, zIndex: 5,
        display: 'flex', justifyContent: 'space-between', fontFamily: t.fontMono, fontVariantNumeric: 'tabular-nums' }}>
        <span>5 matches in 3 files</span>
        <span>scanning 12/14</span>
      </div>

      {/* Results */}
      <div style={{ position: 'absolute', top: 270, left: 12, right: 12, bottom: 110, overflow: 'hidden', zIndex: 5 }}>
        <Surface style={{ height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '4px 0' }}>
            {FIND_RESULTS.map((r, ri) => (
              <div key={ri}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 6px',
                  borderTop: ri > 0 ? `0.5px solid ${t.borderColor}` : 'none',
                }}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke={t.fgMuted} strokeWidth="1.6" strokeLinecap="round" style={{ transform: 'rotate(90deg)' }}><path d="M2.5 1.5L6 4.5L2.5 7.5"/></svg>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: t.fg, fontFamily: t.fontMono, flex: 1 }}>{r.file}</span>
                  <span style={{ fontSize: 11, color: t.fgDim, fontVariantNumeric: 'tabular-nums' }}>{r.matches.length}</span>
                </div>
                {r.matches.map((m, mi) => (
                  <div key={mi} style={{
                    display: 'flex', gap: 12, padding: '4px 14px 4px 28px', alignItems: 'baseline',
                    fontFamily: t.fontMono, fontSize: 11.5, lineHeight: 1.5,
                  }}>
                    <span style={{ width: 28, color: t.fgDim, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>{m.line}</span>
                    <span style={{ color: t.fgMuted, whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                      {m.before}<span style={{
                        background: t.glass ? 'rgba(255, 174, 207, 0.25)' : (t.light ? 'rgba(247,196,38,0.45)' : 'rgba(255,174,207,0.18)'),
                        color: t.fg, padding: '1px 2px', borderRadius: 2,
                      }}>{m.match}</span>{m.after}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </>
  );
}

window.FindPage = FindPage;
