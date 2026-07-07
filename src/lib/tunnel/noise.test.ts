// T1b parity (#928): assert the hand-written noble Noise IK against the FROZEN shared
// vector that base-studio-code's snow responder is also pinned to (src-tauri/tests/
// noise_vectors.json, vendored verbatim as noiseVectors.json). If the mobile handshake
// bytes diverge from snow's, the desktop can never decrypt msg1 → the pairing "starts
// connecting" then stalls on authenticating. This test catches exactly that drift.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { NoiseSession, __setRandomBytesForTest } from './noise';

const v = JSON.parse(readFileSync('src/lib/tunnel/noiseVectors.json', 'utf8')) as {
  protocolName: string;
  prologue: string;
  initStaticPriv: string;
  initEphemeralPriv: string;
  respStaticPub: string;
  messages: { label: string; payload: string; ciphertext: string }[];
};

const b64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

test('noble Noise IK reproduces the frozen cross-repo vector byte-for-byte', () => {
  // The initiator (mobile) consumes two random privs in order: static (in the
  // NoiseSession constructor) then ephemeral (in startHandshake). Feed the fixed ones.
  const privs = [b64(v.initStaticPriv), b64(v.initEphemeralPriv)];
  let i = 0;
  __setRandomBytesForTest(() => {
    const p = privs[i++];
    if (!p) throw new Error('vector consumed more random privs than expected');
    return p;
  });

  const session = new NoiseSession(b64(v.respStaticPub));

  const msg1 = session.startHandshake();
  assert.equal(hex(msg1), hex(b64(v.messages[0].ciphertext)), 'msg1 (e, es, s, ss) drifted from snow');

  session.finishHandshake(b64(v.messages[1].ciphertext)); // msg2 (e, ee, se)

  // Transport keys must line up: encrypt(init->resp) and decrypt(resp->init).
  const t0 = session.encrypt(b64(v.messages[2].payload));
  assert.equal(hex(t0), hex(b64(v.messages[2].ciphertext)), 'transport init->resp drifted');

  const t1 = session.decrypt(b64(v.messages[3].ciphertext));
  assert.equal(hex(t1), hex(b64(v.messages[3].payload)), 'transport resp->init failed to decrypt');
});
