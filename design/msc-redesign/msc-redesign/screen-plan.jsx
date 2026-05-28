/* global React, window, Screen, PageHeader, SESSIONS */

// ============================================================
// Plan — tunneled to base-studio-code
// ============================================================
//
// Five sub-screens, one tab. The mental model:
//   "I'm looking at the same Project Planning surface
//    my desktop is hosting — through the tunnel."
//
//   1. PlanProjectsScreen  · the project list
//   2. PlanBoardScreen     · kanban for one project
//   3. PlanIssueScreen     · issue + AI subtask breakdown
//   4. PlanScopingScreen   · live planning session w/ Claude
//   5. PlanPairingScreen   · the tunnel pairing handshake
// ============================================================

// shared visual constants — kept identical to the desktop so a
// mobile chip and a desktop chip read as the same thing.
const PLAN_PEOPLE = {
  lina:  { color:"oklch(0.7 0.13 30)",  initial:"L" },
  alex:  { color:"oklch(0.7 0.10 220)", initial:"A" },
  pete:  { color:"oklch(0.68 0.13 145)",initial:"P" },
  zara:  { color:"oklch(0.7 0.12 290)", initial:"Z" },
  bot:   { color:"oklch(0.45 0 0)",     initial:"⌬" },
};
const PLAN_LABELS = {
  net:        { c:"oklch(0.72 0.13 250)", t:"net" },
  perf:       { c:"oklch(0.78 0.14 70)",  t:"perf" },
  security:   { c:"oklch(0.7 0.18 25)",   t:"security" },
  docs:       { c:"oklch(0.7 0.06 90)",   t:"docs" },
  refactor:   { c:"oklch(0.68 0.05 280)", t:"refactor" },
  api:        { c:"oklch(0.72 0.12 175)", t:"api" },
  infra:      { c:"oklch(0.65 0.08 195)", t:"infra" },
  test:       { c:"oklch(0.72 0.10 145)", t:"test" },
};

const PLAN_PROJECTS = [
  { id:"prj_31a", gh:14, name:"Settlement webhooks v2",
    pitch:"Sub-second merchant dashboard notifications via webhook fanout.",
    repo:"acme/payments", iteration:"Iter 24 · ends Fri",
    open:17, total:23, prs:3, mile:5, owner:"lina",
    last:"4m ago", planning:false, host:true },
  { id:"prj_2fa", gh:15, name:"Offline pairing mode",
    pitch:"Same-LAN desktop ↔ mobile pairing without relay round-trip.",
    repo:"acme/payments", iteration:"drafting",
    open:0, total:0, prs:0, mile:0, owner:"lina",
    last:"yesterday", planning:true, progress:0.38, host:true },
  { id:"prj_27e", gh:9,  name:"Knowledge → Notion sync",
    pitch:"One-way mirror of selected #docs blocks into a Notion workspace.",
    repo:"acme/docs", iteration:"Iter 12 · ends Wed",
    open:9, total:18, prs:1, mile:4, owner:"alex",
    last:"2d ago", host:false },
];

