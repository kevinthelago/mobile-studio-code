/* global React, window, Screen, PageHeader, SessionStrip, BottomTabs, SESSIONS */

// ============================================================
// Session-switcher overlay (drawer from top)
// ============================================================
function SessionSwitcherScreen() {
  const detailed = [
    { name:"@scratch",  proj:"acme/payments",      status:"running",  task:"Refactor idempotency keys", last:"4s ago",  waiting:false, pinned:["edit"] },
    { name:"@reviewer", proj:"acme/payments",      status:"awaiting", task:"Review PR #284",            last:"1m ago",  waiting:true,  pinned:[] },
    { name:"@docs",     proj:"acme/web",           status:"idle",     task:"Draft launch post",         last:"22m ago", waiting:false, pinned:[] },
    { name:"@github",   proj:"acme/payments",      status:"running",  task:"Triage open issues",        last:"38s ago", waiting:false, pinned:["git"] },
    { name:"@scratch",  proj:"acme/ledger-core",   status:"idle",     task:"—",                          last:"4h ago",  waiting:false, pinned:[] },
  ];

  return (
    <div className="msc">
      {/* Base content (faded) */}
      <SessionStrip activeId="sp-1"/>

      <div style={{
        position:"relative", flex:1, overflow:"hidden",
        background:"var(--msc-bg)",
      }}>
        {/* dimmed underneath */}
        <div style={{
          position:"absolute", inset:0, opacity:0.25, pointerEvents:"none",
          filter:"blur(1px)",
        }}>
          <div className="msc-head">
            <div className="crumbs"><b>acme/payments</b><span className="sep">›</span><b>main</b></div>
            <div className="row"><h1>payments</h1></div>
          </div>
        </div>

        {/* scrim */}
        <div style={{
          position:"absolute", inset:0,
          background:"color-mix(in oklch, #000, transparent 40%)",
        }}/>

        {/* drawer sheet */}
        <div style={{
          position:"absolute", left:0, right:0, top:0,
          background:"var(--msc-panel)",
          borderBottom:"1px solid var(--msc-border-soft)",
          borderBottomLeftRadius:16,
          borderBottomRightRadius:16,
          maxHeight:"100%",
          display:"flex", flexDirection:"column",
          boxShadow:"0 12px 40px rgba(0,0,0,.5)",
        }}>
          {/* grabber */}
          <div style={{
            display:"flex", justifyContent:"center", padding:"8px 0 4px",
          }}>
            <div style={{width:36, height:4, borderRadius:99, background:"var(--msc-border)"}}/>
          </div>

          <div style={{
            padding:"4px 16px 10px",
            display:"flex", alignItems:"center", gap:10,
            borderBottom:"1px solid var(--msc-border-soft)",
          }}>
            <span style={{
              fontFamily:"var(--msc-mono)", fontSize:13, fontWeight:600, color:"var(--msc-fg)",
            }}>Sessions</span>
            <span style={{
              fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)",
            }}>connected · macbook-pro</span>
            <span style={{flex:1}}/>
            <button className="msc-btn small ghost">disconnect</button>
            <button className="msc-btn small primary">+ new</button>
          </div>

          {/* filter row */}
          <div style={{padding:"8px 16px", display:"flex", gap:6, flexWrap:"wrap",
            borderBottom:"1px solid var(--msc-border-soft)"}}>
            <span className="msc-tag amber">all · {detailed.length}</span>
            <span className="msc-tag warn">awaiting · 1</span>
            <span className="msc-tag">running · 2</span>
            <span className="msc-tag">idle · 2</span>
          </div>

          {/* group: acme/payments */}
          <div className="msc-section-label" style={{paddingTop:10}}>
            acme/payments
            <span className="count">· 3</span>
          </div>
          {detailed.filter(d=>d.proj==="acme/payments").map((d,i)=>(
            <SessionRow key={i} d={d} active={i===0}/>
          ))}

          <div className="msc-section-label">
            acme/web <span className="count">· 1</span>
          </div>
          {detailed.filter(d=>d.proj==="acme/web").map((d,i)=>(
            <SessionRow key={i} d={d}/>
          ))}

          <div className="msc-section-label">
            acme/ledger-core <span className="count">· 1</span>
          </div>
          {detailed.filter(d=>d.proj==="acme/ledger-core").map((d,i)=>(
            <SessionRow key={i} d={d}/>
          ))}

          {/* footer */}
          <div style={{
            padding:"10px 16px",
            borderTop:"1px solid var(--msc-border-soft)",
            background:"var(--msc-bg)",
            display:"flex", alignItems:"center", gap:8,
            fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)",
          }}>
            <span className="msc-kbd">swipe ←</span>
            <span>next session</span>
            <span style={{flex:1}}/>
            <span className="msc-kbd">⌥+1..5</span>
            <span>jump</span>
          </div>
        </div>
      </div>

      <BottomTabs active="edit"/>
    </div>
  );
}

function SessionRow({ d, active=false }) {
  return (
    <div style={{
      padding:"10px 16px",
      borderLeft: active ? "2px solid var(--msc-accent)" : "2px solid transparent",
      paddingLeft: active ? 14 : 16,
      background: active ? "color-mix(in oklch, var(--msc-accent), transparent 92%)" : "transparent",
      borderBottom:"1px solid var(--msc-border-soft)",
      display:"flex", alignItems:"center", gap:10,
    }}>
      <span className={"msc-dot " + (d.status==="running"?"":d.status==="awaiting"?"warn":"idle")}/>

      <div style={{flex:1, minWidth:0}}>
        <div style={{display:"flex", alignItems:"center", gap:6}}>
          <span style={{
            fontFamily:"var(--msc-mono)", fontSize:12, fontWeight:500,
            color: active ? "var(--msc-accent)" : "var(--msc-fg)",
          }}>{d.name}</span>
          {d.waiting && <span className="msc-tag warn" style={{fontSize:8.5, padding:"0 5px"}}>input</span>}
          {d.pinned.map(p=>(
            <span key={p} className="msc-tag info" style={{fontSize:8.5, padding:"0 5px"}}>
              📌{p}
            </span>
          ))}
        </div>
        {d.task !== "—" ? (
          <div style={{
            marginTop:3,
            fontFamily:"var(--msc-sans)", fontSize:11.5,
            color:"var(--msc-fg-muted)",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>{d.task}</div>
        ) : (
          <div style={{
            marginTop:3,
            fontFamily:"var(--msc-mono)", fontSize:10,
            color:"var(--msc-fg-dim)",
          }}>no current task</div>
        )}
      </div>

      <span style={{
        fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)",
      }}>{d.last}</span>

      <span style={{
        fontFamily:"var(--msc-mono)", fontSize:11,
        color:"var(--msc-fg-dim)",
      }}>›</span>
    </div>
  );
}

Object.assign(window, { SessionSwitcherScreen });
