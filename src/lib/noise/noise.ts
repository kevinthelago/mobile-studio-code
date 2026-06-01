// Noise_IK_25519_ChaChaPoly_BLAKE2s — initiator + responder state machine.
//
// Hand-rolled on audited @noble primitives because there's no turnkey RN Noise
// lib. This MUST be byte-compatible with the desktop's Rust `snow` responder —
// treat cross-impl interop as the #1 risk and verify with a handshake against a
// running relay before trusting it. (A JS round-trip self-test lives alongside;
// it proves the state machine is internally consistent, not snow-interop.)
//
// Spec: https://noiseprotocol.org/noise.html (rev 34). IK pattern:
//   <- s                       (pre-message: responder static, known to us)
//   -> e, es, s, ss            (msg1, initiator → responder)
//   <- e, ee, se               (msg2, responder → initiator)
// `psk` from the QR is NOT a Noise PSK modifier — it's the app-level auth token
// sent in the first transport message. So the pattern is plain IK.

import { x25519 } from '@noble/curves/ed25519.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { blake2s } from '@noble/hashes/blake2.js';
import { hmac } from '@noble/hashes/hmac.js';

export const PROTOCOL_NAME = 'Noise_IK_25519_ChaChaPoly_BLAKE2s';
const DHLEN = 32;
const HASHLEN = 32;
const TAGLEN = 16;

export type Keypair = { priv: Uint8Array; pub: Uint8Array };
export type Rng = (bytes: number) => Uint8Array;

const EMPTY = new Uint8Array(0);

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function hash(data: Uint8Array): Uint8Array {
  return blake2s(data);
}

// HKDF per Noise (HMAC-BLAKE2s), returning `num` 32-byte outputs.
function hkdf(chainingKey: Uint8Array, ikm: Uint8Array, num: 2 | 3): Uint8Array[] {
  const tempKey = hmac(blake2s, chainingKey, ikm);
  const o1 = hmac(blake2s, tempKey, new Uint8Array([0x01]));
  const o2 = hmac(blake2s, tempKey, concat(o1, new Uint8Array([0x02])));
  if (num === 2) return [o1, o2];
  const o3 = hmac(blake2s, tempKey, concat(o2, new Uint8Array([0x03])));
  return [o1, o2, o3];
}

// 12-byte ChaChaPoly nonce: 4 zero bytes + 64-bit little-endian counter.
// Avoids BigInt (counters stay well under 2^32 for our traffic).
function nonceBytes(n: number): Uint8Array {
  const buf = new Uint8Array(12);
  const view = new DataView(buf.buffer);
  view.setUint32(4, n >>> 0, true);
  view.setUint32(8, Math.floor(n / 0x100000000), true);
  return buf;
}

function aeadEncrypt(key: Uint8Array, n: number, ad: Uint8Array, pt: Uint8Array): Uint8Array {
  return chacha20poly1305(key, nonceBytes(n), ad).encrypt(pt);
}
function aeadDecrypt(key: Uint8Array, n: number, ad: Uint8Array, ct: Uint8Array): Uint8Array {
  return chacha20poly1305(key, nonceBytes(n), ad).decrypt(ct);
}

function dh(priv: Uint8Array, pub: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(priv, pub);
}

export function generateKeypair(rng: Rng): Keypair {
  // Any 32 random bytes are a valid X25519 secret (clamping is applied inside
  // getPublicKey/getSharedSecret), so we don't need @noble's internal RNG.
  const priv = rng(DHLEN);
  return { priv, pub: x25519.getPublicKey(priv) };
}

/** Transport cipher: one ChaChaPoly key with a monotonic 64-bit counter. */
export class CipherState {
  private n = 0;
  private readonly k: Uint8Array;
  constructor(k: Uint8Array) { this.k = k; }
  encrypt(ad: Uint8Array, pt: Uint8Array): Uint8Array {
    return aeadEncrypt(this.k, this.n++, ad, pt);
  }
  decrypt(ad: Uint8Array, ct: Uint8Array): Uint8Array {
    return aeadDecrypt(this.k, this.n++, ad, ct);
  }
}

class SymmetricState {
  ck: Uint8Array;
  h: Uint8Array;
  private k: Uint8Array | null = null;
  private n = 0;

  constructor(protocolName: string) {
    const name = new TextEncoder().encode(protocolName);
    this.h = name.length <= HASHLEN
      ? concat(name, new Uint8Array(HASHLEN - name.length))
      : hash(name);
    this.ck = this.h;
  }

  mixKey(ikm: Uint8Array): void {
    const [ck, tempK] = hkdf(this.ck, ikm, 2);
    this.ck = ck;
    this.k = tempK;
    this.n = 0;
  }

  mixHash(data: Uint8Array): void {
    this.h = hash(concat(this.h, data));
  }

  encryptAndHash(pt: Uint8Array): Uint8Array {
    const ct = this.k ? aeadEncrypt(this.k, this.n++, this.h, pt) : pt;
    this.mixHash(ct);
    return ct;
  }

