// Edit tab — the primary screen: syntax-highlighted code pane on top, Claude
// chat panel on the bottom. The agent can list/read/grep/write files, push/pull,
// read remote files, resolve conflicts, and read/comment on issues — the chat
// reflects that via tool-call cards. Context is auto-optimized (system notes).

// Conversation turns for the ACTIVE task.
const EDIT_TURNS = [
  { kind: 'user', text: 'make stream() cancellable and match the screenshot', images: 1 },
  { kind: 'tool', name: 'read_file', path: 'app/llm/client.py', status: 'ok', result: '28 lines' },
  { kind: 'tool', name: 'grep_file', path: '"CancelledError"', status: 'ok', result: '0 hits' },
  { kind: 'note', text: 'Context optimized · evicted 2 stale reads' },
  { kind: 'tool', name: 'write_file', path: 'app/llm/client.py', status: 'ok', result: '+7 −2' },
  { kind: 'reply', text: 'Wrapped the stream loop in try/finally and re-raise CancelledError after closing the response. The caller now shuts down cleanly.' },
  { kind: 'tool', name: 'write_file', path: 'tests/test_cancel.py', status: 'running' },
];

function EditPage({ empty = false, mode: modeProp = 'read' }) {
  const t = useTheme();
  const [mode, setMode] = React.useState(modeProp);
  const dirty = true;

  if (empty) return <EditEmpty t={t} />;

  return (
    <>
      {/* TOP PILL: file path + Save (dirty) + read/edit toggle */}
      <TopPill
        left={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={t.fgMuted} strokeWidth="1.6"><path d="M2 3h3l1 1h6v7H2z"/></svg>}
        center={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums', fontFamily: t.fontMono }}>
            <span style={{ color: t.fgDim }}>app</span><span style={{ color: t.fgDim }}>/</span>
            <span style={{ color: t.fgMuted }}>llm</span><span style={{ color: t.fgDim }}>/</span>
            <span style={{ color: t.fg, fontWeight: 600 }}>client.py</span>
            {dirty && <span style={{ marginLeft: 6, width: 5, height: 5, borderRadius: 3, background: t.accent }} />}
          </div>
        }
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            {dirty && (
              <IconBtn primary>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l3 3 5-7"/></svg>
              </IconBtn>
            )}
            <IconBtn onClick={() => setMode(mode === 'read' ? 'edit' : 'read')} style={mode === 'edit' ? { background: t.accent, color: '#fff' } : undefined}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l1-3 6-6 2 2-6 6-3 1z"/></svg>
            </IconBtn>
          </div>
        }
      />

      {/* CODE PANE — read = highlighted+numbered, edit = plain mono */}
      <div style={{ position: 'absolute', top: 116, left: 0, right: 0, height: 224, overflow: 'hidden', padding: '8px 0', zIndex: 4,
        background: mode === 'edit' ? (t.glass ? 'rgba(0,0,0,0.18)' : t.surfaceSolid) : 'transparent' }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 12.5, lineHeight: '20px' }}>
          {SAMPLE_CODE.map((line) => (
            <div key={line.n} style={{ display: 'flex', padding: '0 4px 0 0' }}>
              {mode === 'read' && (
                <div style={{ width: 36, textAlign: 'right', paddingRight: 12, color: t.fgDim, fontVariantNumeric: 'tabular-nums', userSelect: 'none', flexShrink: 0 }}>{line.n}</div>
              )}
              <div style={{ whiteSpace: 'pre', color: t.code.id, paddingLeft: mode === 'edit' ? 14 : 0 }}>
                {mode === 'read' ? renderTokens(line.tokens, t.code) : line.tokens.map((tk) => tk.v).join('')}
              </div>
            </div>
          ))}
        </div>
        {mode === 'edit' && <div style={{ position: 'absolute', left: 14, top: 8 + 4 * 20, width: 1.5, height: 18, background: t.accent, animation: 'msc-blink 1s steps(2) infinite' }} />}
      </div>

      {/* Claude chip — model + live tool count */}
      <div style={{ position: 'absolute', top: 348, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 24 }}>
        <Surface style={{ padding: '6px 12px 6px 9px', display: 'flex', alignItems: 'center', gap: 7,
          fontSize: 12, fontWeight: 600, color: t.fg, fontFamily: t.fontUI }} radius={14}>
          <ClaudeAvatar size={14} />
          Claude · sonnet 4.6
          <span style={{ width: 1, height: 12, background: t.borderColor, margin: '0 2px' }} />
          <span style={{ color: t.fgMuted, fontWeight: 500 }}>4 tools</span>
        </Surface>
      </div>

      {/* CHAT PANEL */}
      <div style={{ position: 'absolute', left: 12, right: 12, top: 380, bottom: 88, zIndex: 22 }}>
        <Surface style={{ height: '100%', padding: '14px 14px 10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} radius={26}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {EDIT_TURNS.map((turn, i) => <ChatTurn key={i} t={t} turn={turn} />)}
            {/* thinking indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <ClaudeAvatar size={13} pulse />
              <span style={{ fontSize: 12.5, color: t.fgMuted, fontStyle: 'italic' }}>thinking…</span>
            </div>
          </div>

          {/* attach preview strip */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, position: 'relative', flexShrink: 0,
              background: 'linear-gradient(135deg,#3a4a6a,#6a3a5a)', border: t.border }}>
              <span style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8,
                background: t.bg, border: t.border, color: t.fg, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</span>
            </div>
          </div>

          {/* input bar */}
          <div style={{ height: 44, borderRadius: 22, padding: '0 6px 0 8px',
            background: t.glass ? 'rgba(0,0,0,0.25)' : t.bg, border: `0.5px solid ${t.borderColor}`,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <button style={{ width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: 'transparent', color: t.fgMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 7.5l-5.5 5.5a3 3 0 01-4.2-4.2l5.5-5.5a2 2 0 012.8 2.8l-5.5 5.5a1 1 0 01-1.4-1.4L11 4.8"/></svg>
            </button>
            <span style={{ flex: 1, color: t.fgDim, fontSize: 13.5 }}>Ask Claude…</span>
            <IconBtn primary>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 11V3M3 7l4-4 4 4"/></svg>
            </IconBtn>
          </div>
        </Surface>
      </div>
    </>
  );
}

// One chat turn
function ChatTurn({ t, turn }) {
  if (turn.kind === 'user') {
    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <span style={{ color: t.accent, fontFamily: t.fontMono, fontSize: 12.5 }}>›</span>
        <div style={{ flex: 1 }}>
          <span style={{ color: t.fg, fontSize: 12.5, fontFamily: t.fontMono }}>{turn.text}</span>
          {turn.images > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
              {Array.from({ length: turn.images }).map((_, i) => (
                <span key={i} style={{ width: 30, height: 30, borderRadius: 6, background: 'linear-gradient(135deg,#3a4a6a,#6a3a5a)', border: t.border, display: 'block' }} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (turn.kind === 'tool') {
    const running = turn.status === 'running';
    const failed = turn.status === 'error';
    return (
      <div style={{ background: t.glass ? 'rgba(255,255,255,0.05)' : t.surfaceSolid, border: `0.5px solid ${t.borderColor}`,
        borderRadius: 9, padding: '6px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontFamily: t.fontMono, fontSize: 11 }}>
        {running
          ? <span style={{ width: 11, height: 11, borderRadius: 6, border: `2px solid ${t.borderColor}`, borderTopColor: t.accent, animation: 'msc-spin 0.8s linear infinite', flexShrink: 0 }} />
          : <span style={{ color: failed ? t.code.pa : t.code.ty, flexShrink: 0, fontSize: 12 }}>{failed ? '✗' : '✓'}</span>}
        <span style={{ color: t.fg, fontWeight: 600 }}>{turn.name}</span>
        <span style={{ color: t.fgMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{turn.path}</span>
        {running ? <span style={{ color: t.fgDim }}>running…</span> : <span style={{ color: t.fgDim }}>{turn.result}</span>}
      </div>
    );
  }
  if (turn.kind === 'note') {
    return <div style={{ fontSize: 11, color: t.fgDim, fontStyle: 'italic', marginBottom: 8, paddingLeft: 4 }}>· {turn.text}</div>;
  }
  // reply
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <ClaudeAvatar size={14} />
      <div style={{ flex: 1, color: t.fg, fontFamily: t.fontUI, fontSize: 13, lineHeight: 1.45, textWrap: 'pretty', opacity: 0.95 }}>{turn.text}</div>
    </div>
  );
}

// Empty state — no file open
function EditEmpty({ t }) {
  return (
    <div style={{ position: 'absolute', inset: 0, top: 60, bottom: 96, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <span style={{ width: 60, height: 60, borderRadius: 16, border: `1.5px dashed ${t.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke={t.fgMuted} strokeWidth="1.4"><path d="M5 4h9l5 5v13H5z"/><path d="M14 4v5h5"/></svg>
      </span>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.fg }}>No file open</div>
        <div style={{ fontSize: 13, color: t.fgMuted, marginTop: 4 }}>Open a file to view and edit it with Claude.</div>
      </div>
      <button style={{ height: 44, padding: '0 22px', borderRadius: t.sharp ? 6 : 22, border: 'none', cursor: 'pointer',
        background: t.glass ? 'linear-gradient(135deg,#d97757,#c084fc)' : t.accent, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: t.fontUI }}>
        Open Files
      </button>
    </div>
  );
}

window.EditPage = EditPage;