// ============================================================
// 1 · Project list
// ============================================================
function PlanProjectsScreen() {
  return (
    <Screen activeTab="plan">
      <PageHeader
        crumbs={["base-studio-code", "via tunnel", "projects"]}
        title="Plan"
        meta={<><b style={{color:"var(--msc-success)"}}>● tunnel</b> · mbp-lina · 4m</>}
      />

      <div className="msc-body">
        <div style={{padding:"10px 16px 6px"}}>
          <input className="msc-input" placeholder="Filter projects…"/>
        </div>

        {/* Resume planning CTA */}
        <div style={{padding:"8px 16px 4px"}}>
          <div className="msc-card" style={{
            padding:"12px 14px",
            background:"linear-gradient(135deg, color-mix(in oklch, var(--msc-accent), transparent 86%), var(--msc-panel) 70%)",
            border:"1px solid var(--msc-accent-dim)",
          }}>
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
              <div style={{
                width:22, height:22, borderRadius:5,
                background:"linear-gradient(135deg, var(--msc-accent), oklch(0.62 0.14 50))",
                color:"#1a120a", fontFamily:"var(--msc-mono)", fontWeight:700, fontSize:11,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>C</div>
              <span style={{fontFamily:"var(--msc-mono)", fontSize:11.5, color:"var(--msc-fg)"}}>Plan a new project</span>
              <span style={{flex:1}}/>
              <span style={{fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-fg-dim)"}}>~8 min</span>
            </div>
            <div style={{
              padding:"8px 10px",
              background:"var(--msc-bg)",
              border:"1px solid var(--msc-border-soft)",
              borderRadius:6,
              fontFamily:"var(--msc-mono)", fontSize:11,
              color:"var(--msc-fg-dim)",
            }}>
              <span style={{color:"var(--msc-accent)"}}>▸</span>{" "}
              pitch what you want to build…
            </div>
          </div>
        </div>

        <div className="msc-section-label" style={{paddingTop:14}}>
          On this host
          <span className="count">· {PLAN_PROJECTS.filter(p=>p.host).length}</span>
          <span className="spacer"/>
          <span className="action">↻ sync</span>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:8, padding:"0 12px 14px"}}>
          {PLAN_PROJECTS.filter(p=>p.host).map(p=>(<PlanProjectCard key={p.id} p={p}/>))}
        </div>

        <div className="msc-section-label">
          Other hosts
          <span className="count">· {PLAN_PROJECTS.filter(p=>!p.host).length}</span>
          <span className="spacer"/>
          <span style={{fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-fg-dim)", textTransform:"none", letterSpacing:0}}>
            visible · not local
          </span>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:8, padding:"0 12px 14px"}}>
          {PLAN_PROJECTS.filter(p=>!p.host).map(p=>(<PlanProjectCard key={p.id} p={p} dim/>))}
        </div>
      </div>
    </Screen>
  );
}

