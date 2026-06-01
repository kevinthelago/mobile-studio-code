// Replays src/lib/noise/noise-vectors.json through the JS Noise impl and asserts
// every wire byte matches. This is the cross-impl interop harness: the desktop
// loads the SAME vector and asserts Rust `snow` produces identical bytes (and
// decrypts ours). If both sides pass, the impls are byte-compatible.
// Run: node --experimental-strip-types scripts/noise-interop.ts
import { readFileSync } from 'node:fs';
import { x25519 } from '@noble/curves/ed25519.js';
import {
  createInitiator, HandshakeState, IK_MSG1, IK_MSG2,
  type Keypair, type Rng,
} from '../src/lib/noise/noise.ts';

const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const keypair = (priv: Uint8Array): Keypair => ({ priv, pub: x25519.getPublicKey(priv) });
const fixedRng = (priv: Uint8Array): Rng => () => priv.slice();

const v = JSON.parse(readFileSync(new URL('../src/lib/noise/noise-vectors.json', import.meta.url), 'utf8'));
let failures = 0;
const eq = (label: string, got: string, want: string) => {
  const ok = got === want;
  console.log(`${ok ? '✓' : '❌'} ${label}`);
  if (!ok) { failures++; console.log(`    got  ${got}\n    want ${want}`); }
};

const initStatic = keypair(bytes(v.init_static));
const respStatic = keypair(bytes(v.resp_static));
const prologue = bytes(v.init_prologue);

const initiator = createInitiator(initStatic, bytes(v.init_remote_static), fixedRng(bytes(v.init_ephemeral)), prologue);
const responder = new HandshakeState(false, respStatic, null, prologue, fixedRng(bytes(v.resp_ephemeral)));

// msg1: initiator writes, responder reads
const msg1 = initiator.writeMessage1(bytes(v.messages[0].payload));
eq('msg1 bytes match vector', hex(msg1), v.messages[0].ciphertext);
const r1 = responder.readMessage(IK_MSG1, msg1, false);
eq('responder recovers msg1 payload', hex(r1.payload), v.messages[0].payload);

// msg2: responder writes, initiator reads
const w2 = responder.writeMessage(IK_MSG2, bytes(v.messages[1].payload), true);
eq('msg2 bytes match vector', hex(w2.message), v.messages[1].ciphertext);
const r2 = initiator.readMessage2(w2.message);
eq('initiator recovers msg2 payload', hex(r2.payload), v.messages[1].payload);

// transport, both directions
const t1 = r2.transport.send.encrypt(new Uint8Array(0), bytes(v.messages[2].payload));
eq('transport c->s bytes match vector', hex(t1), v.messages[2].ciphertext);
eq('responder decrypts c->s', hex(w2.split!.recv.decrypt(new Uint8Array(0), bytes(v.messages[2].ciphertext))), v.messages[2].payload);

const t2 = w2.split!.send.encrypt(new Uint8Array(0), bytes(v.messages[3].payload));
eq('transport s->c bytes match vector', hex(t2), v.messages[3].ciphertext);
eq('initiator decrypts s->c', hex(r2.transport.recv.decrypt(new Uint8Array(0), bytes(v.messages[3].ciphertext))), v.messages[3].payload);

console.log(failures === 0 ? '\nINTEROP VECTOR OK ✓' : `\n${failures} MISMATCH(ES) ❌`);
process.exit(failures === 0 ? 0 : 1);