  decryptAndHash(ct: Uint8Array): Uint8Array {
    const pt = this.k ? aeadDecrypt(this.k, this.n++, this.h, ct) : ct;
    this.mixHash(ct);
    return pt;
  }

  split(): [CipherState, CipherState] {
    const [t1, t2] = hkdf(this.ck, EMPTY, 2);
    return [new CipherState(t1), new CipherState(t2)];
  }
}

export type Token = 'e' | 's' | 'ee' | 'es' | 'se' | 'ss';
export const IK_MSG1: Token[] = ['e', 'es', 's', 'ss'];
export const IK_MSG2: Token[] = ['e', 'ee', 'se'];

/** Result of a terminal handshake message: payload + the split transport ciphers. */
export type Split = { send: CipherState; recv: CipherState };

export class HandshakeState {
  private readonly sym: SymmetricState;
  private readonly initiator: boolean;
  private readonly s: Keypair;
  private readonly rng: Rng;
  private e: Keypair | null = null;
  private re: Uint8Array | null = null;
  private rs: Uint8Array | null;

  constructor(
    initiator: boolean,
    s: Keypair,
    remoteStatic: Uint8Array | null,
    prologue: Uint8Array,
    rng: Rng,
  ) {
    this.initiator = initiator;
    this.s = s;
    this.rng = rng;
    this.rs = remoteStatic;
    this.sym = new SymmetricState(PROTOCOL_NAME);
    this.sym.mixHash(prologue);
    // IK pre-message is the responder's static key ("<- s").
    this.sym.mixHash(initiator ? (remoteStatic as Uint8Array) : s.pub);
  }

  private mixDh(token: Token): void {
    switch (token) {
      case 'ee': this.sym.mixKey(dh(this.e!.priv, this.re!)); break;
      case 'es':
        this.sym.mixKey(this.initiator ? dh(this.e!.priv, this.rs!) : dh(this.s.priv, this.re!));
        break;
      case 'se':
        this.sym.mixKey(this.initiator ? dh(this.s.priv, this.re!) : dh(this.e!.priv, this.rs!));
        break;
      case 'ss': this.sym.mixKey(dh(this.s.priv, this.rs!)); break;
      default: break;
    }
  }

  /** Writes a handshake message. Returns the wire bytes and, if terminal, the split. */
  writeMessage(tokens: Token[], payload: Uint8Array, terminal: boolean): { message: Uint8Array; split?: Split } {
    let buf: Uint8Array = new Uint8Array(0);
    for (const token of tokens) {
      if (token === 'e') {
        this.e = generateKeypair(this.rng);
        this.sym.mixHash(this.e.pub);
        buf = concat(buf, this.e.pub);
      } else if (token === 's') {
        buf = concat(buf, this.sym.encryptAndHash(this.s.pub));
      } else {
        this.mixDh(token);
      }
    }
    buf = concat(buf, this.sym.encryptAndHash(payload));
    return terminal ? { message: buf, split: this.splitForRole() } : { message: buf };
  }

  /** Reads a handshake message. Returns the payload and, if terminal, the split. */
  readMessage(tokens: Token[], message: Uint8Array, terminal: boolean): { payload: Uint8Array; split?: Split } {
    let rest = message;
    for (const token of tokens) {
      if (token === 'e') {
        this.re = rest.slice(0, DHLEN);
        rest = rest.slice(DHLEN);
        this.sym.mixHash(this.re);
      } else if (token === 's') {
        const len = DHLEN + TAGLEN; // remote static always encrypted here (key set)
        this.rs = this.sym.decryptAndHash(rest.slice(0, len));
        rest = rest.slice(len);
      } else {
        this.mixDh(token);
      }
    }
    const payload = this.sym.decryptAndHash(rest);
    return terminal ? { payload, split: this.splitForRole() } : { payload };
  }

  private splitForRole(): Split {
    const [c1, c2] = this.sym.split();
    // Initiator sends with c1 / receives with c2; responder is mirrored.
    return this.initiator ? { send: c1, recv: c2 } : { send: c2, recv: c1 };
  }
}

/**
 * Initiator driver for IK. Generates/uses a static keypair, knows the
 * responder's static (`remoteStatic`, from the QR's hostPubKey).
 *   1. msg1 = writeMessage1(payload?)  → send as a binary frame
 *   2. readMessage2(msg2 bytes)        → returns the transport ciphers
 */
export function createInitiator(
  staticKeypair: Keypair,
  remoteStatic: Uint8Array,
  rng: Rng,
  prologue: Uint8Array = EMPTY,
) {
  const hs = new HandshakeState(true, staticKeypair, remoteStatic, prologue, rng);
  let split: Split | null = null;
  return {
    writeMessage1(payload: Uint8Array = EMPTY): Uint8Array {
      return hs.writeMessage(IK_MSG1, payload, false).message;
    },
    readMessage2(message: Uint8Array): { payload: Uint8Array; transport: Split } {
      const r = hs.readMessage(IK_MSG2, message, true);
      split = r.split!;
      return { payload: r.payload, transport: split };
    },
    get transport(): Split | null { return split; },
  };
}