function PlanProjectCard({ p, dim }) {
  const completion = p.total ? (p.total - p.open) / p.total : 0;
  return (
    <div className="msc-card" style={{padding:"12px 14px", opacity: dim?0.62:1}}>
      <div style={{display:"flex", alignItems:"baseline", gap:8, marginBottom:5}}>
        <span style={{fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-fg-dim)"}}>{p.id}</span>
        {p.planning && <span className="msc-tag amber">● drafting</span>}
        {!p.planning && <span className="msc-tag green">● active</span>}
        <span style={{flex:1}}/>
        <span style={{fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-fg-dim)"}}>{p.last}</span>
      </div>
      <div style={{fontFamily:"var(--msc-sans)", fontSize:13.5, color:"var(--msc-fg)",
        fontWeight:500, marginBottom:4, lineHeight:1.3}}>{p.name}</div>
      <div style={{fontSize:11.5, color:"var(--msc-fg-muted)", lineHeight:1.45, marginBottom:8}}>{p.pitch}</div>

      {p.planning ? (
        <>
          <div style={{height:4, borderRadius:2, background:"var(--msc-elev2)", overflow:"hidden", marginBottom:5}}>
            <div style={{width:`${(p.progress||0)*100}%`, height:"100%", background:"var(--msc-accent)"}}/>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:8, fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-muted)"}}>
            <span>{Math.round((p.progress||0)*100)}% planned</span>
            <span>·</span>
            <span style={{color:"var(--msc-accent)"}}>@planner asking</span>
            <span style={{flex:1}}/>
            <span style={{padding:"3px 10px", borderRadius:5,
              background:"var(--msc-accent)", color:"#1a120a", fontWeight:600, fontSize:10.5}}>
              resume →
            </span>
          </div>
        </>
      ) : (
        <>
          <div style={{display:"flex", gap:10, fontFamily:"var(--msc-mono)", fontSize:10,
            color:"var(--msc-fg-muted)", marginBottom:8, flexWrap:"wrap"}}>
            <span><b style={{color:"var(--msc-fg)"}}>{p.iteration}</b></span>
            <span>· {p.open}/{p.total} issues</span>
            <span>· {p.prs} PRs</span>
            <span>· {p.mile} milestones</span>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{flex:1, height:4, borderRadius:2, background:"var(--msc-elev2)", overflow:"hidden"}}>
              <div style={{width:`${completion*100}%`, height:"100%", background:"var(--msc-success)"}}/>
            </div>
            <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-muted)"}}>{Math.round(completion*100)}%</span>
            <span style={{padding:"3px 10px", borderRadius:5,
              background:"var(--msc-elev)", border:"1px solid var(--msc-border-soft)",
              fontFamily:"var(--msc-mono)", fontSize:10.5, color:"var(--msc-accent)"}}>
              board →
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// 2 · Kanban board — horizontal column pager
// ============================================================
const PLAN_COLUMNS = [
  { k:"backlog", t:"Backlog",   n:9, c:"var(--msc-fg-dim)" },
  { k:"upnext",  t:"Up next",   n:4, c:"var(--msc-info)" },
  { k:"doing",   t:"In progress", n:3, c:"var(--msc-accent)", on:true },
  { k:"review",  t:"In review", n:2, c:"var(--msc-success)" },
  { k:"done",    t:"Done",      n:5, c:"var(--msc-fg-muted)" },
];

const PLAN_DOING = [
  { n:418, t:"net: framing v2 + schema regen", labels:["net"],
    who:["lina","alex"], ai:3, comments:5, pr:"#418", m:"M1", focused:true },
  { n:417, t:"Subscriber HMAC verification middleware", labels:["security","net"],
    who:["alex"], ai:2, comments:1, pr:"#417 draft", m:"M2" },
  { n:416, t:"Worker → webhook emitter", labels:["net"],
    who:["pete"], ai:1, comments:2, m:"M1" },
];

function PlanBoardScreen() {
  return (
    <Screen activeTab="plan">
      <PageHeader
        crumbs={["plan", "prj_31a"]}
        title="Settlement webhooks v2"
        meta={<>Iter 24 · <b style={{color:"var(--msc-accent)"}}>17 open</b></>}
        right={
          <span style={{display:"inline-flex", alignItems:"center", gap:5,
            padding:"3px 8px", borderRadius:4,
            background:"color-mix(in oklch, var(--msc-success), transparent 88%)",
            border:"1px solid color-mix(in oklch, var(--msc-success), transparent 65%)",
            fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-success)"}}>
            <span style={{width:5, height:5, borderRadius:"50%", background:"var(--msc-success)"}}/>
            ⎇ sync
          </span>
        }
      />

      {/* Column pager */}
      <div style={{
        flex:"0 0 auto",
        padding:"10px 16px 6px",
        background:"var(--msc-bg)",
        borderBottom:"1px solid var(--msc-border-soft)",
        display:"flex", gap:6, overflowX:"auto",
      }}>
        {PLAN_COLUMNS.map(col=>(
          <span key={col.k} style={{
            display:"inline-flex", alignItems:"center", gap:5,
            padding:"5px 10px", borderRadius:99,
            background: col.on ? "color-mix(in oklch, var(--msc-accent), transparent 82%)" : "var(--msc-elev)",
            border:"1px solid " + (col.on?"var(--msc-accent-dim)":"var(--msc-border-soft)"),
            color: col.on ? "var(--msc-accent)" : "var(--msc-fg-muted)",
            fontFamily:"var(--msc-mono)", fontSize:10.5, whiteSpace:"nowrap", flexShrink:0,
          }}>
            <span style={{width:6, height:6, borderRadius:"50%", background:col.c}}/>
            {col.t} <span style={{color:"var(--msc-fg-dim)"}}>{col.n}</span>
          </span>
        ))}
      </div>

      <div className="msc-body" style={{padding:"10px 12px"}}>
        <div style={{display:"flex", alignItems:"baseline", gap:6, padding:"0 4px 8px"}}>
          <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)",
            textTransform:"uppercase", letterSpacing:".08em"}}>
            In progress · {PLAN_DOING.length}
          </span>
          <span style={{flex:1}}/>
          <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)"}}>
            ← swipe columns →
          </span>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {PLAN_DOING.map(c=>(<PlanIssueCard key={c.n} c={c}/>))}
          <div style={{
            marginTop:2, padding:"10px 12px",
            border:"1px dashed var(--msc-border)",
            borderRadius:6, textAlign:"center",
            fontFamily:"var(--msc-mono)", fontSize:10.5, color:"var(--msc-fg-dim)",
          }}>+ new card</div>
        </div>
      </div>
    </Screen>
  );
}

