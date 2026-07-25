// store_state PAYLOAD parity test (#246) — the payload-level counterpart to the frame parity
// test in `tunnelProtocol.fixtures.test.ts`.
//
// `store_state` is `{domain, rev, json}` where `json` is an opaque serialized string, so the
// frame test cannot see inside it. Every per-domain payload shape was therefore completely
// unguarded, which is how #237 (security) and #238 (glance) both accumulated behind a fully
// green suite — 200 audit records rendering as em-dashes, every glance node rendering idle for
// twelve days, zero failures.
//
// `storePayloads.fixtures.json` is BYTE-IDENTICAL to base-studio-code's copy (verified by git
// blob hash) and is GENERATED there from the real `build*Payload` functions, so it cannot
// drift from what the desktop actually sends without someone regenerating it.
//
// ── Two layers, and BOTH are load-bearing ────────────────────────────────────────────────────
//
// Layer A (strict re-encode) decodes each fixture by copying ONLY the fields our page model
// reads, then deep-equals back. It catches: a field we don't know about (extra key in raw), a
// field we require that is missing (the getter throws, naming it), and a type change.
//
// Layer A has one hole, and it is EXACTLY the hole #238 fell through: fields we read
// optionally use `copyOpt*`, for which "absent" is legal. Had the desktop merely DELETED
// `ProjectLite.status` without adding anything, Layer A alone would still pass.
//
// Layer B (selector smoke) closes it by asserting the canonical payload produces a
// non-degenerate view — PER FIELD, never just `!empty`, because `!empty` passes on a payload
// where a single aliased field happened to resolve (the precise camouflage that made #237
// look plausible). It relies on the fixture's stated invariant: no fixture field carries a
// value equal to one of our selector fallbacks.
//
// Do not "simplify" Layer B away. Layer A tells you which field drifted; Layer B tells you the
// page is blank. They fail on different things.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  str, num, bool, strOrNull, arr, strArr, strRecord,
  copyOptStr, copyOptNum, copyOptBool, type Raw,
} from './fixtureDecode';
import { STORE_DOMAINS } from '../types';
import { selectGlance, glanceL0Input } from '../pages/glancePage';
import { buildGlanceScene } from '../graph';
import { selectSecurityView } from '../mirror/securityView';
import { parseAlertsPayload, alertTarget } from '../alerts/model';

const fx = JSON.parse(
  readFileSync('src/lib/tunnel/storePayloads.fixtures.json', 'utf8'),
) as {
  $comment: string;
  domains: Record<string, Raw>;
  variants: Record<string, Raw>;
};

/**
 * Domains the desktop deliberately does not project through `storeProjections.ts`.
 * `plan` is published by the planner instead — base-studio-code#3760 tracks it. Listed here
 * (rather than silently skipped) so the coverage guard below stays meaningful.
 */
const UNPROJECTED_DOMAINS = new Set(['plan']);

/**
 * Domains whose consumer is KNOWN to disagree with the wire and has an open issue. Each entry
 * is a debt marker, not an exemption: writing a decoder for one today would either fail the
 * build or — far worse — enshrine the current wrong read-set as correct. The fix for each is
 * to land its issue and MOVE the domain into `DECODERS`.
 *
 * This list may only shrink. A domain that is neither here nor in `DECODERS` fails the
 * coverage guard, so a newly-published desktop domain cannot slip in unnoticed.
 */
const PENDING_DOMAINS: Record<string, string> = {
  org: '#235 — orgs (the whole team library) + persona detail unread',
  blueprints: '#236 — soundKit/origin/updatedAt unread; only the ACTIVE team crosses',
  components: '#241 — unpared kits, composes scoping, libraryRefs not projected',
  themes: '#242 — base + tech groups on the wire, never read',
  automations: '#239 — system hook floor never projected; two dead reads',
  mcp: '#240 — built-in servers invisible; version read is unfixable',
  skills: '#245 — lesson timestamps dropped; StageStatus "ahead" has no colour',
};

// ── decode helpers local to this harness ────────────────────────────────────────────────────

/**
 * Copy a field we deliberately do NOT consume, verbatim, so the deep-equal still passes.
 *
 * Asserts the field is still present: if the desktop stops sending something we listed as
 * ignored, the entry here is a lie and should be deleted. That is a trivial fix and an
 * informative failure — the alternative is a decoder that quietly documents a wire that no
 * longer exists.
 */
function passThrough(src: Raw, dst: Raw, ...keys: string[]): void {
  for (const k of keys) {
    assert.ok(k in src, `ignored field "${k}" is no longer sent — drop it from the decoder`);
    dst[k] = src[k];
  }
}

