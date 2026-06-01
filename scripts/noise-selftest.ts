// JS-only round-trip self-test for the Noise IK state machine. Proves internal
// consistency (handshake + transport both directions + imposter-key rejection).
// It does NOT prove interop with Rust `snow` — that requires a handshake against
// the running desktop/relay. Run: node --experimental-strip-types scripts/noise-selftest.ts
import crypto from 'node:crypto';
import {
  createInitiator, HandshakeState, IK_MSG1, IK_MSG2, generateKeypair,
} from '../src/lib/noise/noise.ts';

const rng = (n: number) => Uint8Array.from(crypto.randomBytes(n));
const enc = new TextEncoder();
const dec = new TextDecoder();
const AD = new Uint8Array(0);
let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✓' : '❌'} ${label}`);
  if (!cond) failures++;
}

const responderStatic = generateKeypair(rng);
const initiatorStatic = generateKeypair(rng);

// --- handshake ---
const initiator = createInitiator(initiatorStatic, responderStatic.pub, rng);
const responder = new HandshakeState(false, responderStatic, null, new Uint8Array(0), rng);

const msg1 = initiator.writeMessage1(enc.encode('hello-from-initiator'));
const r1 = responder.readMessage(IK_MSG1, msg1, false);
check('responder reads msg1 payload', dec.decode(r1.payload) === 'hello-from-initiator');

const w2 = responder.writeMessage(IK_MSG2, enc.encode('hello-from-responder'), true);
const r2 = initiator.readMessage2(w2.message);
check('initiator reads msg2 payload', dec.decode(r2.payload) === 'hello-from-responder');

const init = r2.transport;
const resp = w2.split!;

// --- transport, both directions, multiple messages (nonce increments) ---
const c1 = init.send.encrypt(AD, enc.encode('c→s #1'));
check('server decrypts c→s #1', dec.decode(resp.recv.decrypt(AD, c1)) === 'c→s #1');
const s1 = resp.send.encrypt(AD, enc.encode('s→c #1'));
check('client decrypts s→c #1', dec.decode(init.recv.decrypt(AD, s1)) === 's→c #1');
const c2 = init.send.encrypt(AD, enc.encode('c→s #2'));
check('server decrypts c→s #2 (nonce++)', dec.decode(resp.recv.decrypt(AD, c2)) === 'c→s #2');

// --- imposter responder static key must be rejected ---
const imposter = createInitiator(generateKeypair(rng), generateKeypair(rng).pub, rng);
const badMsg1 = imposter.writeMessage1(enc.encode('x'));
const freshResponder = new HandshakeState(false, responderStatic, null, new Uint8Array(0), rng);
let rejected = false;
try { freshResponder.readMessage(IK_MSG1, badMsg1, false); } catch { rejected = true; }
check('imposter responder-key rejected', rejected);

console.log(failures === 0 ? '\nALL OK ✓' : `\n${failures} FAILURE(S) ❌`);
process.exit(failures === 0 ? 0 : 1);
