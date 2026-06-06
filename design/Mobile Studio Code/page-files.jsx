// Files page — file tree, recents, quick filter.
// Nested folders, current file highlighted, modified dot indicator.

const FILE_TREE = [
  { type: 'folder', name: 'app', open: true, depth: 0, children: [
    { type: 'folder', name: 'llm', open: true, depth: 1 },
    { type: 'file', name: 'client.py', depth: 2, dirty: true, current: true, size: '2.1 KB' },
    { type: 'file', name: 'cli.py', depth: 2, size: '4.7 KB' },
    { type: 'file', name: 'tools.py', depth: 2, size: '1.4 KB' },
    { type: 'folder', name: 'config', open: false, depth: 1 },
  ]},
  { type: 'folder', name: 'tests', open: false, depth: 0 },
  { type: 'file', name: 'pyproject.toml', depth: 0, size: '0.9 KB' },
  { type: 'file', name: 'README.md', depth: 0, size: '3.2 KB' },
  { type: 'file', name: '.gitignore', depth: 0, size: '180 B' },
];

const RECENTS = [
  { name: 'client.py', path: 'app/llm', dirty: true },
  { name: 'cli.py', path: 'app/llm' },
  { name: 'tools.py', path: 'app/llm' },
];

function FileIcon({ type, ext }) {
  const t = useTheme();
  if (type === 'folder') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ color: t.fgMuted }}>
        <path d="M2 5a1.5 1.5 0 011.5-1.5h2.8L7.5 5H13a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0113 13H3.5A1.5 1.5 0 012 11.5V5z"/>
      </svg>
    );
  }
  // file: small dot of accent for code files
  const colors = { py: '#67d3ff', md: t.fgMuted, toml: '#ffaecf', txt: t.fgDim };
  return (
    <span style={{
      width: 12, height: 14, borderRadius: 2, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700,
      color: colors[ext] || t.fgMuted, fontFamily: t.fontMono, letterSpacing: -0.5,
    }}>
      <svg width="11" height="14" viewBox="0 0 11 14" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 1h6l3 3v9H1z"/><path d="M7 1v3h3"/></svg>
    </span>
  );
}

function FilesPage() {
  const t = useTheme();
  const [q, setQ] = React.useState('');

  return (
    <>
      {/* Header — large title style */}
      <div style={{ position: 'absolute', top: 60, left: 24, right: 24, zIndex: 5 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600 }}>
          Workspace
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color: t.fg }}>base-studio-code</span>
          <span style={{ fontSize: 13, color: t.fgMuted }}>· 14 files · 3 modified</span>
        </div>
        <div style={{ fontSize: 11.5, color: t.fgDim, marginTop: 3, fontFamily: t.fontMono }}>kevinthelago/base-studio-code · main</div>
      </div>

      {/* Search pill */}
      <div style={{ position: 'absolute', top: 158, left: 16, right: 16, height: 44, zIndex: 5 }}>
        <Surface style={{
          height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        }} radius={22}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={t.fgMuted} strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="6" r="4"/><path d="M9.5 9.5L13 13"/></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter files…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              color: t.fg, fontSize: 13.5, fontFamily: t.fontUI,
            }} />
          <span style={{ fontSize: 11, color: t.fgDim, fontFamily: t.fontMono, fontVariantNumeric: 'tabular-nums' }}>⌘P</span>
        </Surface>
      </div>

      {/* Recents row */}
      <div style={{ position: 'absolute', top: 214, left: 0, right: 0, zIndex: 5 }}>
        <div style={{ padding: '0 24px 8px', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600 }}>Recent</div>
        <div style={{
          display: 'flex', gap: 10, padding: '0 16px', overflowX: 'auto',
        }}>
          {RECENTS.map((r) => (
            <Surface key={r.name} style={{
              padding: '10px 14px', minWidth: 140, flexShrink: 0,
              display: 'flex', flexDirection: 'column', gap: 2,
            }} radius={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.fg }}>{r.name}</span>
                {r.dirty && <span style={{ width: 5, height: 5, borderRadius: 3, background: t.accent }} />}
              </div>
              <span style={{ fontSize: 11, color: t.fgDim, fontFamily: t.fontMono }}>{r.path}</span>
            </Surface>
          ))}
        </div>
      </div>

      {/* Tree section title */}
      <div style={{ position: 'absolute', top: 314, left: 24, right: 24, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600, zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Files</span>
        <span style={{ display: 'flex', gap: 14, color: t.fgMuted, textTransform: 'none', letterSpacing: 0, fontWeight: 500, fontSize: 12 }}>
          <span>Sort</span>
          <span>+ New</span>
        </span>
      </div>

      {/* Tree */}
      <div style={{ position: 'absolute', top: 340, left: 12, right: 12, bottom: 110, overflow: 'hidden', zIndex: 5 }}>
        <Surface style={{ height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '6px 0' }}>
            {FILE_TREE.map((row, i) => {
              const ext = row.name.split('.').pop();
              const last = i === FILE_TREE.length - 1;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  paddingLeft: 14 + row.depth * 16,
                  borderBottom: !last ? `0.5px solid ${t.borderColor}` : 'none',
                  background: row.current
                    ? (t.glass ? 'rgba(255,255,255,0.06)' : (t.light ? 'rgba(9,105,218,0.06)' : 'rgba(217,119,87,0.10)'))
                    : 'transparent',
                  position: 'relative',
                }}>
                  {row.current && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                      background: t.accent,
                    }} />
                  )}
                  {row.type === 'folder' && (
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke={t.fgMuted} strokeWidth="1.6" strokeLinecap="round"
                      style={{ transform: row.open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                      <path d="M2.5 1.5L6 4.5L2.5 7.5"/>
                    </svg>
                  )}
                  {row.type === 'file' && <span style={{ width: 9 }} />}
                  <FileIcon type={row.type} ext={ext} />
                  <span style={{
                    flex: 1, fontSize: 13.5,
                    color: row.current ? t.fg : (row.type === 'folder' ? t.fg : t.fgMuted),
                    fontWeight: row.current || row.type === 'folder' ? 600 : 400,
                    fontFamily: t.fontMono,
                  }}>{row.name}</span>
                  {row.dirty && <span style={{ width: 6, height: 6, borderRadius: 3, background: t.accent }} />}
                  {row.size && <span style={{ fontSize: 10.5, color: t.fgDim, fontFamily: t.fontMono, fontVariantNumeric: 'tabular-nums' }}>{row.size}</span>}
                </div>
              );
            })}
          </div>
        </Surface>
      </div>
    </>
  );
}

window.FilesPage = FilesPage;
