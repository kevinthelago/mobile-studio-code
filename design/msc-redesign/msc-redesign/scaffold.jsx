/* global React, window */

// ============================================================
// Shared scaffold — top strip + body + bottom tabs
// ============================================================

const SESSIONS = [
  { id:"sp-1", name:"@scratch",  proj:"acme/payments", status:"running", waiting:false },
  { id:"sp-2", name:"@reviewer", proj:"acme/payments", status:"awaiting", waiting:true  },
  { id:"sp-3", name:"@docs",     proj:"acme/web",       status:"idle",    waiting:false },
  { id:"sp-4", name:"@github",   proj:"acme/payments",  status:"running", waiting:false },
  { id:"sp-5", name:"@scratch",  proj:"acme/ledger-core", status:"idle", waiting:false },
];

const TAB_ITEMS = [
  { key:"files", label:"Files", glyph:"▤" },
  { key:"find",  label:"Find",  glyph:"⌕" },
  { key:"edit",  label:"Edit",  glyph:"▢" },
  { key:"run",   label:"Run",   glyph:"▶" },
  { key:"git",   label:"Git",   glyph:"⌥" },
  { key:"plan",  label:"Plan",  glyph:"▩" },
];

function SessionStrip({ activeId="sp-1", showPip=true, showMenu=true, tunnel=true }) {
  if (!tunnel) {
    return (
      <div className="msc-strip">
        <span className="msc-strip-tunnel" style={{
          background: "color-mix(in oklch, var(--msc-warn), transparent 88%)",
          borderColor: "color-mix(in oklch, var(--msc-warn), transparent 65%)",
          color: "var(--msc-warn)",
        }}>
          <span className="tunnel-dot" style={{
            background:"var(--msc-warn)",
            boxShadow:"0 0 0 2px color-mix(in oklch, var(--msc-warn), transparent 75%)",
            animation:"none",
          }}/>
          <span className="tunnel-arrow">⇋</span>
          tunnel offline
        </span>
        <span style={{
          fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)",
          marginLeft:4,
        }}>
          no sessions
        </span>
        <span style={{flex:1}}/>
        {showMenu && <span className="msc-strip-more">▦</span>}
      </div>
    );
  }
  return (
    <div className="msc-strip">
      <span className="msc-strip-tunnel" title="connected to base-studio-code on MacBook Pro">
        <span className="tunnel-dot"/>
        <span className="tunnel-arrow">⇋</span>
      </span>
      {SESSIONS.map(s=>{
        const on = s.id===activeId;
        const dotCls =
          s.status==="running" ? "" :
          s.status==="awaiting" ? "warn" :
          s.status==="error" ? "err" : "idle";
        return (
          <span key={s.id} className={"msc-strip-chip" + (on?" active":"")}>
            <span className={"dot "+dotCls}></span>
            {s.name}
            {s.waiting && showPip && <span className="pip"></span>}
          </span>
        );
      })}
      {showMenu && <span className="msc-strip-more">▦</span>}
    </div>
  );
}

function PageHeader({ crumbs, title, meta, right }) {
  return (
    <div className="msc-head">
      {crumbs && (
        <div className="crumbs">
          {crumbs.map((c,i)=>(
            <React.Fragment key={i}>
              {i>0 && <span className="sep">›</span>}
              <b>{c}</b>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="row">
        {title && <h1>{title}</h1>}
        {meta && <span className="meta">{meta}</span>}
        {right}
      </div>
    </div>
  );
}

function BottomTabs({ active="files" }) {
  return (
    <div className="msc-tabs">
      {TAB_ITEMS.map(t=>{
        const on = t.key===active;
        const pip = t.key==="run"; // pretend pending input on Run
        return (
          <div key={t.key} className={"tab"+(on?" on":"")}>
            <span className="glyph">{t.glyph}</span>
            <span>{t.label}</span>
            {pip && !on && <span className="pip"></span>}
          </div>
        );
      })}
    </div>
  );
}

function Screen({ activeTab="files", activeSessionId="sp-1", showStrip=true, tunnel=true, children }) {
  return (
    <div className="msc">
      {showStrip && <SessionStrip activeId={activeSessionId} tunnel={tunnel}/>}
      {children}
      <BottomTabs active={activeTab}/>
    </div>
  );
}

Object.assign(window, {
  SESSIONS, TAB_ITEMS,
  SessionStrip, PageHeader, BottomTabs, Screen,
});
