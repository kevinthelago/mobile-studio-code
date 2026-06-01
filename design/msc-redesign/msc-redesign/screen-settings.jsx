/* global React, window, Screen, PageHeader, SESSIONS */

// ============================================================
// Settings — reached from the session strip's ▦ overflow
// ============================================================
//
// Mobile settings is NOT a 7th bottom tab; it sits behind the
// strip's ▦ menu. Two screens:
//   1. SettingsScreen      · the grouped list
//   2. SettingsThemeScreen · the theme picker (MSC's useTheme)
// ============================================================

function SetRow({ ico, t, s, val, chev, toggle, on, last }) {
  return (
    <div className={"msc-set-row" + (chev||toggle!==undefined?" tap":"")}
      style={last?{borderBottom:0}:undefined}>
      {ico && <span className="ico">{ico}</span>}
      <div className="txt">
        <div className="t">{t}</div>
        {s && <div className="s">{s}</div>}
      </div>
      {val !== undefined && <span className="val">{val}</span>}
      {toggle !== undefined && <span className={"msc-toggle"+(on?" on":"")}/>}
      {chev && <span className="chev">›</span>}
    </div>
  );
}

function SetGroupLabel({ children, action }) {
  return (
    <div className="msc-section-label">
      {children}
      {action && <><span className="spacer"/><span className="action">{action}</span></>}
    </div>
  );
}

// ============================================================
// 1 · Main settings list
// ============================================================
function SettingsScreen() {
  return (
    <Screen activeTab={null}>
      <PageHeader
        crumbs={["base-studio-code", "settings"]}
        title="Settings"
        meta={<>v0.5.0 · <b style={{color:"var(--msc-success)"}}>● tunnel</b></>}
      />

      <div className="msc-body">

        {/* Account */}
        <div style={{padding:"12px 16px 4px"}}>
          <div className="msc-card" style={{padding:"14px", display:"flex", alignItems:"center", gap:12}}>
            <div style={{
              width:44, height:44, borderRadius:"50%", flex:"0 0 44px",
              background:"oklch(0.7 0.13 30)", color:"#1a120a",
              fontFamily:"var(--msc-mono)", fontWeight:700, fontSize:18,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>L</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:"var(--msc-sans)", fontSize:14, color:"var(--msc-fg)", fontWeight:500}}>Lina Engelbrecht</div>
              <div style={{fontFamily:"var(--msc-mono)", fontSize:10.5, color:"var(--msc-fg-dim)", marginTop:2}}>
                lina@acme.com · github lina-engelbrecht
              </div>
            </div>
            <span style={{
              padding:"4px 10px", borderRadius:5,
              background:"var(--msc-elev)", border:"1px solid var(--msc-border-soft)",
              fontFamily:"var(--msc-mono)", fontSize:10.5, color:"var(--msc-accent)",
            }}>manage</span>
          </div>
        </div>

        {/* Tunnel & host — the most important block for this product */}
        <SetGroupLabel action="re-pair">Tunnel &amp; host</SetGroupLabel>
        <div className="msc-set-group">
          <div className="msc-set-row">
            <span className="ico" style={{color:"var(--msc-success)"}}>⇋</span>
            <div className="txt">
              <div className="t">Connected to desktop</div>
              <div className="s">base-studio-code · MacBook Pro · mbp-lina</div>
            </div>
            <span className="val" style={{color:"var(--msc-success)"}}>
              <span style={{width:7, height:7, borderRadius:"50%", background:"var(--msc-success)"}}/>
              28ms
            </span>
          </div>
          <SetRow ico="⌁" t="Transport" s="LAN direct · 192.168.4.22:7878" val="LAN" chev/>
          <SetRow ico="↻" t="Relay fallback" s="use cloud relay if LAN route drops" toggle on/>
          <SetRow ico="⏻" t="Auto-reconnect" toggle on/>
          <SetRow ico="⊘" t="Disconnect tunnel" s="return to pairing screen" chev last/>
        </div>

        {/* Sessions */}
        <SetGroupLabel action="manage">Sessions</SetGroupLabel>
        <div className="msc-set-group">
          <SetRow ico="◳" t="Active sessions" val={`${SESSIONS.length} panes`} chev/>
          <SetRow ico="⊕" t="Default tab on open" val="Files" chev/>
          <SetRow ico="◷" t="Keep panes warm" s="hold session state for 30 min after disconnect" toggle on/>
          <SetRow ico="✦" t="Stream Claude tokens" s="render output as it arrives" toggle on last/>
        </div>

        {/* Appearance */}
        <SetGroupLabel>Appearance</SetGroupLabel>
        <div className="msc-set-group">
          <div className="msc-set-row tap">
            <span className="ico">◐</span>
            <div className="txt">
              <div className="t">Theme</div>
              <div className="s">5 themes · synced from desktop</div>
            </div>
            <span className="val">
              <span style={{display:"flex", gap:3}}>
                {["oklch(0.8 0.14 70)","oklch(0.74 0.13 145)","oklch(0.72 0.1 230)"].map((c,i)=>(
                  <span key={i} style={{width:10, height:10, borderRadius:"50%", background:c}}/>
                ))}
              </span>
              Dawn
            </span>
            <span className="chev">›</span>
          </div>
          <SetRow ico="A" t="Editor font size" val="13px" chev/>
          <SetRow ico="↹" t="Tab labels" s="show text under bottom-tab glyphs" toggle on/>
          <SetRow ico="⊟" t="Compact density" s="match desktop's tighter spacing" toggle last/>
        </div>

        {/* Editor & code */}
        <SetGroupLabel>Editor &amp; code</SetGroupLabel>
        <div className="msc-set-group">
          <SetRow ico="⏎" t="Soft wrap" toggle on/>
          <SetRow ico="#" t="Line numbers" toggle on/>
          <SetRow ico="⇥" t="Tab width" val="2" chev/>
          <SetRow ico="✓" t="Format on save" s="runs the project formatter via tunnel" toggle on last/>
        </div>

        {/* Notifications */}
        <SetGroupLabel>Notifications</SetGroupLabel>
        <div className="msc-set-group">
          <SetRow ico="◉" t="Pane awaiting input" s="push when an agent needs you" toggle on/>
          <SetRow ico="▶" t="Run finished" toggle on/>
          <SetRow ico="✗" t="Run failed" toggle on/>
          <SetRow ico="◰" t="Planning question" s="when a scoping session needs an answer" toggle on last/>
        </div>

        {/* About */}
        <SetGroupLabel>About</SetGroupLabel>
        <div className="msc-set-group">
          <SetRow ico="ℹ" t="Version" val="0.5.0 (build 412)"/>
          <SetRow ico="◫" t="Desktop host version" val="0.5.0" chev/>
          <SetRow ico="⎋" t="Diagnostics &amp; logs" chev/>
          <SetRow ico="⊘" t="Sign out" s="lina@acme.com" chev last/>
        </div>

        <div style={{height:18}}/>
      </div>
    </Screen>
  );
}