/** Decode an optional object-or-null field through `decode`, preserving absence vs null. */
function optObjOrNull(src: Raw, dst: Raw, k: string, decode: (o: Raw) => Raw): void {
  if (!(k in src)) return;
  const v = src[k];
  if (v === null) { dst[k] = null; return; }
  assert.ok(v !== null && typeof v === 'object', `field "${k}" must be an object or null`);
  dst[k] = decode(v as Raw);
}

// ── Layer A — per-domain decoders (mirroring exactly what each selector reads) ───────────────

/** `glance.fleets[].streams[]` — FleetPlan stream. */
function decodeGlanceStream(o: Raw): Raw {
  const out: Raw = { id: str(o, 'id'), dependsOn: strArr(o, 'dependsOn') };
  copyOptStr(o, out, 'name');
  copyOptStr(o, out, 'persona');
  // Fleet-authoring detail the phone does not render — the graph needs identity and wiring only.
  passThrough(o, out, 'repo', 'owns', 'issues');
  return out;
}

function decodeGlanceFleet(o: Raw): Raw {
  const out: Raw = { streams: arr(o, 'streams').map(decodeGlanceStream) };
  if ('director' in o) {
    const d = o.director as Raw;
    const dir: Raw = { enabled: bool(d, 'enabled') };
    copyOptStr(d, dir, 'role');
    out.director = dir;
  }
  // Planner sizing rationale — surfaced on the desktop's plan board, not in the mobile graph.
  passThrough(o, out, 'recommended', 'reasoning');
  return out;
}

function decodeGlanceProject(o: Raw): Raw {
  const out: Raw = { id: str(o, 'id'), name: str(o, 'name') };
  // All optional reads: `copyOpt*` cannot catch a deletion here. That is Layer B's job — and
  // is literally the #238 bug (`status` deleted in base-studio-code#2541).
  copyOptStr(o, out, 'role');
  copyOptStr(o, out, 'category');
  copyOptStr(o, out, 'health');
  copyOptStr(o, out, 'activity');
  copyOptStr(o, out, 'reason');
  copyOptNum(o, out, 'faults');
  return out;
}

function decodeGlance(o: Raw): Raw {
  const out: Raw = {
    projects: arr(o, 'projects').map(decodeGlanceProject),
    links: arr(o, 'links').map((l) => ({
      id: str(l, 'id'), from: str(l, 'from'), to: str(l, 'to'), kind: str(l, 'kind'),
    })),
    drill: strOrNull(o, 'drill'),
    personaRoles: strRecord(o, 'personaRoles'),
  };
  const fleets = o.fleets as Raw;
  assert.ok(fleets !== null && typeof fleets === 'object', 'field "fleets" must be an object');
  out.fleets = Object.fromEntries(
    Object.entries(fleets).map(([k, v]) => [k, decodeGlanceFleet(v as Raw)]),
  );
  optObjOrNull(o, out, 'drillFleet', decodeGlanceFleet);
  // The cross-graph library band (base-studio-code#3114/#3119). GlancePayload carries these but
  // the mobile graph has no band to draw them into — see the forward-looking note in #238.
  passThrough(o, out, 'kitUsage', 'kits', 'libraryRefs');
  return out;
}

function decodeSecurityProfile(o: Raw): Raw {
  const paths = o.paths as Raw;
  assert.ok(paths !== null && typeof paths === 'object', 'field "paths" must be an object');
  const out: Raw = {
    id: str(o, 'id'),
    name: str(o, 'name'),
    commands: strArr(o, 'commands'),
    tools: strRecord(o, 'tools'),
    paths: { allow: strArr(paths, 'allow'), deny: strArr(paths, 'deny') },
    net: strArr(o, 'net'),
  };
  copyOptStr(o, out, 'category');
  copyOptStr(o, out, 'desc');
  copyOptStr(o, out, 'mode');
  copyOptBool(o, out, 'builtin');
  return out;
}

/** Every field is required and consumed — no pass-throughs, which is what #237 restored. */
function decodeSecurity(o: Raw): Raw {
  return {
    profiles: arr(o, 'profiles').map(decodeSecurityProfile),
    paneRoles: strRecord(o, 'paneRoles'),
    paneProfiles: strRecord(o, 'paneProfiles'),
    audit: arr(o, 'audit').map((r) => ({
      ts: str(r, 'ts'), pane: str(r, 'pane'), toolName: str(r, 'toolName'), target: str(r, 'target'),
    })),
  };
}

/**
 * `alerts` — every field is consumed by `parseAlertsPayload`. #244 confirmed the
 * store domain itself was already field- and type-exact (the ISO-string trap
 * that broke `security` does not occur here: `at` is epoch ms on both sides);
 * the drift was entirely in the FCM push surface around it, which this harness
 * does not cover. The push types are guarded by their own enumeration test in
 * `alerts/model.test.ts`.
 */
