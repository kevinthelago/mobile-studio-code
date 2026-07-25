import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAlertsPayload, parsePushTap, provisionalAlert, mergeAlerts,
  visibleAlerts, unreadCount, alertMeta, alertTarget, pushAlertDraft, pushTarget,
  isDuplicateCoordWait, PUSH_TYPES, PUSH_ALERT_KINDS, COORD_WAIT_DEDUP_MS,
  type AlertEvent, type PushType,
} from './model';

const ev = (o: Partial<AlertEvent> & { id: string; at: number }): AlertEvent => ({
  kind: 'agent-paused', text: 'x', ...o,
});

describe('parseAlertsPayload', () => {
  it('parses a well-formed alerts domain payload', () => {
    const out = parseAlertsPayload({
      alerts: [{ id: 'a1', kind: 'fleet-failed', text: 'boom', at: 5, paneId: 'p:s', project: 'proj' }],
    });
    assert.equal(out.length, 1);
    assert.deepEqual(out[0], { id: 'a1', kind: 'fleet-failed', text: 'boom', at: 5, paneId: 'p:s', project: 'proj' });
  });

  it('drops malformed entries but keeps good ones; never throws', () => {
    const out = parseAlertsPayload({
      alerts: [
        { id: 'ok', kind: 'agent-paused', text: 't', at: 1 },
        { id: '', kind: 'x', text: 't', at: 2 },        // empty id
        { id: 'b', kind: '', text: 't', at: 3 },         // empty kind
        { id: 'c', kind: 'x', at: 4 },                    // missing text
        { id: 'd', kind: 'x', text: 't', at: NaN },       // non-finite at
        null, 'junk', 42,
      ],
    });
    assert.deepEqual(out.map((a) => a.id), ['ok']);
  });

  it('returns [] for a pre-#2498 desktop (no domain) or garbage', () => {
    assert.deepEqual(parseAlertsPayload(null), []);
    assert.deepEqual(parseAlertsPayload({}), []);
    assert.deepEqual(parseAlertsPayload({ alerts: 'nope' }), []);
    assert.deepEqual(parseAlertsPayload('junk'), []);
  });
});

describe('parsePushTap', () => {
  it('parses a user_request push', () => {
    assert.deepEqual(parsePushTap({ type: 'user_request', paneId: 'p:s' }), { type: 'user_request', paneId: 'p:s' });
  });
  it('rejects a user_request with no paneId', () => {
    assert.equal(parsePushTap({ type: 'user_request', paneId: '' }), null);
    assert.equal(parsePushTap({ type: 'user_request' }), null);
  });
  it('parses an alert push with and without a paneId', () => {
    assert.deepEqual(parsePushTap({ type: 'alert', kind: 'gate-ready' }), { type: 'alert', kind: 'gate-ready' });
    assert.deepEqual(
      parsePushTap({ type: 'alert', kind: 'worker-question', paneId: 'p:s' }),
      { type: 'alert', kind: 'worker-question', paneId: 'p:s' },
    );
  });
  it('normalises an empty paneId to absent', () => {
    assert.deepEqual(parsePushTap({ type: 'alert', kind: 'gate-ready', paneId: '' }), { type: 'alert', kind: 'gate-ready' });
  });
  it('rejects unknown / malformed data', () => {
    assert.equal(parsePushTap({ type: 'alert' }), null);       // no kind
    assert.equal(parsePushTap({ type: 'other' }), null);
    assert.equal(parsePushTap(null), null);
  });
});

// ── The durable guard (#244) ────────────────────────────────────────────────
//
// A representative `data` block for EVERY `data.type` base-studio-code's
// `src-tauri/src/mobile/fcm.rs` can emit, with the exact keys each builder puts
// on the wire. Before #244 three of these parsed to null and the tap was
// swallowed — including the security quarantine push, which exists specifically
// to reach a backgrounded phone.
const PUSH_SAMPLES: Record<PushType, Record<string, string>> = {
  // build_message :146
  user_request: { type: 'user_request', paneId: 't3p1', prompt: 'ready?' },
  // build_alert_message :235
  alert: { type: 'alert', kind: 'gate-ready', paneId: 'planning_demo' },
  // build_coord_wait_message :170
  coord_wait: { type: 'coord_wait', session: 't0p1', reason: 'bsc-wait' },
  // build_autom_failed_message :190
  autom_failed: { type: 'autom_failed', name: 'Nightly triage', error: 'exit 1' },
  // build_warden_message :212
  warden_quarantine: {
    type: 'warden_quarantine', session: 't0p1', detail: 'denied-command: gh repo delete acme/api',
  },
};