// ============================================================
// 2 · Theme picker (MSC useTheme)
// ============================================================
const MSC_THEMES = [
  { id:"dawn",     name:"Dawn",     on:true,
    bg:"oklch(0.16 0.01 60)",  bars:["oklch(0.8 0.14 70)","oklch(0.5 0.02 60)","oklch(0.35 0.01 60)"] },
  { id:"glass",    name:"Glass",
    bg:"oklch(0.22 0.02 250)", bars:["oklch(0.78 0.1 230)","oklch(0.45 0.03 250)","oklch(0.32 0.02 250)"] },
  { id:"terminal", name:"Terminal",
    bg:"oklch(0.14 0.02 150)", bars:["oklch(0.8 0.18 145)","oklch(0.4 0.04 150)","oklch(0.25 0.02 150)"] },
  { id:"paper",    name:"Paper",
    bg:"oklch(0.94 0.01 90)",  bars:["oklch(0.55 0.12 30)","oklch(0.75 0.02 90)","oklch(0.85 0.01 90)"] },
  { id:"basic",    name:"Basic",
    bg:"oklch(0.18 0 0)",      bars:["oklch(0.85 0 0)","oklch(0.45 0 0)","oklch(0.3 0 0)"] },
];

function SettingsThemeScreen() {
  return (
    <Screen activeTab={null}>
      <PageHeader
        crumbs={["settings", "appearance", "theme"]}
        title="Theme"
        meta={<>synced w/ desktop</>}
      />

      <div className="msc-body">
        <SetGroupLabel>Choose a theme</SetGroupLabel>
        <div className="msc-theme-grid">
          {MSC_THEMES.map(t=>(
            <div key={t.id} className={"msc-theme-card"+(t.on?" on":"")}>
              <div className="msc-theme-swatch" style={{background:t.bg}}>
                {t.bars.map((b,i)=>(
                  <div key={i} className="bar" style={{
                    background:b, width: i===0?"60%":i===1?"85%":"40%",
                  }}/>
                ))}
              </div>
              <div className="msc-theme-meta">
                {t.name}
                {t.on && <span className="check">✓</span>}
              </div>
            </div>
          ))}
        </div>

        <SetGroupLabel>Sync</SetGroupLabel>
        <div className="msc-set-group">
          <SetRow ico="⇋" t="Follow desktop theme" s="match whatever base-studio-code uses" toggle on/>
          <SetRow ico="◐" t="Auto dark / light" s="by system appearance" toggle last/>
        </div>

        <div style={{padding:"4px 16px", fontFamily:"var(--msc-mono)", fontSize:10,
          color:"var(--msc-fg-dim)", lineHeight:1.5}}>
          Themes map 1:1 to the desktop's <span style={{color:"var(--msc-fg-muted)"}}>useTheme()</span> tokens.
          Picking one here only changes this device unless "Follow desktop theme" is on.
        </div>

        <div style={{height:18}}/>
      </div>
    </Screen>
  );
}

Object.assign(window, { SettingsScreen, SettingsThemeScreen });