function decodeAlerts(o: Raw): Raw {
  return {
    alerts: arr(o, 'alerts').map((a) => {
      const out: Raw = { id: str(a, 'id'), kind: str(a, 'kind'), text: str(a, 'text'), at: num(a, 'at') };
      copyOptStr(a, out, 'paneId');
      copyOptStr(a, out, 'project');
      return out;
    }),
  };
}

const DECODERS: Record<string, (o: Raw) => Raw> = {
  glance: decodeGlance,
  security: decodeSecurity,
  alerts: decodeAlerts,
};

// ── Coverage + vocabulary guards ────────────────────────────────────────────────────────────

test('every registered STORE_DOMAIN has a payload fixture (or is explicitly unprojected)', () => {
  for (const d of STORE_DOMAINS) {
    if (UNPROJECTED_DOMAINS.has(d)) continue;
    assert.ok(d in fx.domains, `no payload fixture for domain "${d}"`);
  }
});

test('mobile STORE_DOMAINS covers every domain the desktop publishes', () => {
  const known = new Set<string>(STORE_DOMAINS);
  for (const d of Object.keys(fx.domains)) {
    assert.ok(known.has(d), `mobile STORE_DOMAINS is out of sync — desktop publishes "${d}"`);
  }
});

test('every published domain is either decoded or a documented pending consumer', () => {
  for (const d of Object.keys(fx.domains)) {
    assert.ok(
      d in DECODERS || d in PENDING_DOMAINS,
      `no mobile decoder for domain "${d}" — model it, or add it to PENDING_DOMAINS with its issue`,
    );
  }
});

