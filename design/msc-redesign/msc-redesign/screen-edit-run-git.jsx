/* global React, window, Screen, PageHeader, SESSIONS */

// ============================================================
// Edit screen — code view + collapsed chat dock
// ============================================================
function EditScreen() {
  const lines = [
    { n:38, t:[ {c:"kw",s:"export"}, {s:" "}, {c:"kw",s:"async"}, {s:" "}, {c:"kw",s:"function"}, {s:" "}, {c:"fn",s:"chargeCard"}, {s:"("} ] },
    { n:39, t:[ {s:"  card: "}, {c:"ty",s:"Card"}, {s:","} ] },
    { n:40, t:[ {s:"  amount: "}, {c:"ty",s:"Money"}, {s:","} ] },
    { n:41, t:[ {s:"  opts: "}, {c:"ty",s:"ChargeOptions"}, {s:" = {},"} ] },
    { n:42, t:[ {s:"): "}, {c:"ty",s:"Promise"}, {s:"<"}, {c:"ty",s:"ChargeResult"}, {s:"> {"} ] },
    { n:43, t:[ {s:"  "}, {c:"kw",s:"const"}, {s:" "}, {c:"nm",s:"idempotencyKey"}, {s:" = opts.key ?? "}, {c:"fn",s:"randomKey"}, {s:"();"} ] },
    { n:44, t:[ {s:""} ] },
    { n:45, t:[ {s:"  "}, {c:"kw",s:"if"}, {s:" (card."}, {c:"nm",s:"expired"}, {s:") {"} ] },
    { n:46, t:[ {s:"    "}, {c:"kw",s:"throw"}, {s:" "}, {c:"kw",s:"new"}, {s:" "}, {c:"ty",s:"CardExpiredError"}, {s:"(card.last4);"} ] },
    { n:47, t:[ {s:"  }"} ] },
    { n:48, t:[ {s:""} ] },
    { n:49, t:[ {s:"  "}, {c:"kw",s:"const"}, {s:" "}, {c:"nm",s:"intent"}, {s:" = "}, {c:"kw",s:"await"}, {s:" "}, {c:"fn",s:"stripe.paymentIntents.create"}, {s:"({"} ] },
    { n:50, t:[ {s:"    amount: amount."}, {c:"fn",s:"toCents"}, {s:"(),"} ] },
    { n:51, t:[ {s:"    currency: amount.currency,"} ] },
    { n:52, t:[ {s:"    payment_method: card.id,"} ] },
    { n:53, t:[ {s:"    confirm: "}, {c:"kw",s:"true"}, {s:","} ] },
    { n:54, t:[ {s:"  });"} ] },
  ];

  return (
    <Screen activeTab="edit">
      <PageHeader
        crumbs={["src", "payments"]}
        title="charge.ts"
        meta={<>typescript · <b style={{color:"var(--msc-accent)"}}>● modified</b></>}
        right={
          <button className="msc-btn small" style={{flex:"0 0 auto"}}>save</button>
        }
      />

      <div className="msc-body" style={{paddingTop:6, paddingBottom:0,
        display:"flex", flexDirection:"column"}}>

        {/* Code viewport */}
        <div style={{flex:1, overflow:"auto", padding:"6px 12px 12px"}}>
          <div className="msc-code">
            {lines.map(l=>(
              <div key={l.n}>
                <span className="ln-no">{l.n}</span>
                {l.t.map((tok,i)=>(
                  <span key={i} className={tok.c||""}>{tok.s}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Chat dock — Claude inline */}
        <div style={{
          borderTop:"1px solid var(--msc-border-soft)",
          background:"var(--msc-panel)",
          flex:"0 0 auto",
        }}>
          <div style={{padding:"8px 12px 6px",
            display:"flex", alignItems:"center", gap:8}}>
            <span style={{width:8, height:8, borderRadius:"50%",
              background:"var(--msc-success)",
              boxShadow:"0 0 0 3px color-mix(in oklch, var(--msc-success), transparent 75%)"}}/>
            <span style={{fontFamily:"var(--msc-mono)", fontSize:10.5, color:"var(--msc-fg-muted)"}}>
              @scratch · idle
            </span>
            <span style={{flex:1}}/>
            <span className="msc-tag amber">3 tools used</span>
          </div>

          <div className="msc-chat-tool">
            <span className="arrow">→</span>
            read_file
            <span style={{color:"var(--msc-fg-dim)"}}>('src/payments/refund.ts')</span>
            <span className="ok">✓</span>
          </div>

          <div className="msc-chat-msg claude">
            Both <span className="msc-kbd">charge.ts</span> and <span className="msc-kbd">refund.ts</span> roll their own idempotency key. I can lift it into <span className="msc-kbd">shared/idempotency.ts</span> — keep going?
          </div>

          <div style={{
            padding:"8px 10px", display:"flex", gap:8, alignItems:"flex-end",
            borderTop:"1px solid var(--msc-border-soft)",
            background:"var(--msc-bg)",
          }}>
            <div style={{flex:1, background:"var(--msc-elev)",
              border:"1px solid var(--msc-border-soft)", borderRadius:8,
              padding:"8px 10px", minHeight:36,
              fontFamily:"var(--msc-mono)", fontSize:12.5, color:"var(--msc-fg-muted)"}}>
              <span style={{color:"var(--msc-accent)"}}>›</span> yes, do it — and run the webhook tests after
            </div>
            <button className="msc-btn primary icon" style={{height:36, width:36}}>↑</button>
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ============================================================
// Run screen — sessions grid (multi-session view)
// ============================================================
function RunScreen() {
  const cards = [
    {
      name:"@scratch", proj:"acme/payments", status:"running",
      task:"Refactor idempotency keys into shared/", last:"4s ago",
      preview:"Reading src/payments/refund.ts…",
      waiting:false,
    },
    {
      name:"@reviewer", proj:"acme/payments", status:"awaiting",
      task:"Review PR #284 — split chargeCard", last:"1m ago",
      preview:"I have 3 concerns about the refund.ts changes. Apply review comments? (y/n)",
      waiting:true,
    },
    {
      name:"@docs", proj:"acme/web", status:"idle",
      task:"Draft launch post for /v2", last:"22m ago",
      preview:"Saved draft to drafts/2026-05-v2.md (412 words). Awaiting next prompt.",
      waiting:false,
    },
    {
      name:"@github", proj:"acme/payments", status:"running",
      task:"Triage open issues", last:"38s ago",
      preview:"Posted summary on #312 · 14 open issues remaining",
      waiting:false,
    },
    {
      name:"@scratch", proj:"acme/ledger-core", status:"idle",
      task:"—", last:"4h ago",
      preview:"",
      waiting:false,
    },
  ];

  return (
    <Screen activeTab="run">
      <PageHeader
        crumbs={["base-studio-code", "macbook-pro"]}
        title="Sessions"
        meta={<>5 active · <b style={{color:"var(--msc-warn)"}}>1 awaiting input</b></>}
        right={
          <button className="msc-btn small">disconnect</button>
        }
      />

      <div className="msc-body">
        <div style={{padding:"10px 12px 4px",
          display:"flex", gap:6, flexWrap:"wrap"}}>
          <span className="msc-tag amber">all · 5</span>
          <span className="msc-tag">running · 2</span>
          <span className="msc-tag warn">awaiting · 1</span>
          <span className="msc-tag">idle · 2</span>
        </div>

        <div style={{padding:"8px 12px 12px", display:"flex", flexDirection:"column", gap:8}}>
          {cards.map((c,i)=>(
            <div key={i} className="msc-card" style={{
              padding:"12px 14px",
              borderColor: c.waiting ? "var(--msc-warn)" : "var(--msc-border-soft)",
              borderLeft: c.waiting ? "2px solid var(--msc-warn)" : "1px solid var(--msc-border-soft)",
              paddingLeft: c.waiting ? 13 : 14,
            }}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <span className={"msc-dot " + (c.status==="running"?"":c.status==="awaiting"?"warn":"idle")}/>
                <span style={{fontFamily:"var(--msc-mono)", fontSize:12.5, color:"var(--msc-fg)", fontWeight:500}}>
                  {c.name}
                </span>
                <span className="msc-tag" style={{fontSize:9}}>{c.proj}</span>
                <span style={{flex:1}}/>
                <span style={{fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-fg-dim)"}}>
                  {c.last}
                </span>
              </div>

              {c.task !== "—" && (
                <div style={{
                  marginTop:7,
                  fontFamily:"var(--msc-sans)", fontSize:12,
                  color:"var(--msc-fg-muted)", lineHeight:1.45,
                }}>{c.task}</div>
              )}

              {c.preview && (
                <div style={{
                  marginTop:7,
                  padding:"6px 8px", borderRadius:5,
                  background: c.waiting ? "color-mix(in oklch, var(--msc-warn), transparent 88%)" : "var(--msc-elev)",
                  border:"1px solid " + (c.waiting ? "color-mix(in oklch, var(--msc-warn), transparent 70%)" : "var(--msc-border-soft)"),
                  fontFamily:"var(--msc-mono)", fontSize:10.5,
                  color: c.waiting ? "var(--msc-warn)" : "var(--msc-fg-muted)",
                  lineHeight:1.5,
                  display:"-webkit-box",
                  WebkitLineClamp:2,
                  WebkitBoxOrient:"vertical",
                  overflow:"hidden",
                }}>
                  {c.waiting && <span style={{fontWeight:700, marginRight:4}}>?</span>}
                  {c.preview}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ============================================================
// Git screen
// ============================================================
function GitScreen() {
  const changes = [
    { st:"M", path:"src/payments/charge.ts",       add:14, del:6 },
    { st:"M", path:"src/payments/webhook.test.ts", add: 22, del: 0 },
    { st:"M", path:"db/migrations/schema.sql",     add: 3, del: 1 },
    { st:"A", path:"src/shared/idempotency.ts",    add:48, del: 0 },
  ];

  return (
    <Screen activeTab="git">
      <PageHeader
        crumbs={["acme/payments", "main"]}
        title="main"
        meta={<>4 changed · <b style={{color:"var(--msc-accent)"}}>+87 / -7</b></>}
        right={
          <button className="msc-btn primary small">push</button>
        }
      />

      <div className="msc-body">
        <div style={{padding:"10px 12px",
          display:"flex", gap:6, alignItems:"center"}}>
          <button className="msc-btn small ghost">
            ↻ pull
          </button>
          <span style={{flex:1}}/>
          <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)"}}>
            synced 4m ago · 2 commits ahead
          </span>
        </div>

        <div className="msc-section-label">
          Changes <span className="count">· 4</span>
          <span className="spacer"/>
          <span className="action">stage all</span>
        </div>

        <div style={{padding:"0 12px 12px", display:"flex", flexDirection:"column", gap:6}}>
          {changes.map((c,i)=>(
            <div key={i} className="msc-card" style={{
              padding:"10px 12px",
              display:"flex", alignItems:"center", gap:10,
            }}>
              <span style={{
                width:18, height:18, borderRadius:4,
                background: c.st==="A" ? "color-mix(in oklch, var(--msc-success), transparent 80%)"
                                       : "color-mix(in oklch, var(--msc-accent), transparent 80%)",
                color: c.st==="A" ? "var(--msc-success)" : "var(--msc-accent)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"var(--msc-mono)", fontSize:10, fontWeight:600,
                flex:"0 0 18px",
              }}>{c.st}</span>
              <span style={{
                flex:1, minWidth:0,
                fontFamily:"var(--msc-mono)", fontSize:11.5,
                color:"var(--msc-fg)",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              }}>{c.path}</span>
              <span style={{
                fontFamily:"var(--msc-mono)", fontSize:10,
                color:"var(--msc-success)",
              }}>+{c.add}</span>
              <span style={{
                fontFamily:"var(--msc-mono)", fontSize:10,
                color:"var(--msc-fg-dim)",
              }}>−{c.del}</span>
            </div>
          ))}
        </div>

        <div className="msc-section-label">
          Commit message
          <span className="spacer"/>
          <span className="action">↻ regenerate</span>
        </div>

        <div style={{padding:"0 12px 12px"}}>
          <div className="msc-card" style={{padding:"12px 14px"}}>
            <div style={{
              display:"flex", alignItems:"center", gap:6, marginBottom:8,
              fontFamily:"var(--msc-mono)", fontSize:9.5,
              color:"var(--msc-fg-dim)", textTransform:"uppercase", letterSpacing:".06em",
            }}>
              <span style={{
                width:6, height:6, borderRadius:"50%",
                background:"var(--msc-accent)",
                boxShadow:"0 0 0 3px color-mix(in oklch, var(--msc-accent), transparent 75%)",
              }}/>
              drafted by @scratch · edit before commit
            </div>
            <div style={{
              fontFamily:"var(--msc-mono)", fontSize:12.5, color:"var(--msc-fg)",
              lineHeight:1.5, fontWeight:500,
            }}>
              feat(payments): lift idempotency-key generation into shared/
            </div>
            <div style={{
              marginTop:8,
              fontFamily:"var(--msc-sans)", fontSize:11.5, color:"var(--msc-fg-muted)",
              lineHeight:1.55,
            }}>
              charge.ts and refund.ts had near-identical key generators. Extract to <span className="msc-kbd">shared/idempotency.ts</span>, add a test, and bump <span className="msc-kbd">schema.sql</span> to drop the redundant unique index.
            </div>
            <div style={{
              marginTop:10, display:"flex", gap:6, flexWrap:"wrap",
            }}>
              <span className="msc-tag">closes #284</span>
              <span className="msc-tag">refs #312</span>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

Object.assign(window, { EditScreen, RunScreen, GitScreen });
