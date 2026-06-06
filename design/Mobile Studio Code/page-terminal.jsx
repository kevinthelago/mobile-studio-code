// Run tab — the TUNNELING client. A thin WebSocket mirror of Claude console
// sessions running on a paired "base-studio-code" desktop. NOT a local terminal.
// Five sub-states: pairing · scan (camera) · connecting · grid · terminal.

function RunPage({ state: stateProp = 'pairing', onFocusSession, focusedId }) {
  const t = useTheme();
  const [state, setState] = React.useState(stateProp);
  const [manual, setManual] = React.useState(false);
  React.useEffect(() => { setState(stateProp); }, [stateProp]);

  const ordered = orderSessions(SESSIONS);
  const focused = SESSIONS.find((s) => s.id === (focusedId || 's1')) || ordered[0];

  return (
    <>
      {/* Demo state selector (top-right) — lets the user flip tunnel states */}
      <div style={{ position: 'absolute', top: 64, right: 14, zIndex: 60, display: 'flex', gap: 3,
        background: t.glass ? 'rgba(0,0,0,0.5)' : t.surface, backdropFilter: t.glass ? 'blur(20px)' : 'none',
        border: t.border, borderRadius: 9, padding: 3 }}>
        {[['pairing','pair'],['providers','cloud'],['scan','scan'],['connecting','conn'],['grid','grid'],['terminal','term']].map(([id,label]) => (
          <button key={id} onClick={() => setState(id)} style={{
            padding: '4px 6px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: state === id ? t.accent : 'transparent', color: state === id ? '#fff' : t.fgMuted,
            fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: t.fontMono,
          }}>{label}</button>
        ))}
      </div>

      {state === 'pairing' && <Pairing t={t} manual={manual} setManual={setManual} onScan={() => setState('scan')} onConnect={() => setState('connecting')} onCloud={() => setState('providers')} />}
      {state === 'providers' && <Providers t={t} onBack={() => setState('pairing')} onConnect={() => setState('connecting')} />}
      {state === 'scan' && <Scanner t={t} onCancel={() => setState('pairing')} onDetected={() => setState('connecting')} />}
      {state === 'connecting' && <Connecting t={t} />}
      {state === 'grid' && <SessionGrid t={t} sessions={ordered} onOpen={() => setState('terminal')} onFocus={onFocusSession} />}
      {state === 'terminal' && <TerminalView t={t} session={focused} onBack={() => setState('grid')} />}
    </>
  );
}

