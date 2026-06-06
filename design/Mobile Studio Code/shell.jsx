// Shared chrome — works under any theme.
// Pages compose <Shell page=...> which renders status bar, optional top header,
// content area, and the bottom nav. The look adapts via useTheme().

const W = 390, H = 844;

// ─────────────────────────────────────────────────────────────
// Surface — themed panel. In glass it's a translucent card with backdrop-filter;
// elsewhere it's a solid card with a border.
// ─────────────────────────────────────────────────────────────
function Surface({ children, style = {}, radius, soft = false }) {
  const t = useTheme();
  const r = radius ?? t.radius;
  const base = t.glass ? {
    background: t.surface,
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: t.border,
    boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.18), 0 6px 24px rgba(0,0,0,0.25)',
  } : {
    background: soft ? t.surface : t.surfaceSolid,
    border: t.border,
  };
  return <div style={{ borderRadius: r, ...base, ...style }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// Ambient orbs — only in glass theme
// ─────────────────────────────────────────────────────────────
function Orbs() {
  const t = useTheme();
  if (!t.orbs) return null;
  const orb = (l, top, s, c) => (
    <div style={{
      position: 'absolute', left: l, top, width: s, height: s,
      borderRadius: '50%', background: c, filter: 'blur(60px)',
      opacity: 0.55, pointerEvents: 'none',
    }} />
  );
  return (
    <>
      {orb(-80, 80, 280, '#5b3fc8')}
      {orb(220, 240, 240, '#1f6dd9')}
      {orb(-40, 560, 260, '#0f5b6b')}
      {orb(180, 720, 220, '#7a2a6a')}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Status bar — uses theme.statusFg
// ─────────────────────────────────────────────────────────────
function StatusBar() {
  const t = useTheme();
  const c = t.statusFg;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 54,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '0 28px 8px', fontSize: 15, fontWeight: 600, zIndex: 30,
      fontFamily: '-apple-system, system-ui', color: c,
      pointerEvents: 'none',
    }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="16" height="11" viewBox="0 0 16 11" fill={c}><rect x="0" y="6" width="3" height="5" rx="0.6"/><rect x="4.5" y="4" width="3" height="7" rx="0.6"/><rect x="9" y="2" width="3" height="9" rx="0.6"/><rect x="13" y="0" width="3" height="11" rx="0.6"/></svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke={c} strokeOpacity="0.7"><rect x="0.5" y="0.5" width="19" height="10" rx="2.5"/><rect x="2" y="2" width="16" height="7" rx="1" fill={c}/></svg>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HomeIndicator
// ─────────────────────────────────────────────────────────────
function HomeIndicator() {
  const t = useTheme();
  const c = t.light ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.55)';
  return (
    <div style={{
      position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
      width: 134, height: 5, borderRadius: 3, background: c, zIndex: 50,
      pointerEvents: 'none',
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
// Top header pill — breadcrumb-style. Optional.
// ─────────────────────────────────────────────────────────────
function TopPill({ left, center, right, sub }) {
  const t = useTheme();
  return (
    <div style={{
      position: 'absolute', top: 60, left: 16, right: 16, height: 48,
      zIndex: 25,
    }}>
      <Surface style={{
        height: '100%', display: 'flex', alignItems: 'center',
        padding: '0 8px 0 14px', gap: 10,
      }}>
        {left}
        <div style={{
          flex: 1, minWidth: 0, fontSize: 13,
          color: t.fg, fontFamily: t.fontUI,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {center}
          {sub && <div style={{ fontSize: 10.5, color: t.fgDim, marginTop: 1, fontFamily: t.fontMono }}>{sub}</div>}
        </div>
        {right}
      </Surface>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom nav — 5 icons. Active state, glass-pill in glass theme.
// ─────────────────────────────────────────────────────────────
const NAV_PAGES = [
  { id: 'files',    label: 'Files',  icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5a2 2 0 012-2h3l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></svg> },
  { id: 'find',     label: 'Find',   icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="5"/><path d="M13 13l3.5 3.5"/></svg> },
  { id: 'edit',     label: 'Edit',   icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 14l1-4 8-8 3 3-8 8-4 1z"/></svg> },
  { id: 'terminal', label: 'Run',    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l3 3-3 3M9 13h6"/></svg> },
  { id: 'git',      label: 'Git',    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="15" r="2"/><circle cx="14" cy="10" r="2"/><path d="M6 7v6M8 5h4a2 2 0 012 2v1"/></svg> },
];

function BottomNav({ page, onChange }) {
  const t = useTheme();

  // Glass theme: floating pill with circular highlight on active.
  if (t.glass || t.name === 'Soft Dark') {
    return (
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 30, height: 60, zIndex: 30,
      }}>
        <Surface style={{
          height: '100%', borderRadius: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px',
        }} radius={32}>
          {NAV_PAGES.map((p) => {
            const active = p.id === page;
            return (
              <button key={p.id} onClick={() => onChange(p.id)} style={{
                width: 44, height: 44, borderRadius: 22, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? (t.glass ? 'rgba(255,255,255,0.16)' : 'rgba(217,119,87,0.18)') : 'transparent',
                color: active ? (t.glass ? '#fff' : t.accent) : t.fgMuted,
                transition: 'background .15s, color .15s',
              }}>{p.icon}</button>
            );
          })}
        </Surface>
      </div>
    );
  }

  // Terminal theme: numbered tmux row.
  if (t.sharp) {
    return (
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 28, height: 36, zIndex: 30,
        background: t.surface, borderTop: t.border, display: 'flex',
      }}>
        {NAV_PAGES.map((p, i) => {
          const active = p.id === page;
          return (
            <button key={p.id} onClick={() => onChange(p.id)} style={{
              flex: 1, height: '100%', border: 'none', cursor: 'pointer',
              borderRight: t.border,
              background: active ? t.surfaceSolid : 'transparent',
              color: active ? t.accent : t.fgMuted,
              fontSize: 11, letterSpacing: 0.4, fontFamily: t.fontMono,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ color: active ? t.accent : t.fgDim, fontWeight: 700 }}>{i + 1}</span>
              {p.label.toUpperCase()}
            </button>
          );
        })}
      </div>
    );
  }

  // Paper theme: text with top accent border on active.
  if (t.name === 'Paper') {
    return (
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 32, height: 56,
        background: t.bg, borderTop: t.border,
        display: 'flex', padding: '0 12px', zIndex: 30, fontFamily: '-apple-system, system-ui',
      }}>
        {NAV_PAGES.map((p) => {
          const active = p.id === page;
          return (
            <button key={p.id} onClick={() => onChange(p.id)} style={{
              flex: 1, height: 44, border: 'none', cursor: 'pointer', background: 'transparent',
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, letterSpacing: 0.6,
              textTransform: 'uppercase', color: active ? t.fg : t.fgMuted,
              borderTop: active ? `1.5px solid ${t.accent}` : '1.5px solid transparent',
              paddingTop: 8,
            }}>{p.label}</button>
          );
        })}
      </div>
    );
  }

  // Basic theme: material-style with icon + label
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 76, zIndex: 30,
      background: t.bg, borderTop: t.border, display: 'flex', paddingBottom: 20,
    }}>
      {NAV_PAGES.map((p) => {
        const active = p.id === page;
        return (
          <button key={p.id} onClick={() => onChange(p.id)} style={{
            flex: 1, height: 56, border: 'none', cursor: 'pointer', background: 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2, fontFamily: t.fontUI,
            color: active ? t.accent : t.fgMuted,
          }}>
            {p.icon}
            <span style={{ fontSize: 10, fontWeight: 500 }}>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ClaudeAvatar — animated gradient orb. Sizes via `size`.
// ─────────────────────────────────────────────────────────────
function ClaudeAvatar({ size = 16, pulse = false }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0,
      display: 'inline-block', position: 'relative',
      background: 'radial-gradient(circle at 32% 28%, #ffd2b0 0%, #d97757 42%, #c084fc 100%)',
      boxShadow: pulse ? '0 0 0 0 rgba(217,119,87,0.5)' : 'none',
      animation: pulse ? 'msc-pulse 1.6s ease-out infinite' : 'none',
    }} />
  );
}

// status dot color from the shared status language
function statusColor(status) {
  return (window.SESSION_STATUS && window.SESSION_STATUS[status] ? window.SESSION_STATUS[status].color : '#8b93a7');
}

// ─────────────────────────────────────────────────────────────
// SessionStrip — GLOBAL overlay pinned under the status bar on every tab.
// One chip per remote Claude session; awaiting-input first; accent border +
// amber pip when a session needs input. Tapping focuses it and jumps to Run.
// Hidden entirely when not connected / no sessions.
// ─────────────────────────────────────────────────────────────
const STRIP_H = 34;     // visual height of the strip
const STRIP_TOP = 52;   // sits right under the status bar
const STRIP_INSET = 40; // how far page content shifts down when the strip is shown

function SessionStrip({ sessions, focusedId, onFocus }) {
  const t = useTheme();
  if (!sessions || !sessions.length) return null;
  const ordered = (window.orderSessions ? window.orderSessions(sessions) : sessions);

  const wrap = t.glass ? {
    background: 'rgba(20,22,32,0.55)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderBottom: '0.5px solid rgba(255,255,255,0.12)',
  } : {
    background: t.surface,
    borderBottom: t.border,
  };

  return (
    <div style={{
      position: 'absolute', top: STRIP_TOP, left: 0, right: 0, height: STRIP_H, zIndex: 28,
      display: 'flex', alignItems: 'center', ...wrap,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px',
        overflowX: 'auto', width: '100%', height: '100%',
      }}>
        {/* tunnel glyph — signals "connected to desktop" */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, paddingRight: 4, borderRight: `1px solid ${t.borderColor}`, marginRight: 2 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={t.code.ty} strokeWidth="1.5"><path d="M1 6.5h11M3 4l-2 2.5L3 9M10 4l2 2.5L10 9"/></svg>
        </span>
        {ordered.map((s) => {
          const focused = s.id === focusedId;
          const c = statusColor(s.status);
          return (
            <button key={s.id} onClick={() => onFocus && onFocus(s.id)} style={{
              flexShrink: 0, height: 24, padding: '0 9px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              borderRadius: t.sharp ? 3 : 12,
              border: `1px solid ${s.needsInput ? '#f5b94a' : (focused ? t.fgMuted : t.borderColor)}`,
              background: focused ? (t.glass ? 'rgba(255,255,255,0.14)' : t.surfaceSolid) : 'transparent',
              position: 'relative',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: c, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: t.fg, fontFamily: t.fontMono, whiteSpace: 'nowrap' }}>{s.name}</span>
              {s.needsInput && (
                <span style={{ width: 6, height: 6, borderRadius: 3, background: '#f5b94a', boxShadow: '0 0 0 2px ' + (t.glass ? 'rgba(20,22,32,0.6)' : t.bg) }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shell — page wrapper. Provides full device frame + nav + status bar.
// When `sessions` is present, renders the global Session Strip and shifts
// page content down by STRIP_INSET (pages stay positionally unchanged).
// ─────────────────────────────────────────────────────────────
function Shell({ page, onPage, children, sessions, focusedId, onFocusSession }) {
  const t = useTheme();
  const showStrip = !!(sessions && sessions.length);
  const inset = showStrip ? STRIP_INSET : 0;
  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden',
      background: t.bg, color: t.fg, fontFamily: t.fontUI,
    }}>
      <Orbs />
      <StatusBar />
      {showStrip && <SessionStrip sessions={sessions} focusedId={focusedId} onFocus={onFocusSession} />}
      <div style={{ position: 'absolute', left: 0, right: 0, top: inset, bottom: 0 }}>
        {children}
      </div>
      <BottomNav page={page} onChange={onPage} />
      <HomeIndicator />
    </div>
  );
}

// helper — small icon-only button (themed)
function IconBtn({ children, onClick, style = {}, primary = false }) {
  const t = useTheme();
  const bg = primary
    ? (t.glass ? 'linear-gradient(135deg, #d97757, #c084fc)' : t.accent)
    : (t.glass ? 'rgba(255,255,255,0.10)' : t.surface);
  const fg = primary ? '#fff' : t.fg;
  return (
    <button onClick={onClick} style={{
      width: 32, height: 32, borderRadius: t.sharp ? 4 : 16, border: t.glass || primary ? 'none' : t.border,
      cursor: 'pointer', background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      ...style,
    }}>{children}</button>
  );
}

// keyframes for the avatar pulse + generic spinner (injected once)
if (typeof document !== 'undefined' && !document.getElementById('msc-anim')) {
  const s = document.createElement('style');
  s.id = 'msc-anim';
  s.textContent = '@keyframes msc-pulse{0%{box-shadow:0 0 0 0 rgba(217,119,87,0.5)}70%{box-shadow:0 0 0 7px rgba(217,119,87,0)}100%{box-shadow:0 0 0 0 rgba(217,119,87,0)}}@keyframes msc-spin{to{transform:rotate(360deg)}}@keyframes msc-blink{50%{opacity:0.25}}';
  document.head.appendChild(s);
}

Object.assign(window, { Shell, Surface, TopPill, BottomNav, StatusBar, HomeIndicator, IconBtn, ClaudeAvatar, SessionStrip, statusColor, NAV_PAGES, W, H, STRIP_INSET });
