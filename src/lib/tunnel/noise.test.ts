import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeCrypto from 'node:crypto';
import {
  __setRandomBytesForTest,
  generateKeyPair,
  HandshakeState,
  NoiseSession,
} from './noise';
import vectors from './noiseVectors.fixtures.json' with { type: 'json' };

// Default RNG: Node's crypto (no expo-crypto on device). Each T1a test
// overrides this with pinned bytes; T4 tests reset it at entry.
const useNodeCrypto = (n: number) => new Uint8Array(nodeCrypto.randomBytes(n));
__setRandomBytesForTest(useNodeCrypto);

const hexBytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

// ── T1a: pinned Noise IK test vectors ────────────────────────────────────────
// The bytes in noiseVectors.fixtures.json are the cross-platform contract between
// this @noble implementation (mobile) and the desktop snow implementation. Both
// initiator AND responder must produce/accept exactly those bytes.
//
// Key material: fixed 32-byte secrets (initiator=0x01, ephemeral=0x02,
// responder=0x03, resp-ephemeral=0x04). The responder keypair is generated FIRST
// in each test (matching the generation script's call order).

test('T1a — initiator msg1 matches pinned fixture', () => {
  // RNG call order: responder static (0x03), initiator static (0x01), initiator eph (0x02)
  const seq = [
    hexBytes(vectors.responderStaticSecret),
    hexBytes(vectors.initiatorStaticSecret),
    hexBytes(vectors.initiatorEphemeralSecret),
  ];
  let i = 0;
  __setRandomBytesForTest((n) => seq[i++].slice(0, n));

  const respKp = generateKeyPair(); // consumes seq[0] = responder static
  const session = new NoiseSession(respKp.publicKey); // consumes seq[1] = initiator static
  const msg1 = session.startHandshake(); // consumes seq[2] = initiator ephemeral

  assert.equal(msg1.length, vectors.msg1Length, `msg1 must be ${vectors.msg1Length} bytes`);
  assert.equal(Buffer.from(msg1).toString('hex'), vectors.msg1Hex, 'msg1 bytes match fixture');
});

test('T1a — responder processes msg1 and produces msg2 matching pinned fixture', () => {
  // RNG call order: responder static (0x03), responder ephemeral (0x04) — used in writeMessage
  const seq = [
    hexBytes(vectors.responderStaticSecret),
    hexBytes(vectors.responderEphemeralSecret),
  ];
  let i = 0;
  __setRandomBytesForTest((n) => seq[i++].slice(0, n));

  const respKp = generateKeyPair(); // consumes seq[0] = responder static
  const respHS = new HandshakeState(false, new Uint8Array(0), respKp, null);
  const payload = respHS.readMessage(hexBytes(vectors.msg1Hex)); // no RNG
  const msg2 = respHS.writeMessage(new Uint8Array(0)); // consumes seq[1] = responder ephemeral

  assert.equal(msg2.length, vectors.msg2Length, `msg2 must be ${vectors.msg2Length} bytes`);
  assert.equal(Buffer.from(msg2).toString('hex'), vectors.msg2Hex, 'msg2 bytes match fixture');
  assert.equal(
    Buffer.from(payload).toString('hex'),
    vectors.msg2ResponderPayload,
    'responder decrypts empty payload from msg1',
  );
});

test('T1a — initiator accepts fixture msg2 and enters transport mode', () => {
  const seq = [
    hexBytes(vectors.responderStaticSecret),
    hexBytes(vectors.initiatorStaticSecret),
    hexBytes(vectors.initiatorEphemeralSecret),
  ];
  let i = 0;
  __setRandomBytesForTest((n) => seq[i++].slice(0, n));

  const respKp = generateKeyPair(); // seq[0]
  const session = new NoiseSession(respKp.publicKey); // seq[1]
  session.startHandshake(); // seq[2]

  assert.doesNotThrow(
    () => session.finishHandshake(hexBytes(vectors.msg2Hex)),
    'initiator must accept the fixture msg2 without error',
  );
  assert.equal(session.ready, true, 'session enters transport mode after finishHandshake');
});

// ── T4: end-to-end loopback with live random keys ─────────────────────────────
// Verifies both cipher roles complete the handshake and the post-handshake
// transport layer encrypts/decrypts correctly. Uses real entropy (not pinned keys).

