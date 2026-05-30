// Round-trip self-test for the tunnel's Noise transport FRAMING (#16). Builds a full
// IK handshake (mobile initiator ↔ desktop-shaped responder) in-process, then proves
// the app-message framing the relay client relies on: sealFrame/openFrame carry typed
// JSON both directions, nonces advance across frames, and the QR's base64 hostPubKey
// decodes to the responder's static key. This proves internal consistency of the
// framing, NOT snow interop (that needs a live handshake against the desktop).
// Run: node --experimental-strip-types scripts/tunnel-selftest.ts
import crypto from 'node:crypto';
import {
  createInitiator, HandshakeState, IK_MSG1, IK_MSG2, generateKeypair,
} from '../src/lib/noise/noise.ts';
import { base64ToBytes, sealFrame, openFrame } from '../src/lib/noiseSession.ts';

const rng = (n: number) => Uint8Array.from(crypto.randomBytes(n));
const EMPTY = new Uint8Array(0);
let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✓' : '❌'} ${label}`);
  if (!cond) failures++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// --- the QR carries the responder's static pub as base64; mobile decodes it ---
const responderStatic = generateKeypair(rng);
const hostPubKeyB64 = Buffer.from(responderStatic.pub).toString('base64');
check('base64ToBytes(hostPubKey) === responder static pub',
  eq([...base64ToBytes(hostPubKeyB64)], [...responderStatic.pub]));

// --- handshake: mobile (initiator) ↔ desktop (responder) ---
const initiator = createInitiator(generateKeypair(rng), base64ToBytes(hostPubKeyB64), rng);
const responder = new HandshakeState(false, responderStatic, null, EMPTY, rng);

const msg1 = initiator.writeMessage1();          // mobile → relay → desktop
responder.readMessage(IK_MSG1, msg1, false);
const w2 = responder.writeMessage(IK_MSG2, EMPTY, true); // desktop → relay → mobile
const initTx = initiator.readMessage2(w2.message).transport;
const respTx = w2.split!;
check('handshake establishes both transports', !!initTx && !!respTx);

// --- mobile → desktop: the first app frame is `auth { token: psk }` ---
const auth = { type: 'auth', token: 'psk-deadbeef', fcmToken: 'fcm-abc' };
check('auth frame round-trips (mobile→desktop)',
  eq(openFrame(respTx.recv, sealFrame(initTx.send, auth)), auth));

// --- desktop → mobile: pane_output with multibyte UTF-8 terminal data ---
const out = { type: 'pane_output', paneId: 'p1', data: 'héllo → 世界 ✓\n[0m', coarse: false };
check('pane_output round-trips with UTF-8 (desktop→mobile)',
  eq(openFrame(initTx.recv, sealFrame(respTx.send, out)), out));

// --- nonces advance: a second frame each way still decrypts in order ---
const inp = { type: 'pane_input', paneId: 'p1', data: 'ls -la\n' };
check('2nd mobile→desktop frame (nonce++)',
  eq(openFrame(respTx.recv, sealFrame(initTx.send, inp)), inp));
const st = { type: 'session_state', paneId: 'p1', status: 'running', currentTask: 'build', lastActivity: 't', prompt: null };
check('2nd desktop→mobile frame (nonce++)',
  eq(openFrame(initTx.recv, sealFrame(respTx.send, st)), st));

// --- a tampered frame must NOT decrypt (auth tag rejects it) ---
let rejected = false;
const sealed = sealFrame(initTx.send, inp);
sealed[0] ^= 0xff;
try { openFrame(respTx.recv, sealed); } catch { rejected = true; }
check('tampered frame is rejected', rejected);

console.log(failures === 0 ? '\ntunnel-selftest: OK' : `\ntunnel-selftest: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
