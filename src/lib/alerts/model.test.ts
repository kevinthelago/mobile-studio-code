import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAlertsPayload, parsePushTap, provisionalAlert, mergeAlerts,
  visibleAlerts, unreadCount, alertMeta, alertTarget, type AlertEvent,
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
