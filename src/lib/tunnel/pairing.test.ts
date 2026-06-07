import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRelayUrl, parsePairingPayload } from './pairing';

const VALID = {
  relayUrl: 'wss://relay.example.workers.dev',
  room: 'AbCdEf0123456789AbCdEf0123456789',
  hostPubKey: 'Zm9vYmFyAA==',
  psk: 'a'.repeat(64),
};

// ── relay URL normalisation ───────────────────────────────────────────────────

test('maps http(s):// to ws(s):// and trims trailing slashes', () => {
  assert.equal(normalizeRelayUrl('https://relay.example.workers.dev/'), 'wss://relay.example.workers.dev');
  assert.equal(normalizeRelayUrl('http://192.168.1.5:8765//'), 'ws://192.168.1.5:8765');
});

test('leaves ws(s):// untouched (apart from slash trimming)', () => {
  assert.equal(normalizeRelayUrl('wss://relay.example.workers.dev'), 'wss://relay.example.workers.dev');
  assert.equal(normalizeRelayUrl('ws://10.0.0.2:8765/'), 'ws://10.0.0.2:8765');
});

// ── payload parsing / validation ──────────────────────────────────────────────

test('parses a valid payload and normalises the relay URL', () => {
  const parsed = parsePairingPayload(JSON.stringify({ ...VALID, relayUrl: 'https://relay.example.workers.dev/' }));
  assert.deepEqual(parsed, { ...VALID, relayUrl: 'wss://relay.example.workers.dev' });
});

test('round-trips an already-canonical payload unchanged', () => {
  assert.deepEqual(parsePairingPayload(JSON.stringify(VALID)), VALID);
});

test('leaves opaque fields (room/hostPubKey/psk) untouched', () => {
  const parsed = parsePairingPayload(JSON.stringify(VALID));
  assert.equal(parsed?.room, VALID.room);
  assert.equal(parsed?.hostPubKey, VALID.hostPubKey); // standard base64, not decoded
  assert.equal(parsed?.psk, VALID.psk);               // 64 hex, used verbatim
});

test('rejects non-JSON', () => {
  assert.equal(parsePairingPayload('not json'), null);
  assert.equal(parsePairingPayload(''), null);
});

test('rejects payloads missing any required field', () => {
  for (const k of ['relayUrl', 'room', 'hostPubKey', 'psk'] as const) {
    const partial = { ...VALID };
    delete (partial as Record<string, unknown>)[k];
    assert.equal(parsePairingPayload(JSON.stringify(partial)), null, `missing ${k} should reject`);
  }
});

test('rejects empty-string fields and wrong types', () => {
  assert.equal(parsePairingPayload(JSON.stringify({ ...VALID, psk: '' })), null);
  assert.equal(parsePairingPayload(JSON.stringify({ ...VALID, room: 123 })), null);
  assert.equal(parsePairingPayload(JSON.stringify([VALID])), null);
});