function PlanIssueCard({ c }) {
  return (
    <div className="msc-card" style={{
      padding:"12px 14px",
      borderColor: c.focused ? "var(--msc-accent-dim)" : "var(--msc-border-soft)",
      background: c.focused
        ? "color-mix(in oklch, var(--msc-accent), transparent 92%)"
        : "var(--msc-panel)",
    }}>
      <div style={{display:"flex", alignItems:"baseline", gap:8, marginBottom:6}}>
        <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)"}}>#{c.n}</span>
        {c.m && <span style={{fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-accent)"}}>{c.m}</span>}
        <span style={{flex:1}}/>
        {c.pr && <span className="msc-tag info" style={{fontSize:9}}>⊕ {c.pr}</span>}
      </div>
      <div style={{fontFamily:"var(--msc-sans)", fontSize:13, color:"var(--msc-fg)",
        lineHeight:1.4, marginBottom:8}}>{c.t}</div>

      <div style={{display:"flex", gap:4, flexWrap:"wrap", marginBottom:8}}>
        {c.labels.map(l=>{
          const L = PLAN_LABELS[l]||{c:"var(--msc-fg-dim)",t:l};
          return (
            <span key={l} style={{
              display:"inline-flex", alignItems:"center", gap:4,
              padding:"1px 6px", borderRadius:99,
              fontFamily:"var(--msc-mono)", fontSize:9,
              background:`color-mix(in oklch, ${L.c}, transparent 84%)`,
              color:L.c,
              border:`1px solid color-mix(in oklch, ${L.c}, transparent 70%)`,
            }}>
              <span style={{width:5, height:5, borderRadius:"50%", background:L.c}}/>{L.t}
            </span>
          );
        })}
      </div>

      <div style={{display:"flex", alignItems:"center", gap:6}}>
        <div style={{display:"flex"}}>
          {c.who.map((w,i)=>{
            const P = PLAN_PEOPLE[w];
            return (
              <span key={w} style={{
                width:20, height:20, borderRadius:"50%",
                background:P.color, color:"#1a120a",
                fontFamily:"var(--msc-mono)", fontWeight:700, fontSize:10,
                display:"flex", alignItems:"center", justifyContent:"center",
                marginLeft: i===0?0:-7,
                border:"1.5px solid var(--msc-panel)",
              }}>{P.initial}</span>
            );
          })}
        </div>
        <span style={{flex:1}}/>
        {c.ai > 0 && (
          <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-accent)"}}>
            ✦ {c.ai}
          </span>
        )}
        {c.comments > 0 && (
          <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)"}}>
            💬 {c.comments}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 3 · Issue detail + AI breakdown
// ============================================================
function PlanIssueScreen() {
  const subtasks = [
    { n:1, t:"Spec the v2 frame shape", done:true,
      note:"checked-in to docs/framing.md @ b04", est:"½d" },
    { n:2, t:"Encoder + tests (round-trip + size budget)",
      note:"draft on feat/tunnel-v2 · 70% done", est:"1d" },
    { n:3, t:"Regenerate schema.json from proto.rs",
      note:"CI must fail on drift", est:"¼d" },
    { n:4, t:"Capability negotiation in pairing hello", isNew:true,
      note:"suggested · client must downgrade gracefully", est:"½d" },
  ];

  return (
    <Screen activeTab="plan">
      <PageHeader
        crumbs={["plan", "Settlement webhooks v2", "#418"]}
        title="net: framing v2"
        meta={<><b style={{color:"var(--msc-accent)"}}>● in progress</b> · M1</>}
        right={<span className="msc-tag info" style={{fontSize:9.5}}>⊕ PR #418</span>}
      />

      <div className="msc-body">
        {/* Labels + assignees */}
        <div style={{padding:"10px 16px", display:"flex", flexWrap:"wrap", gap:5, alignItems:"center",
          borderBottom:"1px solid var(--msc-border-soft)"}}>
          {["net"].map(l=>{
            const L=PLAN_LABELS[l]||{c:"var(--msc-fg-dim)",t:l};
            return (
              <span key={l} style={{
                display:"inline-flex", alignItems:"center", gap:4,
                padding:"1px 6px", borderRadius:99,
                fontFamily:"var(--msc-mono)", fontSize:9,
                background:`color-mix(in oklch, ${L.c}, transparent 84%)`,
                color:L.c,
                border:`1px solid color-mix(in oklch, ${L.c}, transparent 70%)`,
              }}>
                <span style={{width:5, height:5, borderRadius:"50%", background:L.c}}/>{L.t}
              </span>
            );
          })}
          <span style={{flex:1}}/>
          <div style={{display:"flex"}}>
            {["lina","alex"].map((w,i)=>{
              const P=PLAN_PEOPLE[w];
              return (
                <span key={w} style={{
                  width:20, height:20, borderRadius:"50%",
                  background:P.color, color:"#1a120a",
                  fontFamily:"var(--msc-mono)", fontWeight:700, fontSize:10,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  marginLeft: i===0?0:-7,
                  border:"1.5px solid var(--msc-bg)",
                }}>{P.initial}</span>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div style={{padding:"14px 16px", borderBottom:"1px solid var(--msc-border-soft)"}}>
          <div style={{fontSize:12.5, color:"var(--msc-fg-muted)", lineHeight:1.65}}>
            Replace the v1 fixed-size frame with a CBOR-encoded variant carrying capability
            hints and a payload version. The encoder should expose a{" "}
            <span style={{fontFamily:"var(--msc-mono)", color:"var(--msc-fg)", fontSize:11.5}}>Frame::new(payload, caps)</span>{" "}
            constructor and regenerate{" "}
            <span style={{fontFamily:"var(--msc-mono)", color:"var(--msc-fg)", fontSize:11.5}}>schema.json</span>{" "}
            on build.
          </div>
          <div style={{marginTop:8, padding:"6px 8px", borderRadius:5,
            background:"var(--msc-elev)", border:"1px solid var(--msc-border-soft)",
            fontFamily:"var(--msc-mono)", fontSize:10.5, color:"var(--msc-fg-muted)"}}>
            ⌬ see blk_71fe — framing decision & acceptance bar
          </div>
        </div>

        {/* AI breakdown */}
        <div className="msc-section-label" style={{paddingTop:14}}>
          <span style={{display:"inline-flex", alignItems:"center", gap:6, color:"var(--msc-fg)"}}>
            <span style={{
              width:16, height:16, borderRadius:4,
              background:"linear-gradient(135deg, var(--msc-accent), oklch(0.62 0.14 50))",
              color:"#1a120a", fontFamily:"var(--msc-mono)", fontWeight:700, fontSize:9,
              display:"inline-flex", alignItems:"center", justifyContent:"center",
            }}>C</span>
            Claude · subtasks
          </span>
          <span className="count">· {subtasks.length}</span>
          <span className="spacer"/>
          <span className="action">regenerate</span>
        </div>

        <div style={{padding:"0 12px 8px", display:"flex", flexDirection:"column", gap:6}}>
          {subtasks.map(s=>(
            <div key={s.n} className="msc-card" style={{
              padding:"10px 12px",
              borderColor: s.isNew?"var(--msc-accent-dim)":"var(--msc-border-soft)",
              background: s.isNew?"color-mix(in oklch, var(--msc-accent), transparent 92%)":"var(--msc-panel)",
              display:"grid", gridTemplateColumns:"22px 1fr auto", gap:10, alignItems:"start",
            }}>
              <span style={{
                width:16, height:16, borderRadius:4, marginTop:1,
                border:"1px solid " + (s.done?"var(--msc-success)":"var(--msc-border)"),
                background: s.done?"var(--msc-success)":"transparent",
                color:"#1a120a", fontFamily:"var(--msc-mono)", fontSize:11, fontWeight:700,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>{s.done?"✓":""}</span>
              <div>
                <div style={{fontFamily:"var(--msc-sans)", fontSize:12.5,
                  color: s.done?"var(--msc-fg-muted)":"var(--msc-fg)",
                  textDecoration: s.done?"line-through":"none",
                  lineHeight:1.35}}>
                  {s.t}
                  {s.isNew && <span style={{
                    marginLeft:6, padding:"1px 5px", borderRadius:3,
                    fontFamily:"var(--msc-mono)", fontSize:8.5, color:"var(--msc-accent)",
                    background:"color-mix(in oklch, var(--msc-accent), transparent 80%)",
                  }}>✦ NEW</span>}
                </div>
                <div style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)",
                  marginTop:3, lineHeight:1.4}}>{s.note}</div>
              </div>
              <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-muted)"}}>{s.est}</span>
            </div>
          ))}
        </div>

        <div style={{padding:"4px 16px 12px", display:"flex", gap:8}}>
          <button className="msc-btn primary small" style={{flex:1}}>✦ create issue from suggestion</button>
          <button className="msc-btn ghost small">↺</button>
        </div>

        {/* Activity */}
        <div className="msc-section-label">Activity <span className="count">· 5</span></div>
        <div style={{padding:"0 16px 12px", display:"flex", flexDirection:"column", gap:9}}>
          {[
            { who:"lina", a:"opened the issue", t:"yesterday 16:02" },
            { who:"alex", a:"asked: \"can we hold for the encoder benchmark?\"", t:"17:14" },
            { who:"bot",  a:"linked PR #418 (draft)", t:"18:01" },
            { who:"lina", a:"moved to In progress · self-assigned + @alex", t:"today 10:42" },
            { who:"bot",  a:"CI · clippy + cargo test passed", t:"11:08" },
          ].map((a,i)=>(
            <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:10, alignItems:"baseline"}}>
              <span style={{
                width:18, height:18, borderRadius:"50%",
                background:PLAN_PEOPLE[a.who].color,
                color:"#1a120a", fontFamily:"var(--msc-mono)", fontWeight:700, fontSize:10,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>{PLAN_PEOPLE[a.who].initial}</span>
              <div style={{fontSize:11.5, lineHeight:1.45}}>
                <b style={{color:"var(--msc-fg)", fontFamily:"var(--msc-mono)", fontSize:11}}>@{a.who}</b>
                <span style={{color:"var(--msc-fg-muted)"}}> {a.a}</span>
                <div style={{fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-fg-dim)", marginTop:1}}>{a.t}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div style={{padding:"10px 16px", background:"var(--msc-panel)",
          borderTop:"1px solid var(--msc-border-soft)"}}>
          <textarea className="msc-input" placeholder="comment, or /assign, /label, /close, /ai breakdown…"
            style={{height:56, padding:"8px 10px", fontSize:11.5, resize:"none"}}/>
          <div style={{display:"flex", gap:6, marginTop:8}}>
            <button className="msc-btn ghost small">✦ ask claude</button>
            <button className="msc-btn ghost small">open in pane</button>
            <span style={{flex:1}}/>
            <button className="msc-btn primary small">comment</button>
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ============================================================
// 4 · AI scoping / planning session
// ============================================================
function PlanScopingScreen() {
  const messages = [
    { who:"you", t:"Same-LAN desktop ↔ mobile pairing without round-trip through the relay." },
    { who:"claude", t:"Got it. A few questions before I draft issues.\n\n**1. Discovery mechanism** — mDNS, manual IP entry, or a QR code shown on desktop?" },
    { who:"you", t:"QR code shown on desktop. Mobile scans it." },
    { who:"claude", t:"Good — that handles auth too. Want me to reuse the existing pairing token format (PRJ-1f-XXXX) or move to a one-shot Diffie-Hellman?" },
    { who:"you", t:"DH. Less reuse-risk on stolen QR." },
    { who:"claude", t:"Three more:\n\n**2.** Fallback when no LAN route is found — keep relay path, or refuse?\n**3.** Should pairing carry a 'capabilities' frame, or stay symmetric with the existing protocol?\n**4.** Multi-host: can mobile pair with > 1 desktop simultaneously?" },
    { who:"you", t:"Keep relay fallback. Capabilities frame yes. Multi-host: yes." },
  ];

  const draft = [
    { t:"Desktop: render pairing QR with DH ephemeral public key", est:"½d", labels:["security"] },
    { t:"Mobile: QR scan + DH handshake completion", est:"1d", labels:["security","net"] },
    { t:"LAN discovery — fall back to relay after 2s timeout", est:"½d", labels:["net"] },
    { t:"Add 'capabilities' frame to pairing hello", est:"¼d", labels:["net"] },
    { t:"Multi-host registry on mobile (stored hosts list)", est:"1d", labels:["api"] },
    { t:"Docs · pairing flow + threat model", est:"¼d", labels:["docs","security"] },
  ];

  return (
    <Screen activeTab="plan">
      <PageHeader
        crumbs={["plan", "prj_2fa", "scoping"]}
        title="Offline pairing"
        meta={<><b style={{color:"var(--msc-accent)"}}>38%</b> planned · 7 q's</>}
        right={
          <span style={{display:"inline-flex", alignItems:"center", gap:5,
            padding:"3px 8px", borderRadius:4,
            background:"var(--msc-elev)",
            border:"1px solid var(--msc-border-soft)",
            fontFamily:"var(--msc-mono)", fontSize:9.5, color:"var(--msc-fg-muted)"}}>
            ⏸ pause
          </span>
        }
      />

      {/* Progress strip */}
      <div style={{padding:"8px 16px", background:"var(--msc-panel)",
        borderBottom:"1px solid var(--msc-border-soft)",
        display:"flex", alignItems:"center", gap:10}}>
        <div style={{flex:1, height:4, borderRadius:2, background:"var(--msc-elev2)", overflow:"hidden"}}>
          <div style={{width:"38%", height:"100%", background:"var(--msc-accent)"}}/>
        </div>
        <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-muted)"}}>
          q 7/~18 · draft has <b style={{color:"var(--msc-fg)"}}>{draft.length}</b> issues
        </span>
      </div>

      <div className="msc-body">
        {/* Chat */}
        <div style={{padding:"10px 0"}}>
          {messages.map((m,i)=>(
            m.who==="you" ? (
              <div key={i} className="msc-chat-msg you" style={{whiteSpace:"pre-wrap"}}>{m.t}</div>
            ) : (
              <div key={i} className="msc-chat-msg claude" style={{whiteSpace:"pre-wrap"}}
                dangerouslySetInnerHTML={{__html:m.t.replace(/\*\*(.+?)\*\*/g, '<b style="color:var(--msc-accent)">$1</b>')}}/>
            )
          ))}
        </div>

        {/* Draft preview */}
        <div className="msc-section-label">
          Draft milestone
          <span className="count">· will publish to gh/{PLAN_PROJECTS[1].repo}</span>
          <span className="spacer"/>
          <span className="action">expand</span>
        </div>

        <div style={{padding:"0 12px 14px", display:"flex", flexDirection:"column", gap:6}}>
          {draft.map((d,i)=>(
            <div key={i} className="msc-card" style={{
              padding:"9px 11px",
              display:"grid", gridTemplateColumns:"22px 1fr auto", gap:8, alignItems:"start",
            }}>
              <span style={{
                width:18, height:18, borderRadius:4,
                background:"color-mix(in oklch, var(--msc-accent), transparent 80%)",
                color:"var(--msc-accent)", fontFamily:"var(--msc-mono)", fontWeight:600, fontSize:10,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>{i+1}</span>
              <div>
                <div style={{fontSize:12, color:"var(--msc-fg)", lineHeight:1.35}}>{d.t}</div>
                <div style={{display:"flex", gap:4, marginTop:4, flexWrap:"wrap"}}>
                  {d.labels.map(l=>{
                    const L=PLAN_LABELS[l]||{c:"var(--msc-fg-dim)",t:l};
                    return (
                      <span key={l} style={{
                        display:"inline-flex", alignItems:"center", gap:3,
                        padding:"0 5px", borderRadius:99,
                        fontFamily:"var(--msc-mono)", fontSize:8.5,
                        background:`color-mix(in oklch, ${L.c}, transparent 84%)`,
                        color:L.c,
                        border:`1px solid color-mix(in oklch, ${L.c}, transparent 70%)`,
                      }}>{L.t}</span>
                    );
                  })}
                </div>
              </div>
              <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-muted)"}}>{d.est}</span>
            </div>
          ))}
        </div>

        <div style={{padding:"4px 16px 14px", display:"flex", gap:8}}>
          <button className="msc-btn small" style={{flex:1}}>save draft</button>
          <button className="msc-btn primary small" style={{flex:2}}>publish 6 issues + milestone →</button>
        </div>
      </div>

      {/* Composer */}
      <div style={{padding:"10px 16px", background:"var(--msc-panel)",
        borderTop:"1px solid var(--msc-border-soft)"}}>
        <textarea className="msc-input" placeholder="answer · or paste a constraint…"
          style={{height:50, padding:"8px 10px", fontSize:12, resize:"none"}}/>
        <div style={{display:"flex", gap:6, marginTop:8, alignItems:"center"}}>
          <span style={{fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)"}}>
            ↑ voice · 🎙
          </span>
          <span style={{flex:1}}/>
          <button className="msc-btn ghost small">skip</button>
          <button className="msc-btn primary small">send ↵</button>
        </div>
      </div>
    </Screen>
  );
}

// ============================================================
// 5 · Tunnel pairing (when tunnel is NOT connected)
// ============================================================
function PlanPairingScreen() {
  return (
    <Screen activeTab="plan" tunnel={false}>
      <div style={{
        flex:1, padding:"24px 20px",
        display:"flex", flexDirection:"column", justifyContent:"center", gap:18,
        background:"var(--msc-bg)",
      }}>
        <div style={{textAlign:"center"}}>
          <div style={{
            margin:"0 auto 14px",
            width:56, height:56, borderRadius:14,
            background:"var(--msc-elev)", border:"1px solid var(--msc-border)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"var(--msc-mono)", fontSize:22, color:"var(--msc-accent)",
          }}>⇋</div>
          <h2 style={{margin:"0 0 6px", fontFamily:"var(--msc-mono)", fontSize:18, fontWeight:600, color:"var(--msc-fg)"}}>
            Pair with desktop
          </h2>
          <p style={{margin:"0 22px 4px", color:"var(--msc-fg-muted)", fontSize:12.5, lineHeight:1.55}}>
            Plan reads from the Projects host running in{" "}
            <b style={{color:"var(--msc-fg)"}}>base-studio-code</b> on your desktop.
            Open the desktop app, then either scan the QR or enter the pairing token below.
          </p>
        </div>

        {/* QR placeholder */}
        <div className="msc-card" style={{
          margin:"0 16px", padding:18,
          display:"flex", flexDirection:"column", alignItems:"center", gap:12,
        }}>
          <div style={{
            width:180, height:180, borderRadius:8,
            background:"var(--msc-elev)", border:"1px solid var(--msc-border)",
            backgroundImage:"repeating-conic-gradient(var(--msc-fg) 0deg 12deg, transparent 12deg 24deg)",
            backgroundSize:"24px 24px",
            position:"relative",
          }}>
            <div style={{
              position:"absolute", inset:"50% auto auto 50%", transform:"translate(-50%,-50%)",
              width:40, height:40, borderRadius:8,
              background:"linear-gradient(135deg, var(--msc-accent), oklch(0.62 0.14 50))",
              color:"#1a120a", fontFamily:"var(--msc-mono)", fontWeight:700, fontSize:18,
              display:"flex", alignItems:"center", justifyContent:"center",
              border:"3px solid var(--msc-panel)",
            }}>b.</div>
          </div>
          <div style={{fontFamily:"var(--msc-mono)", fontSize:10.5, color:"var(--msc-fg-dim)",
            textAlign:"center"}}>
            scan from <b style={{color:"var(--msc-fg-muted)"}}>Settings → Mobile</b> on desktop
          </div>
        </div>

        <div style={{
          margin:"0 16px",
          display:"flex", alignItems:"center", gap:8,
          fontFamily:"var(--msc-mono)", fontSize:10, color:"var(--msc-fg-dim)",
        }}>
          <span style={{flex:1, height:1, background:"var(--msc-border-soft)"}}/>
          <span>or paste token</span>
          <span style={{flex:1, height:1, background:"var(--msc-border-soft)"}}/>
        </div>

        <div style={{padding:"0 16px", display:"flex", gap:8}}>
          <input className="msc-input" placeholder="PRJ-1f-XXXX" style={{flex:1, letterSpacing:".06em"}}/>
          <button className="msc-btn primary">pair</button>
        </div>

        <div style={{padding:"0 16px"}}>
          <div className="msc-card" style={{padding:"10px 12px",
            display:"flex", alignItems:"center", gap:10,
            background:"var(--msc-elev)"}}>
            <span style={{width:7, height:7, borderRadius:"50%", background:"var(--msc-warn)"}}/>
            <div style={{flex:1, fontFamily:"var(--msc-mono)", fontSize:10.5, color:"var(--msc-fg-muted)"}}>
              No host detected on <b style={{color:"var(--msc-fg)"}}>192.168.4.0/24</b>.
              <div style={{fontSize:9.5, color:"var(--msc-fg-dim)", marginTop:2}}>
                Will fall back to relay tunnel if pairing token is entered.
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* No bottom tabs override — uses default from Screen */}
    </Screen>
  );
}

Object.assign(window, {
  PlanProjectsScreen, PlanBoardScreen, PlanIssueScreen, PlanScopingScreen, PlanPairingScreen,
});