describe('every desktop push type is routable', () => {
  it('PUSH_SAMPLES covers exactly PUSH_TYPES', () => {
    assert.deepEqual(Object.keys(PUSH_SAMPLES).sort(), [...PUSH_TYPES].sort());
  });

  // THE test for #244: a new desktop push type fails here rather than silently
  // going nowhere. If this breaks, `fcm.rs` grew a builder — add the type.
  for (const type of PUSH_TYPES) {
    it(`parses "${type}" to a non-null tap`, () => {
      const tap = parsePushTap(PUSH_SAMPLES[type]);
      assert.notEqual(tap, null, `push type "${type}" is unroutable`);
      assert.equal(tap!.type, type);
    });

    it(`resolves "${type}" to a real destination`, () => {
      const target = pushTarget(parsePushTap(PUSH_SAMPLES[type])!);
      // `inbox` is a legitimate destination, but never a silent no-op.
      assert.ok(['chat', 'planner', 'automations', 'inbox'].includes(target.type));
    });
  }

  it('parses the standalone pushes with the exact Rust field names', () => {
    assert.deepEqual(parsePushTap(PUSH_SAMPLES.warden_quarantine), {
      type: 'warden_quarantine', session: 't0p1', detail: 'denied-command: gh repo delete acme/api',
    });
    assert.deepEqual(parsePushTap(PUSH_SAMPLES.autom_failed), {
      type: 'autom_failed', name: 'Nightly triage', error: 'exit 1',
    });
    assert.deepEqual(parsePushTap(PUSH_SAMPLES.coord_wait), {
      type: 'coord_wait', session: 't0p1', reason: 'bsc-wait',
    });
  });

  it('requires the identifying field but tolerates a missing detail', () => {
    assert.equal(parsePushTap({ type: 'warden_quarantine', detail: 'x' }), null);
    assert.equal(parsePushTap({ type: 'autom_failed', error: 'x' }), null);
    assert.equal(parsePushTap({ type: 'coord_wait', reason: 'x' }), null);
    assert.deepEqual(parsePushTap({ type: 'warden_quarantine', session: 't0p1' }), {
      type: 'warden_quarantine', session: 't0p1', detail: '',
    });
  });
});

describe('pushAlertDraft', () => {
  it('turns a quarantine push into an inbox row bound to its session', () => {
    const tap = parsePushTap(PUSH_SAMPLES.warden_quarantine)!;
    assert.deepEqual(pushAlertDraft(tap, ''), {
      kind: PUSH_ALERT_KINDS.quarantine,
      text: 'denied-command: gh repo delete acme/api',
      paneId: 't0p1',
    });
  });

  it('prefers the notification body when the push carried one', () => {
    const tap = parsePushTap(PUSH_SAMPLES.autom_failed)!;
    assert.equal(pushAlertDraft(tap, 'Nightly triage failed')!.text, 'Nightly triage failed');
    // ...and falls back to the tap's own fields so a row is never blank.
    assert.equal(pushAlertDraft(tap, '')!.text, 'Nightly triage: exit 1');
  });

  it('does not mint a row for user_request (a pane signal, not an alert)', () => {
    assert.equal(pushAlertDraft(parsePushTap(PUSH_SAMPLES.user_request)!, ''), null);
  });

  it('gives every minted kind real presentation, not the generic fallback', () => {
    for (const kind of Object.values(PUSH_ALERT_KINDS)) {
      assert.notEqual(alertMeta(kind).title, 'Alert', `${kind} renders generically`);
    }
  });
});

describe('pushTarget', () => {
  it('deep-links a quarantine to the offending session chat', () => {
    assert.deepEqual(pushTarget(parsePushTap(PUSH_SAMPLES.warden_quarantine)!), {
      type: 'chat', paneId: 't0p1',
    });
  });

  it('deep-links an automation failure to the Automations tab', () => {
    assert.deepEqual(pushTarget(parsePushTap(PUSH_SAMPLES.autom_failed)!), { type: 'automations' });
  });

  it('routes user_request to its pane chat', () => {
    assert.deepEqual(pushTarget(parsePushTap(PUSH_SAMPLES.user_request)!), {
      type: 'chat', paneId: 't3p1',
    });
  });
});

describe('isDuplicateCoordWait', () => {
  const NOW = 1_000_000;
  const paused = ev({ id: 'a', at: NOW - 5_000, kind: 'agent-paused', paneId: 't0p1' });

  it('suppresses a coord_wait matching a recent alert-path row for the same session', () => {
    assert.equal(isDuplicateCoordWait('t0p1', [paused], NOW), true);
  });

  it('keeps it when the session differs', () => {
    assert.equal(isDuplicateCoordWait('t9p9', [paused], NOW), false);
  });

  it('keeps it when the alert-path row is outside the window', () => {
    assert.equal(isDuplicateCoordWait('t0p1', [paused], NOW + COORD_WAIT_DEDUP_MS), false);
  });

  it('only dedups against the kinds the coord log actually mints', () => {
    const landed = ev({ id: 'b', at: NOW, kind: 'fleet-landed', paneId: 't0p1' });
    assert.equal(isDuplicateCoordWait('t0p1', [landed], NOW), false);
    const asking = ev({ id: 'c', at: NOW, kind: 'worker-question', paneId: 't0p1' });
    assert.equal(isDuplicateCoordWait('t0p1', [asking], NOW), true);
  });

  it('is false against an empty inbox', () => {
    assert.equal(isDuplicateCoordWait('t0p1', [], NOW), false);
  });
});