// ── A · PAIRING ───────────────────────────────────────────────
function Pairing({ t, manual, setManual, onScan, onConnect, onCloud }) {
  return (
    <div style={{ position: 'absolute', top: 70, left: 16, right: 16, bottom: 96, zIndex: 4,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>

      {/* hero card */}
      <Surface style={{ padding: '26px 22px 24px', textAlign: 'center' }} radius={28}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {/* phone ↔ desktop tunnel motif */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 44, borderRadius: 7, border: `1.5px solid ${t.fgMuted}`, display: 'block' }} />
            <svg width="34" height="16" viewBox="0 0 34 16" fill="none" stroke={t.code.ty} strokeWidth="1.8" strokeLinecap="round"><path d="M1 8h32M7 3L2 8l5 5M27 3l5 5-5 5"/></svg>
            <span style={{ width: 52, height: 38, borderRadius: 6, border: `1.5px solid ${t.fgMuted}`, display: 'block', position: 'relative' }}>
              <span style={{ position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)', width: 18, height: 3, borderRadius: 2, background: t.fgMuted }} />
            </span>
          </div>
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: t.fg, letterSpacing: -0.3 }}>Connect to base-studio-code</div>
        <div style={{ fontSize: 13, color: t.fgMuted, marginTop: 6, lineHeight: 1.45, textWrap: 'pretty' }}>
          Mirror &amp; steer the desktop's Claude sessions — or skip the desktop and run on a cloud model below.
        </div>

        {/* PRIMARY — scan QR */}
        <button onClick={onScan} style={{
          width: '100%', height: 52, marginTop: 20, borderRadius: t.sharp ? 6 : 26, border: 'none', cursor: 'pointer',
          background: t.glass ? 'linear-gradient(135deg,#d97757,#c084fc)' : t.accent, color: '#fff',
          fontSize: 15, fontWeight: 600, fontFamily: t.fontUI,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6V3a1 1 0 011-1h3M16 6V3a1 1 0 00-1-1h-3M2 12v3a1 1 0 001 1h3M16 12v3a1 1 0 01-1 1h-3"/><rect x="6" y="6" width="6" height="6" rx="1"/></svg>
          Scan QR Code
        </button>
        <div style={{ fontSize: 11.5, color: t.fgDim, marginTop: 10, fontFamily: t.fontMono }}>
          Desktop ▸ Settings ▸ Pair device
        </div>
      </Surface>

      {/* SECONDARY — manual entry (collapsible) */}
      <Surface style={{ padding: manual ? '14px 16px 16px' : '4px 16px' }} radius={18}>
        <button onClick={() => setManual(!manual)} style={{
          width: '100%', height: 40, background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, color: t.fg, fontFamily: t.fontUI, fontSize: 13.5, fontWeight: 500,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={t.fgMuted} strokeWidth="1.6"><rect x="2" y="3" width="10" height="8" rx="1.5"/><path d="M4.5 6.5h5M4.5 8.5h3"/></svg>
          Enter URL and token manually
          <span style={{ flex: 1 }} />
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke={t.fgMuted} strokeWidth="1.6" strokeLinecap="round" style={{ transform: manual ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M3.5 2l4 3.5-4 3.5"/></svg>
        </button>
        {manual && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
            <Field t={t} label="WebSocket URL" placeholder="ws://192.168.1.20:4517" mono />
            <Field t={t} label="Pairing token" placeholder="••••-••••-••••" mono />
            <button onClick={onConnect} style={{
              height: 44, borderRadius: t.sharp ? 6 : 14, border: 'none', cursor: 'pointer', marginTop: 2,
              background: t.glass ? 'rgba(255,255,255,0.14)' : t.surfaceSolid, color: t.fg,
              fontSize: 14, fontWeight: 600, fontFamily: t.fontUI, border: t.border,
            }}>Connect</button>
          </div>
        )}
      </Surface>

      {/* ALT — run standalone on a cloud model (no desktop / no tunnel) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: t.fgDim, fontSize: 11, padding: '0 2px' }}>
        <span style={{ flex: 1, height: 1, background: t.borderColor }} />
        <span style={{ textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600 }}>or run standalone</span>
        <span style={{ flex: 1, height: 1, background: t.borderColor }} />
      </div>
      <button onClick={onCloud} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <Surface style={{ padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 11 }} radius={18}>
          <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: t.glass ? 'rgba(192,132,252,0.18)' : 'rgba(192,132,252,0.12)', color: '#c084fc',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 13a3.2 3.2 0 010-6.4 4.3 4.3 0 018.2 1A3.1 3.1 0 0114.5 13H5z"/></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.fg }}>Connect a cloud model</div>
            <div style={{ fontSize: 11.5, color: t.fgMuted }}>Anthropic · OpenAI · Google · local</div>
          </div>
          <div style={{ display: 'flex', marginRight: 4 }}>
            {['#d97757','#10a37f','#4285f4'].map((c, i) => (
              <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: c, marginLeft: i ? -5 : 0, border: `1.5px solid ${t.glass ? '#1a1c26' : t.surface}` }} />
            ))}
          </div>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke={t.fgMuted} strokeWidth="1.6" strokeLinecap="round"><path d="M3.5 2l4 3.5-4 3.5"/></svg>
        </Surface>
      </button>
    </div>
  );
}

function Field({ t, label, placeholder, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: t.fgDim, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      <div style={{
        height: 40, borderRadius: t.sharp ? 4 : 11, border: t.border,
        background: t.glass ? 'rgba(0,0,0,0.22)' : t.bg,
        display: 'flex', alignItems: 'center', padding: '0 12px',
      }}>
        <span style={{ color: t.fgDim, fontSize: 13, fontFamily: mono ? t.fontMono : t.fontUI }}>{placeholder}</span>
      </div>
    </div>
  );
}

// ── A3 · PROVIDERS (cloud / local models — standalone, no tunnel) ───
const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', color: '#d97757', status: 'connected', models: [
    { name: 'Claude Sonnet 4.6', id: 'claude-sonnet-4-6', ctx: '200K', tag: 'Recommended' },
    { name: 'Claude Opus 4.1', id: 'claude-opus-4-1', ctx: '200K' },
    { name: 'Claude Haiku 4.5', id: 'claude-haiku-4-5', ctx: '200K' },
  ]},
  { id: 'openai', name: 'OpenAI', color: '#10a37f', status: 'key', models: [
    { name: 'GPT-5', id: 'gpt-5', ctx: '256K' },
    { name: 'GPT-5 mini', id: 'gpt-5-mini', ctx: '256K' },
  ]},
  { id: 'google', name: 'Google', color: '#4285f4', status: 'key', models: [
    { name: 'Gemini 2.5 Pro', id: 'gemini-2.5-pro', ctx: '1M' },
    { name: 'Gemini 2.5 Flash', id: 'gemini-2.5-flash', ctx: '1M' },
  ]},
  { id: 'xai', name: 'xAI', color: '#1d1d1f', status: 'key', models: [
    { name: 'Grok 4', id: 'grok-4', ctx: '256K' },
  ]},
  { id: 'local', name: 'Local · Ollama', color: '#6b7280', status: 'local', models: [
    { name: 'Llama 3.3 70B', id: 'llama3.3:70b', ctx: '128K' },
    { name: 'Qwen 2.5 Coder', id: 'qwen2.5-coder:32b', ctx: '128K' },
  ]},
];

function Providers({ t, onBack, onConnect }) {
  const [openId, setOpenId] = React.useState('anthropic');
  const [sel, setSel] = React.useState('claude-sonnet-4-6');

  const statusPill = (status) => {
    if (status === 'connected') return <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.code.ty, fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: t.code.ty }} />Connected</span>;
    if (status === 'local') return <span style={{ fontSize: 11, color: '#67d3ff', fontWeight: 600 }}>On device</span>;
    return <span style={{ fontSize: 11, color: t.fgDim, fontWeight: 500 }}>Add key</span>;
  };

  return (
    <>
      {/* header */}
      <div style={{ position: 'absolute', top: 6, left: 12, right: 12, zIndex: 6 }}>
        <Surface style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10 }} radius={16}>
          <button onClick={onBack} style={{ width: 30, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer',
            background: t.glass ? 'rgba(255,255,255,0.10)' : t.surfaceSolid, color: t.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2L4 6.5l4 4.5"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.fg }}>Connect a model</div>
            <div style={{ fontSize: 10.5, color: t.fgMuted }}>Cloud or local · runs without a desktop</div>
          </div>
        </Surface>
      </div>

      {/* provider list */}
      <div style={{ position: 'absolute', top: 66, left: 12, right: 12, bottom: 96, overflow: 'hidden', zIndex: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PROVIDERS.map((p) => {
            const open = p.id === openId;
            return (
              <Surface key={p.id} style={{ overflow: 'hidden' }} radius={16}>
                <button onClick={() => setOpenId(open ? null : p.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: p.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, fontFamily: t.fontUI }}>{p.name[0]}</span>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.fg }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: t.fontMono }}>{p.models.length} model{p.models.length > 1 ? 's' : ''}</div>
                  </div>
                  {statusPill(p.status)}
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke={t.fgMuted} strokeWidth="1.6" strokeLinecap="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M3.5 2l4 3.5-4 3.5"/></svg>
                </button>

                {open && (
                  <div style={{ borderTop: `0.5px solid ${t.borderColor}` }}>
                    {p.models.map((m) => {
                      const active = m.id === sel;
                      return (
                        <button key={m.id} onClick={() => setSel(m.id)} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px',
                          border: 'none', background: active ? (t.glass ? 'rgba(255,255,255,0.06)' : t.surfaceSolid) : 'transparent', cursor: 'pointer',
                        }}>
                          <span style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0,
                            border: `2px solid ${active ? t.accent : t.borderColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {active && <span style={{ width: 8, height: 8, borderRadius: 4, background: t.accent }} />}
                          </span>
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <div style={{ fontSize: 13, color: t.fg, fontWeight: active ? 600 : 500, display: 'flex', alignItems: 'center', gap: 7 }}>
                              {m.name}
                              {m.tag && <span style={{ fontSize: 9.5, fontWeight: 700, color: t.accent, background: t.glass ? 'rgba(255,174,207,0.16)' : 'rgba(217,119,87,0.12)', padding: '1px 6px', borderRadius: 6, letterSpacing: 0.2 }}>{m.tag}</span>}
                            </div>
                            <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: t.fontMono }}>{m.id}</div>
                          </div>
                          <span style={{ fontSize: 10.5, color: t.fgDim, fontFamily: t.fontMono }}>{m.ctx}</span>
                        </button>
                      );
                    })}
                    {/* footer action per provider */}
                    <div style={{ padding: '10px 14px 12px' }}>
                      {p.status === 'key' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1, height: 40, borderRadius: t.sharp ? 4 : 11, border: t.border,
                            background: t.glass ? 'rgba(0,0,0,0.22)' : t.bg, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                            <span style={{ color: t.fgDim, fontSize: 12.5, fontFamily: t.fontMono }}>sk-…  paste API key</span>
                          </div>
                          <button onClick={onConnect} style={{ height: 40, padding: '0 16px', borderRadius: t.sharp ? 4 : 11, border: 'none', cursor: 'pointer',
                            background: t.accent, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: t.fontUI }}>Connect</button>
                        </div>
                      ) : (
                        <button onClick={onConnect} style={{ width: '100%', height: 42, borderRadius: t.sharp ? 4 : 12, border: 'none', cursor: 'pointer',
                          background: t.glass ? 'linear-gradient(135deg,#d97757,#c084fc)' : t.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: t.fontUI }}>
                          Use this model
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Surface>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── A2 · SCANNER (full-screen camera) ─────────────────────────
function Scanner({ t, onCancel, onDetected }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: '#05060a',
      display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* faux camera feed */}
      <div style={{ position: 'absolute', inset: 0, background:
        'radial-gradient(circle at 40% 35%, #1b2230 0%, #0a0d14 60%, #05060a 100%)' }} />
      {/* close */}
      <button onClick={onCancel} style={{ position: 'absolute', top: 22, left: 18, zIndex: 3,
        width: 36, height: 36, borderRadius: 18, border: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      <div style={{ position: 'absolute', top: 30, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600, zIndex: 3 }}>Scan pairing code</div>

      {/* viewfinder */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 220, height: 220, zIndex: 3 }}>
        {[['0','0','tl'],['r','0','tr'],['0','b','bl'],['r','b','br']].map(([x,y,k]) => (
          <span key={k} style={{
            position: 'absolute', width: 38, height: 38,
            [x==='r'?'right':'left']: 0, [y==='b'?'bottom':'top']: 0,
            borderTop: y!=='b' ? '3px solid #fff' : 'none', borderBottom: y==='b' ? '3px solid #fff' : 'none',
            borderLeft: x!=='r' ? '3px solid #fff' : 'none', borderRight: x==='r' ? '3px solid #fff' : 'none',
            borderTopLeftRadius: k==='tl'?10:0, borderTopRightRadius: k==='tr'?10:0,
            borderBottomLeftRadius: k==='bl'?10:0, borderBottomRightRadius: k==='br'?10:0,
          }} />
        ))}
        {/* scan line */}
        <span style={{ position: 'absolute', left: 8, right: 8, top: '50%', height: 2, background: t.code.ty, boxShadow: `0 0 12px ${t.code.ty}`, opacity: 0.9 }} />
      </div>

      <button onClick={onDetected} style={{ position: 'absolute', bottom: 60, left: 40, right: 40, zIndex: 3,
        height: 46, borderRadius: 23, border: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 13.5, fontWeight: 600,
        backdropFilter: 'blur(10px)' }}>Simulate detected code</button>
    </div>
  );
}

// ── B · CONNECTING ────────────────────────────────────────────
function Connecting({ t }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <span style={{ width: 40, height: 40, borderRadius: 20, border: `3px solid ${t.borderColor}`, borderTopColor: t.accent, animation: 'msc-spin 0.8s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.fg }}>Authenticating…</div>
        <div style={{ fontSize: 12.5, color: t.fgMuted, marginTop: 4, fontFamily: t.fontMono }}>ws://192.168.1.20:4517</div>
      </div>
    </div>
  );
}

// ── C · SESSION GRID ──────────────────────────────────────────
function SessionGrid({ t, sessions, onOpen, onFocus }) {
  return (
    <>
      <div style={{ position: 'absolute', top: 8, left: 24, right: 16, zIndex: 5, display: 'flex', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: t.fgDim, fontWeight: 600 }}>base-studio-code</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: t.fg }}>Sessions</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ padding: '7px 12px', borderRadius: t.sharp ? 5 : 13, cursor: 'pointer',
          background: 'transparent', border: t.border, color: t.fgMuted, fontSize: 12.5, fontWeight: 500, fontFamily: t.fontUI,
          display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: t.code.ty }} />
          Disconnect
        </button>
      </div>

      <div style={{ position: 'absolute', top: 78, left: 12, right: 12, bottom: 96, overflow: 'hidden', zIndex: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map((s) => {
            const c = statusColor(s.status);
            return (
              <Surface key={s.id} style={{ padding: '12px 14px', cursor: 'pointer', position: 'relative',
                border: s.needsInput ? '1px solid #f5b94a' : undefined }} radius={16}>
                <div onClick={() => { onFocus && onFocus(s.id); onOpen(); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: c, flexShrink: 0,
                      boxShadow: s.status === 'running' ? `0 0 8px ${c}` : 'none' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.fg, fontFamily: t.fontMono }}>{s.name}</span>
                    <span style={{ flex: 1 }} />
                    {s.needsInput && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#1a1206', background: '#f5b94a',
                        padding: '2px 7px', borderRadius: 8, letterSpacing: 0.3 }}>INPUT NEEDED</span>
                    )}
                    <span style={{ fontSize: 11, color: t.fgDim, fontFamily: t.fontMono }}>{s.ago}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: t.fg, marginTop: 7, fontWeight: 500 }}>{s.task}</div>
                  <div style={{ fontSize: 11.5, color: t.fgMuted, marginTop: 4, fontFamily: t.fontMono,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.preview}</div>
                  <div style={{ fontSize: 10.5, color: t.fgDim, marginTop: 6, fontFamily: t.fontMono }}>{s.cwd}</div>
                </div>
              </Surface>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── D · TERMINAL VIEW (focused session) ───────────────────────
function TerminalView({ t, session, onBack }) {
  const c = statusColor(session.status);
  return (
    <>
      {/* header */}
      <div style={{ position: 'absolute', top: 6, left: 12, right: 12, zIndex: 6 }}>
        <Surface style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10 }} radius={16}>
          <button onClick={onBack} style={{ width: 30, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer',
            background: t.glass ? 'rgba(255,255,255,0.10)' : t.surfaceSolid, color: t.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2L4 6.5l4 4.5"/></svg>
          </button>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: c, flexShrink: 0, boxShadow: `0 0 8px ${c}` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: t.fg, fontFamily: t.fontMono }}>{session.name}</div>
            <div style={{ fontSize: 10.5, color: t.fgMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.task}</div>
          </div>
        </Surface>
      </div>

      {/* user_request banner */}
      {session.needsInput && (
        <div style={{ position: 'absolute', top: 66, left: 12, right: 12, zIndex: 6,
          background: 'rgba(245,185,74,0.16)', border: '1px solid rgba(245,185,74,0.5)',
          borderRadius: 12, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: '#f5b94a' }} />
          <span style={{ fontSize: 12, color: t.fg, fontWeight: 500 }}>Claude is waiting for your input</span>
        </div>
      )}

      {/* output */}
      <div style={{ position: 'absolute', top: session.needsInput ? 108 : 66, left: 12, right: 12, bottom: 150, zIndex: 4 }}>
        <Surface style={{ height: '100%', overflow: 'hidden', padding: '12px 14px' }} radius={16}>
          <div style={{ fontFamily: t.fontMono, fontSize: 11.5, lineHeight: 1.6 }}>
            {SESSION_OUTPUT.map((l, i) => {
              const col = l.t === 'sys' ? t.fgDim : l.t === 'tool' ? t.code.ty : l.t === 'ask' ? '#f5b94a' : l.t === 'dim' ? 'transparent' : t.fg;
              return <div key={i} style={{ color: col, whiteSpace: 'pre-wrap', minHeight: l.t === 'dim' ? 8 : undefined,
                fontWeight: l.t === 'ask' ? 600 : 400 }}>{l.v}</div>;
            })}
            <span style={{ display: 'inline-block', width: 7, height: 13, background: c, animation: 'msc-blink 1s steps(2) infinite', verticalAlign: 'middle' }} />
          </div>
        </Surface>
      </div>

      {/* send input bar */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 96, zIndex: 6 }}>
        <Surface style={{ height: 50, display: 'flex', alignItems: 'center', padding: '0 6px 0 14px', gap: 10 }} radius={25}>
          <span style={{ color: '#f5b94a', fontFamily: t.fontMono, fontSize: 14 }}>❯</span>
          <span style={{ flex: 1, color: t.fgDim, fontSize: 14, fontFamily: t.fontMono }}>Send input…</span>
          <IconBtn primary>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 11V3M3 7l4-4 4 4"/></svg>
          </IconBtn>
        </Surface>
      </div>
    </>
  );
}

// keep legacy name used by the canvas mapping
window.RunPage = RunPage;
window.TerminalPage = RunPage;
