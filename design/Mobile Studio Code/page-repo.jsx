// Repo picker — boots here when no repo is cloned; also reached via Git ▸ Switch.
// Presented as a slide-up sheet. Enter owner/repo + branch, pick a theme, clone.

const RECENT_REPOS = [
  { repo: 'kevinthelago/base-studio-code', branch: 'main' },
  { repo: 'kevinthelago/Mobile-Studio-Code', branch: 'main' },
  { repo: 'kevinthelago/llm-cli', branch: 'feat/streaming' },
];

function RepoPicker({ onTheme, themeId }) {
  const t = useTheme();
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45 }}>
      {/* dimmed backdrop hinting the sheet slid up over the app */}
      <div style={{ position: 'absolute', inset: 0, background: t.light ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.35)' }} />

      {/* sheet */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 96 }}>
        <Surface style={{ height: '100%', borderRadius: t.sharp ? 0 : '28px 28px 0 0', padding: '10px 18px 0', overflow: 'hidden' }} radius={t.sharp ? 0 : 28}>
          {/* grabber */}
          <div style={{ width: 40, height: 5, borderRadius: 3, background: t.borderColor, margin: '0 auto 16px' }} />

          <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600 }}>Open repository</div>
          <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: -0.5, color: t.fg, marginTop: 2 }}>Clone a repo</div>
          <div style={{ fontSize: 13, color: t.fgMuted, marginTop: 4, lineHeight: 1.4 }}>Download it to this device to browse, edit, and commit with Claude.</div>

          {/* fields */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <RepoField t={t} label="Repository" value="kevinthelago/base-studio-code" icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke={t.fgMuted} strokeWidth="1.4"><path d="M4 1h5l4 4v9H4z"/><path d="M9 1v4h4"/></svg>
            } />
            <RepoField t={t} label="Branch" value="main" icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke={t.fgMuted} strokeWidth="1.5"><circle cx="4" cy="3.5" r="1.7"/><circle cx="4" cy="11.5" r="1.7"/><circle cx="11" cy="7.5" r="1.7"/><path d="M4 5v5M6 3.5h3a2 2 0 012 2v.5"/></svg>
            } />
          </div>

          {/* theme picker */}
          <div style={{ marginTop: 18, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600 }}>Theme</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto' }}>
            {Object.entries(THEMES).map(([id, th]) => {
              const active = id === themeId;
              return (
                <button key={id} onClick={() => onTheme && onTheme(id)} style={{ flexShrink: 0, cursor: 'pointer',
                  padding: 3, borderRadius: 12, border: active ? `2px solid ${t.accent}` : `2px solid transparent`, background: 'transparent' }}>
                  <span style={{ display: 'flex', width: 52, height: 36, borderRadius: 9, overflow: 'hidden', border: t.border }}>
                    <span style={{ width: '60%', background: th.bg }} />
                    <span style={{ width: '40%', background: th.accent }} />
                  </span>
                  <div style={{ fontSize: 9.5, color: active ? t.fg : t.fgMuted, marginTop: 3, fontWeight: active ? 600 : 400, textAlign: 'center', maxWidth: 56, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{th.name}</div>
                </button>
              );
            })}
          </div>

          {/* clone button */}
          <button style={{ width: '100%', height: 50, marginTop: 20, borderRadius: t.sharp ? 6 : 25, border: 'none', cursor: 'pointer',
            background: t.glass ? 'linear-gradient(135deg,#d97757,#c084fc)' : t.accent, color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: t.fontUI,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 2v8M5 7l3.5 3.5L12 7M3 14h11"/></svg>
            Download repository
          </button>

          {/* recents */}
          <div style={{ marginTop: 18, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600 }}>Recent</div>
          <div style={{ marginTop: 8 }}>
            {RECENT_REPOS.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px',
                borderBottom: i < RECENT_REPOS.length - 1 ? `0.5px solid ${t.borderColor}` : 'none', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={t.fgMuted} strokeWidth="1.4"><circle cx="3.5" cy="3.5" r="1.6"/><circle cx="3.5" cy="10.5" r="1.6"/><circle cx="10.5" cy="7" r="1.6"/><path d="M3.5 5v5M5.5 3.5h3a2 2 0 012 2v.5"/></svg>
                <span style={{ flex: 1, fontSize: 13, color: t.fg, fontFamily: t.fontMono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.repo}</span>
                <span style={{ fontSize: 11, color: t.fgDim, fontFamily: t.fontMono }}>{r.branch}</span>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function RepoField({ t, label, value, icon }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: t.fgDim, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      <div style={{ height: 46, borderRadius: t.sharp ? 4 : 12, border: t.border,
        background: t.glass ? 'rgba(0,0,0,0.22)' : t.bg, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
        {icon}
        <span style={{ color: t.fg, fontSize: 14, fontFamily: t.fontMono }}>{value}</span>
      </div>
    </div>
  );
}

window.RepoPicker = RepoPicker;
