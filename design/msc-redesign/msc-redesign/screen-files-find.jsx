/* global React, window, Screen, PageHeader */

// ============================================================
// Files screen
// ============================================================
function FilesScreen() {
  const recents = [
    { name:"charge.ts",       dir:"src/payments",       modified:true,  current:true  },
    { name:"webhook.test.ts", dir:"src/payments",       modified:true,  current:false },
    { name:"schema.sql",      dir:"db/migrations",      modified:false, current:false },
  ];

  const tree = [
    { type:"folder", name:".github",       depth:0, open:false },
    { type:"folder", name:"db",            depth:0, open:true  },
    { type:"folder", name:"migrations",    depth:1, open:true  },
    { type:"file",   name:"001_init.sql",       depth:2, modified:false },
    { type:"file",   name:"002_charges.sql",    depth:2, modified:false },
    { type:"file",   name:"schema.sql",         depth:2, modified:true  },
    { type:"folder", name:"src",            depth:0, open:true  },
    { type:"folder", name:"payments",       depth:1, open:true  },
    { type:"file",   name:"charge.ts",      depth:2, modified:true,  current:true },
    { type:"file",   name:"refund.ts",      depth:2, modified:false },
    { type:"file",   name:"webhook.ts",     depth:2, modified:false },
    { type:"file",   name:"webhook.test.ts",depth:2, modified:true  },
    { type:"folder", name:"shared",         depth:1, open:false },
    { type:"folder", name:"web",            depth:1, open:false },
    { type:"file",   name:"package.json",   depth:0, modified:false },
    { type:"file",   name:"tsconfig.json",  depth:0, modified:false },
    { type:"file",   name:"README.md",      depth:0, modified:false },
  ];

  return (
    <Screen activeTab="files">
      <PageHeader
        crumbs={["acme/payments", "main"]}
        title="payments"
        meta={<>284 files · <b style={{color:"var(--msc-accent)"}}>3 modified</b></>}
      />

      <div className="msc-body">
        <div style={{padding:"10px 16px 6px"}}>
          <input className="msc-input" placeholder="Filter files…"/>
        </div>

        <div className="msc-section-label">
          Recent
          <span className="spacer"/>
          <span className="action">clear</span>
        </div>
        <div style={{display:"flex", gap:8, padding:"0 16px 12px",
          overflowX:"auto"}}>
          {recents.map((r,i)=>(
            <div key={i} className="msc-card" style={{
              padding:"10px 12px",
              minWidth: 140,
              flex: "0 0 auto",
              borderColor: r.current ? "var(--msc-accent-dim)" : "var(--msc-border-soft)",
              background: r.current ? "color-mix(in oklch, var(--msc-accent), transparent 90%)" : "var(--msc-panel)",
            }}>
              <div style={{display:"flex", alignItems:"center", gap:6}}>
                <span style={{fontFamily:"var(--msc-mono)", fontSize:12,
                  color: r.current ? "var(--msc-accent)" : "var(--msc-fg)",
                  fontWeight: 500,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                  flex:1, minWidth:0,
                }}>{r.name}</span>
                {r.modified && <span style={{
                  width:5,height:5,borderRadius:"50%",background:"var(--msc-accent)"
                }}/>}
              </div>
              <div style={{fontFamily:"var(--msc-mono)", fontSize:10,
                color:"var(--msc-fg-dim)", marginTop:3,
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                {r.dir}
              </div>
            </div>
          ))}
        </div>

        <div className="msc-section-label">
          Files
          <span className="count">· 284</span>
          <span className="spacer"/>
          <span style={{fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-fg-dim)", textTransform:"none", letterSpacing:0}}>
            tap folder to expand
          </span>
        </div>

        <div style={{paddingBottom:8}}>
          {tree.map((row,i)=>(
            <div key={i} className={"msc-row" + (row.current?" current":"") + (row.type==="folder"?" folder":"")}
              style={{paddingLeft: 14 + row.depth*14, paddingRight:16}}>
              <span className="glyph" style={{color: row.type==="folder"?"var(--msc-fg-muted)":"var(--msc-fg-dim)"}}>
                {row.type==="folder" ? (row.open?"▾":"▸") : "·"}
              </span>
              <span className="name">
                {row.type==="folder" ? row.name+"/" : row.name}
              </span>
              {row.modified && <span className="dirty"/>}
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ============================================================
// Find screen
// ============================================================
function FindScreen() {
  const hits = [
    {
      file:"src/payments/charge.ts", count:3,
      lines:[
        { n:42, before:"  async function ", match:"chargeCard", after:"(card: Card, amt: Money) {" },
        { n:88, before:"    return ",       match:"chargeCard", after:"(card, parsed.amount);" },
        { n:104, before:"// TODO: split ",   match:"chargeCard", after:" into smaller helpers" },
      ],
    },
    {
      file:"src/payments/webhook.test.ts", count:2,
      lines:[
        { n:18, before:"    const result = await ", match:"chargeCard", after:"(testCard, USD(500));" },
        { n:64, before:"  it('rejects ",   match:"chargeCard", after:" when card is expired', async () => {" },
      ],
    },
    {
      file:"src/payments/refund.ts", count:1,
      lines:[
        { n:12, before:"// mirrors ", match:"chargeCard", after:" but credits instead of debits" },
      ],
    },
  ];

  return (
    <Screen activeTab="find">
      <PageHeader
        crumbs={["acme/payments", "main", "search"]}
        title="chargeCard"
        meta="6 matches · 3 files"
      />

      <div className="msc-body">
        <div style={{padding:"10px 16px 6px"}}>
          <input className="msc-input" defaultValue="chargeCard"
            style={{paddingLeft:32, position:"relative"}}/>
        </div>

        <div style={{padding:"4px 16px 10px", display:"flex", gap:6, flexWrap:"wrap"}}>
          <span className="msc-tag amber">case-sensitive</span>
          <span className="msc-tag">whole-word</span>
          <span className="msc-tag">regex</span>
          <span style={{flex:1}}/>
          <span className="msc-tag info">in: src/**</span>
        </div>

        {hits.map((h,i)=>(
          <div key={i}>
            <div className="msc-section-label" style={{paddingTop: i===0 ? 4 : 14}}>
              <span style={{textTransform:"none", letterSpacing:0,
                color:"var(--msc-fg-muted)", fontSize:11, fontWeight:500}}>{h.file}</span>
              <span className="count">· {h.count}</span>
              <span className="spacer"/>
              <span className="action">open ›</span>
            </div>
            <div style={{padding:"0 12px"}}>
              {h.lines.map((l,j)=>(
                <div key={j} className="msc-card" style={{
                  padding:"8px 10px",
                  marginBottom:6,
                  display:"flex", gap:10, alignItems:"baseline",
                  background:"var(--msc-panel)",
                }}>
                  <span style={{
                    fontFamily:"var(--msc-mono)", fontSize:10,
                    color:"var(--msc-fg-dim)", width:30,
                    flex:"0 0 30px", textAlign:"right",
                  }}>{l.n}</span>
                  <span style={{
                    fontFamily:"var(--msc-mono)", fontSize:11,
                    color:"var(--msc-fg-muted)", flex:1,
                    overflow:"hidden", textOverflow:"ellipsis",
                    whiteSpace:"nowrap",
                  }}>
                    {l.before}
                    <span style={{
                      background: "color-mix(in oklch, var(--msc-accent), transparent 70%)",
                      color:"var(--msc-fg)",
                      padding:"0 2px",
                      borderRadius:2,
                    }}>{l.match}</span>
                    {l.after}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

Object.assign(window, { FilesScreen, FindScreen });