test('PENDING_DOMAINS names only domains that are actually published', () => {
  // Keeps the debt list from outliving the debt: once a domain is reconciled it moves to
  // DECODERS, and a stale entry here fails rather than lingering as a comment.
  for (const [d, why] of Object.entries(PENDING_DOMAINS)) {
    assert.ok(d in fx.domains, `PENDING_DOMAINS lists "${d}", which the desktop does not publish`);
    assert.match(why, /#\d+/, `PENDING_DOMAINS["${d}"] must cite its tracking issue`);
    assert.ok(!(d in DECODERS), `"${d}" is decoded — remove it from PENDING_DOMAINS`);
  }
});

// ── Layer A — strict re-encode ──────────────────────────────────────────────────────────────

for (const [domain, decode] of Object.entries(DECODERS)) {
  test(`Layer A: ${domain} payload round-trips through the mobile model`, () => {
    assert.deepEqual(decode(fx.domains[domain]), fx.domains[domain]);
  });
}

test('Layer A: the glance_l0 variant round-trips (nullable drill / drillFleet)', () => {
  assert.deepEqual(decodeGlance(fx.variants.glance_l0), fx.variants.glance_l0);
});

// ── Variant pinning — optionality and nullability cannot quietly become required ─────────────

test('variants pin the nullable fields', () => {
  assert.equal(fx.variants.glance_l0.drill, null, 'glance.drill must stay nullable');
  assert.equal(fx.variants.glance_l0.drillFleet, null, 'glance.drillFleet must stay nullable');
  assert.equal(fx.variants.skills_no_lessons.lessons, null, 'skills.lessons must stay nullable');
  assert.equal(fx.variants.blueprints_no_team.activeTeam, null, 'blueprints.activeTeam must stay nullable');
});

// ── Layer B — selector smoke (per field, never just !empty) ──────────────────────────────────

test('Layer B: glance — no project falls back to idle', () => {
  const model = selectGlance(fx.domains.glance);
  assert.ok(model, 'selectGlance returned undefined for the canonical payload');

  // The #238 regression, asserted directly: `health` and `activity` must survive the parse.
  for (const p of model.projects) {
    assert.notEqual(p.health, undefined, `project "${p.id}" has no health — the field drifted`);
    assert.notEqual(p.activity, undefined, `project "${p.id}" has no activity — the field drifted`);
  }
  const demo = model.projects.find((p) => p.id === 'demo')!;
  assert.equal(demo.health, 'error');
  assert.equal(demo.activity, 'building');
  assert.equal(demo.reason, 'payments timeout');
  assert.equal(demo.faults, 3);
  assert.equal(demo.role, 'service');

  // ...and must survive all the way to the rendered card, not just the parse.
  const scene = buildGlanceScene(glanceL0Input(model));
  const node = scene.nodes.find((n) => n.id === 'demo')!;
  assert.equal(node.subtitle, 'service · payments timeout', 'the reason must replace the activity word');
  assert.ok(node.statusColor, 'a degraded node must carry a health colour');
  assert.equal(node.pulse, true, 'an error node must pulse');
});

test('Layer B: glance — the #2530 records are actually consumed', () => {
  const model = selectGlance(fx.domains.glance)!;
  // personaRoles: without it every fleet agent is hardcoded `worker` (the #238 finding).
  const agents = glanceL0Input(model).projects.find((p) => p.id === 'demo')!.agents!;
  assert.ok(agents.length > 0, 'the demo fleet did not reach the graph');
  assert.equal(agents.find((a) => a.id === 'auth')!.role, 'worker', 'persona backend-dev → worker');
  assert.ok(agents.some((a) => a.id === 'director'), 'the director hub is missing');
});

test('Layer B: glance — fleets makes a project drillable with drill = null', () => {
  // The variant proves the unlock is driven by `fleets`, not by the desktop's own drill state.
  const model = selectGlance(fx.variants.glance_l0)!;
  assert.equal(model.drill, null);
  assert.ok(glanceL0Input(model).projects.find((p) => p.id === 'demo')!.agents!.length > 0);
});

test('Layer B: security — no audit row renders as an em-dash', () => {
  const view = selectSecurityView(fx.domains.security);
  assert.equal(view.empty, false, 'the canonical security payload produced an empty view');
  assert.ok(view.audit.length > 0, 'no audit rows survived the parse');

  for (const e of view.audit) {
    // Each of these was a literal em-dash before #237.
    assert.notEqual(e.at, null, `audit row "${e.id}" has an unparsed ts`);
    assert.ok(e.toolName.length > 0, `audit row "${e.id}" has no toolName`);
    assert.ok(e.pane.length > 0, `audit row "${e.id}" has no pane`);
    assert.ok(e.target.length > 0, `audit row "${e.id}" has no target`);
  }
  // Newest first: 10:16:30 sorts above 10:15:00.
  assert.equal(view.audit[0].toolName, 'Edit');
  assert.equal(view.audit[0].target, 'src/ui/Login.tsx');
  assert.equal(view.audit[0].kind, 'tool');
  assert.equal(view.audit[1].kind, 'cmd', 'Bash must derive kind `cmd`');
});

test('Layer B: security — the profile permission model is fully read', () => {
  const view = selectSecurityView(fx.domains.security);
  const p = view.profiles[0];
  assert.equal(p.name, 'Worker');
  assert.equal(p.mode, 'ask', 'the base policy is the single most important field');
  assert.equal(p.category, 'user');
  assert.equal(p.builtin, true);
  assert.ok(p.desc);
  // `tools` is a RECORD — the old Array.isArray guard silently counted it as zero.
  assert.equal(Object.keys(p.tools).length, 8);
  assert.equal(p.tools.bash, 'ask');
  assert.deepEqual(p.paths, { allow: ['src/**'], deny: ['.env'] });
  assert.deepEqual(p.net, ['api.github.com']);
  assert.equal(p.summary, '1 command · 8 tools · 2 paths · 1 host');
});

test('Layer B: security — assignments join the two paneId records', () => {
  const view = selectSecurityView(fx.domains.security);
  // Before #237 this section read a top-level `assignments` key that never existed.
  assert.equal(view.assignments.length, 1);
  const a = view.assignments[0];
  assert.equal(a.pane, 'demo:auth');
  assert.equal(a.role, 'worker');
  assert.equal(a.profileId, 'pf_worker');
  assert.equal(a.profile, 'Worker', 'the profile id must resolve to its name');
});

test('Layer B: alerts — every field reaches the inbox row', () => {
  const alerts = parseAlertsPayload(fx.domains.alerts);
  assert.equal(alerts.length, 1, 'the canonical alert did not survive the parse');
  const a = alerts[0];
  assert.equal(a.id, 'gate-ready:demo:1721900000000');
  assert.equal(a.kind, 'gate-ready');
  assert.equal(a.text, 'Plan ready to publish');
  assert.equal(a.at, 1721900000000);
  assert.equal(a.paneId, 'demo:director');
  assert.equal(a.project, 'demo');
  // `at` is epoch ms on BOTH sides here — the #237 ISO-string trap does not occur.
  assert.equal(typeof a.at, 'number');
  // ...and the row resolves to a real destination rather than the inbox fallback.
  assert.deepEqual(alertTarget(a), { type: 'planner' });
});

// ── The invariant that gives Layer B its teeth ───────────────────────────────────────────────

test('the fixture states the no-fallback-values invariant', () => {
  // If the fixture ever ships default-looking values, Layer B can no longer tell "read
  // correctly" from "fell back" and silently stops testing anything.
  assert.match(fx.$comment, /INVARIANT/);
  for (const p of arr(fx.domains.glance, 'projects')) {
    assert.notEqual(p.health, 'idle', 'a fixture project must not carry the fallback health');
    assert.notEqual(p.activity, 'idle', 'a fixture project must not carry the fallback activity');
  }
  for (const r of arr(fx.domains.security, 'audit')) {
    assert.match(str(r, 'ts'), /^\d{4}-\d{2}-\d{2}T/, 'audit ts must be a real ISO-8601 string');
  }
});
