// Git tab — all operations go through the GitHub REST API (no local git, no
// staging). One "Modified" list; Pull / Push(N) / Switch tiles; commit composer
// with "Draft with Claude" + issue-ref chips when the active task links an issue.

const REPO = { owner: 'kevinthelago', name: 'base-studio-code', branch: 'feat/streaming' };

const MODIFIED = [
  { path: 'app/llm/client.py', state: 'M', adds: 4, dels: 1 },
  { path: 'app/llm/cli.py', state: 'M', adds: 12, dels: 3 },
  { path: 'tests/test_client.py', state: 'M', adds: 6, dels: 0 },
  { path: 'docs/streaming.md', state: 'A', adds: 28, dels: 0 },
];

const LINKED_ISSUE = { number: 42, title: 'Stream completions to the editor' };

function GitPage() {
  const t = useTheme();
  const [ref, setRef] = React.useState('fixes'); // none | refs | fixes
  const n = MODIFIED.length;

  return (
    <>
      {/* Header */}
      <div style={{ position: 'absolute', top: 60, left: 24, right: 24, zIndex: 5 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600 }}>Branch</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={t.accent} strokeWidth="1.8"><circle cx="5" cy="4" r="2"/><circle cx="5" cy="14" r="2"/><circle cx="13" cy="9" r="2"/><path d="M5 6v6M7 4h4a2 2 0 012 2v1"/></svg>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: t.fg, fontFamily: t.fontMono }}>{REPO.branch}</span>
        </div>
        <div style={{ fontSize: 12, color: t.fgMuted, marginTop: 4, fontFamily: t.fontMono }}>
          {REPO.owner}/{REPO.name} · <span style={{ color: t.accent }}>{n} modified</span>
        </div>
      </div>

      {/* Action tiles: Pull · Push(N) · Switch */}
      <div style={{ position: 'absolute', top: 142, left: 16, right: 16, display: 'flex', gap: 8, zIndex: 5 }}>
        <ActionTile t={t} label="Pull">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v9M5 7l4 4 4-4M3 15h12"/></svg>
        </ActionTile>
        <ActionTile t={t} label={`Push (${n})`} accent>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 16V7M5 11l4-4 4 4M3 3h12"/></svg>
        </ActionTile>
        <ActionTile t={t} label="Switch">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h9l-2-2M15 12H6l2 2"/></svg>
        </ActionTile>
      </div>

      {/* Modified list */}
      <div style={{ position: 'absolute', top: 226, left: 12, right: 12, bottom: 232, overflow: 'hidden', zIndex: 5 }}>
        <div style={{ padding: '0 12px 8px', fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
          <span>Modified</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        </div>
        <Surface style={{ overflow: 'hidden' }}>
          {MODIFIED.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
              borderBottom: i < MODIFIED.length - 1 ? `0.5px solid ${t.borderColor}` : 'none', cursor: 'pointer' }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: f.state === 'A' ? 'rgba(52,211,153,0.18)' : 'rgba(245,185,74,0.18)',
                color: f.state === 'A' ? t.code.ty : t.code.nm }}>{f.state}</span>
              <span style={{ flex: 1, fontSize: 13, color: t.fg, fontFamily: t.fontMono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
              <span style={{ fontSize: 11, fontFamily: t.fontMono, color: t.code.ty }}>+{f.adds}</span>
              <span style={{ fontSize: 11, fontFamily: t.fontMono, color: t.code.pa }}>−{f.dels}</span>
            </div>
          ))}
        </Surface>
      </div>

      {/* Commit composer */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 96, zIndex: 5 }}>
        <Surface style={{ padding: 12 }} radius={20}>
          {/* issue-ref chips (active task links issue #42) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
            <span style={{ fontSize: 10.5, color: t.fgDim, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="5.5" cy="5.5" r="4"/><circle cx="5.5" cy="5.5" r="1"/></svg>
              #{LINKED_ISSUE.number}
            </span>
            {[['fixes', `Fixes #${LINKED_ISSUE.number}`], ['refs', `Refs #${LINKED_ISSUE.number}`], ['none', 'None']].map(([id, label]) => {
              const active = ref === id;
              return (
                <button key={id} onClick={() => setRef(id)} style={{ flexShrink: 0, height: 26, padding: '0 10px',
                  borderRadius: t.sharp ? 4 : 13, cursor: 'pointer', fontSize: 11.5, fontWeight: 500, fontFamily: t.fontUI,
                  border: active ? 'none' : t.border, background: active ? t.accent : 'transparent', color: active ? '#fff' : t.fgMuted }}>{label}</button>
              );
            })}
          </div>

          <div style={{ fontSize: 13.5, color: t.fg, fontFamily: t.fontUI, padding: '2px 4px 10px', minHeight: 38 }}>
            <span style={{ color: t.fg }}>Stream completions to the editor</span>
            {ref !== 'none' && <span style={{ color: t.fgMuted }}>{'\n\n'}{ref === 'fixes' ? 'Fixes' : 'Refs'} #{LINKED_ISSUE.number}</span>}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: `0.5px solid ${t.borderColor}`, paddingTop: 10 }}>
            <button style={{ fontSize: 11.5, color: t.fgMuted, background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: t.fontUI }}>
              <ClaudeAvatar size={14} /> Draft with Claude
            </button>
            <div style={{ flex: 1 }} />
            <button style={{ padding: '8px 16px', borderRadius: t.sharp ? 6 : 14, border: 'none', cursor: 'pointer',
              background: t.accent, color: '#fff', fontSize: 12.5, fontWeight: 600, fontFamily: t.fontUI }}>Commit · {n}</button>
          </div>
        </Surface>
      </div>
    </>
  );
}

function ActionTile({ t, label, accent, children }) {
  return (
    <Surface style={{ flex: 1, height: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
      ...(accent ? { background: t.accent, border: 'none' } : null) }} radius={14}>
      <span style={{ color: accent ? '#fff' : t.fg }}>{children}</span>
      <span style={{ fontSize: 11, color: accent ? '#fff' : t.fgMuted, fontWeight: accent ? 600 : 500 }}>{label}</span>
    </Surface>
  );
}

window.GitPage = GitPage;