describe('mergeAlerts', () => {
  it('newest-first, domain + uncovered provisional', () => {
    const domain = [ev({ id: 'd1', at: 10 })];
    const prov = [ev({ id: 'fcm:x', at: 20, kind: 'fleet-landed' })];
    const merged = mergeAlerts(domain, prov);
    assert.deepEqual(merged.map((a) => a.id), ['fcm:x', 'd1']);
  });

  it('drops a provisional once the domain covers its kind+pane', () => {
    const domain = [ev({ id: 'd1', at: 10, kind: 'agent-paused', paneId: 'p:s' })];
    const prov = [ev({ id: 'fcm:y', at: 20, kind: 'agent-paused', paneId: 'p:s' })];
    const merged = mergeAlerts(domain, prov);
    assert.deepEqual(merged.map((a) => a.id), ['d1']); // provisional superseded
  });

  it('collapses duplicate ids (domain wins)', () => {
    const domain = [ev({ id: 'same', at: 10 })];
    const prov = [ev({ id: 'same', at: 20 })];
    assert.deepEqual(mergeAlerts(domain, prov).map((a) => a.id), ['same']);
  });

  it('keeps provisional alerts against a never-syncing desktop', () => {
    const prov = [ev({ id: 'fcm:z', at: 5 }), ev({ id: 'fcm:w', at: 9 })];
    assert.deepEqual(mergeAlerts([], prov).map((a) => a.id), ['fcm:w', 'fcm:z']);
  });
});

describe('provisionalAlert', () => {
  it('mints an fcm:-prefixed entry, body else the kind title', () => {
    const a = provisionalAlert('gate-ready', '', 'p:s', 100);
    assert.ok(a.id.startsWith('fcm:gate-ready:p:s:'));
    assert.equal(a.text, alertMeta('gate-ready').title);
    assert.equal(a.paneId, 'p:s');
    const b = provisionalAlert('fleet-failed', 'it broke', undefined, 100);
    assert.equal(b.text, 'it broke');
    assert.equal(b.paneId, undefined);
  });
});

describe('visibleAlerts / unreadCount', () => {
  const list = [ev({ id: 'a', at: 30 }), ev({ id: 'b', at: 20 }), ev({ id: 'c', at: 10 })];
  it('visibleAlerts hides at-or-before the cleared watermark', () => {
    assert.deepEqual(visibleAlerts(list, 20).map((a) => a.id), ['a']);
    assert.deepEqual(visibleAlerts(list, 0).map((a) => a.id), ['a', 'b', 'c']);
  });
  it('unreadCount counts strictly-newer than readAt', () => {
    assert.equal(unreadCount(list, 20), 1);
    assert.equal(unreadCount(list, 0), 3);
    assert.equal(unreadCount(list, 30), 0);
  });
});

describe('alertMeta', () => {
  it('maps known kinds; attention vs info severity', () => {
    assert.equal(alertMeta('fleet-failed').severity, 'attention');
    assert.equal(alertMeta('fleet-landed').severity, 'info');
    assert.equal(alertMeta('gate-ready').severity, 'attention');
  });
  it('renders an unknown (newer desktop) kind generically', () => {
    const m = alertMeta('some-future-kind');
    assert.equal(m.title, 'Alert');
    assert.equal(m.glyph, '•');
  });
});

describe('alertTarget', () => {
  it('gate-ready / planner-waiting → the Planner tab', () => {
    assert.deepEqual(alertTarget({ kind: 'gate-ready' }), { type: 'planner' });
    assert.deepEqual(alertTarget({ kind: 'planner-waiting' }), { type: 'planner' });
  });
  it('session kinds → that chat when a pane is present, else inbox', () => {
    assert.deepEqual(alertTarget({ kind: 'agent-paused', paneId: 'p:s' }), { type: 'chat', paneId: 'p:s' });
    assert.deepEqual(alertTarget({ kind: 'worker-question' }), { type: 'inbox' });
  });
  it('fleet latches + unknown kinds → the inbox', () => {
    assert.deepEqual(alertTarget({ kind: 'fleet-failed', paneId: 'p:s' }), { type: 'inbox' });
    assert.deepEqual(alertTarget({ kind: 'fleet-landed' }), { type: 'inbox' });
    assert.deepEqual(alertTarget({ kind: 'mystery' }), { type: 'inbox' });
  });
});