test('T4 — full IK loopback: both roles complete handshake and exchange messages', () => {
  __setRandomBytesForTest(useNodeCrypto);

  const respKp = generateKeyPair();
  const initiator = new NoiseSession(respKp.publicKey);
  const msg1 = initiator.startHandshake();

  const respHS = new HandshakeState(false, new Uint8Array(0), respKp, null);
  respHS.readMessage(msg1);
  const msg2 = respHS.writeMessage(new Uint8Array(0));

  initiator.finishHandshake(msg2);
  assert.equal(initiator.ready, true, 'initiator in transport mode');

  // Initiator → Responder: send with initiator.encrypt, receive with responder c1
  const toResp = initiator.encrypt(new TextEncoder().encode('ping'));
  const [recvResp] = respHS.split();
  const gotPing = recvResp.decryptWithAd(new Uint8Array(0), toResp);
  assert.equal(new TextDecoder().decode(gotPing), 'ping', 'responder decrypts initiator message');

  // Responder → Initiator: send with responder c2, receive with initiator.decrypt
  const [, sendResp] = respHS.split();
  const toInit = sendResp.encryptWithAd(new Uint8Array(0), new TextEncoder().encode('pong'));
  const gotPong = initiator.decrypt(toInit);
  assert.equal(new TextDecoder().decode(gotPong), 'pong', 'initiator decrypts responder message');
});

test('T4 — binary framing: ciphertext is opaque binary; round-trip recovers exact bytes', () => {
  __setRandomBytesForTest(useNodeCrypto);

  const respKp = generateKeyPair();
  const initiator = new NoiseSession(respKp.publicKey);
  const msg1 = initiator.startHandshake();
  const respHS = new HandshakeState(false, new Uint8Array(0), respKp, null);
  respHS.readMessage(msg1);
  initiator.finishHandshake(respHS.writeMessage(new Uint8Array(0)));

  const payload = new TextEncoder().encode(JSON.stringify({ type: 'pane_input', paneId: 't0p0', data: '\r' }));
  const ct = initiator.encrypt(payload);

  // The ciphertext of a JSON payload must NOT itself be valid JSON.
  let parsedAsJson = false;
  try { JSON.parse(new TextDecoder().decode(ct)); parsedAsJson = true; } catch {}
  assert.equal(parsedAsJson, false, 'ciphertext is not valid JSON (it is opaque binary)');

  const [recvCS] = respHS.split();
  const plain = recvCS.decryptWithAd(new Uint8Array(0), ct);
  assert.deepEqual(plain, payload, 'round-trip bytes are byte-identical');
});

test('T4 — nonce increments: encrypting the same plaintext twice yields distinct ciphertexts', () => {
  __setRandomBytesForTest(useNodeCrypto);

  const respKp = generateKeyPair();
  const initiator = new NoiseSession(respKp.publicKey);
  const msg1 = initiator.startHandshake();
  const respHS = new HandshakeState(false, new Uint8Array(0), respKp, null);
  respHS.readMessage(msg1);
  initiator.finishHandshake(respHS.writeMessage(new Uint8Array(0)));

  const plain = new TextEncoder().encode('hello');
  const ct1 = initiator.encrypt(plain);
  const ct2 = initiator.encrypt(plain);
  assert.notDeepEqual(ct1, ct2, 'two encryptions of the same plaintext differ (nonce increments)');
});

test('T4 — tampered ciphertext throws on decryption (AEAD auth tag)', () => {
  __setRandomBytesForTest(useNodeCrypto);

  const respKp = generateKeyPair();
  const initiator = new NoiseSession(respKp.publicKey);
  const msg1 = initiator.startHandshake();
  const respHS = new HandshakeState(false, new Uint8Array(0), respKp, null);
  respHS.readMessage(msg1);
  initiator.finishHandshake(respHS.writeMessage(new Uint8Array(0)));

  const ct = initiator.encrypt(new TextEncoder().encode('secret'));
  ct[0] ^= 0xff; // flip one byte in the ciphertext

  const [recvCS] = respHS.split();
  assert.throws(
    () => recvCS.decryptWithAd(new Uint8Array(0), ct),
    'tampered ciphertext must fail AEAD verification',
  );
});
