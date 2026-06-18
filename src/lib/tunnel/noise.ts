import { x25519 } from '@noble/curves/ed25519.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { blake2s } from '@noble/hashes/blake2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

// Noise_IK_25519_ChaChaPoly_BLAKE2s — hand-written to match base-studio-code's
// tunnel. The mobile is the IK *initiator*; it pins the desktop's static public
// key (from the pairing QR's hostPubKey). Pure JS via @noble so it runs in
// Expo-managed RN with no native crypto module. Both roles are implemented so
// the handshake can be loopback-tested.

const PROTOCOL_NAME = 'Noise_IK_25519_ChaChaPoly_BLAKE2s';
const EMPTY = new Uint8Array(0);
const HASHLEN = 32;
const DHLEN = 32;
const TAGLEN = 16;

export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

// CSPRNG for key generation. expo-crypto is required lazily (it's a native
// module that drags in react-native) so off-device tests can override the RNG
// before the first call without loading it.
let randomBytesFn: (length: number) => Uint8Array = (length) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Crypto = require('expo-crypto') as { getRandomBytes(n: number): Uint8Array };
  return Crypto.getRandomBytes(length);
};

/** Test-only: swap the CSPRNG (e.g. for Node's crypto under tsx). */
export function __setRandomBytesForTest(fn: (n: number) => Uint8Array) {
  randomBytesFn = fn;
}

function generateKeyPair(): KeyPair {
  const secretKey = randomBytesFn(32);
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

function dh(local: KeyPair, remotePub: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(local.secretKey, remotePub);
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// Noise HKDF (HMAC-BLAKE2s), returning `numOutputs` 32-byte values.
function hkdf(ck: Uint8Array, ikm: Uint8Array, numOutputs: 2 | 3): Uint8Array[] {
  const tempKey = hmac(blake2s, ck, ikm);
  const o1 = hmac(blake2s, tempKey, Uint8Array.of(0x01));
  const o2 = hmac(blake2s, tempKey, concat(o1, Uint8Array.of(0x02)));
  if (numOutputs === 2) return [o1, o2];
  const o3 = hmac(blake2s, tempKey, concat(o2, Uint8Array.of(0x03)));
  return [o1, o2, o3];
}

// ChaChaPoly nonce: 4 zero bytes followed by the 64-bit little-endian counter.
function nonceBytes(n: number): Uint8Array {
  const nonce = new Uint8Array(12);
  let x = n;
  for (let i = 4; i < 12; i++) { nonce[i] = x & 0xff; x = Math.floor(x / 256); }
  return nonce;
}

export class CipherState {
  private k: Uint8Array | null = null;
  private n = 0;

  initializeKey(k: Uint8Array | null) {
    this.k = k;
    this.n = 0;
  }

  hasKey() { return this.k !== null; }

  encryptWithAd(ad: Uint8Array, plaintext: Uint8Array): Uint8Array {
    if (!this.k) return plaintext;
    const ct = chacha20poly1305(this.k, nonceBytes(this.n), ad).encrypt(plaintext);
    this.n += 1;
    return ct;
  }

  decryptWithAd(ad: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    if (!this.k) return ciphertext;
    // @noble throws on a bad auth tag.
    const pt = chacha20poly1305(this.k, nonceBytes(this.n), ad).decrypt(ciphertext);
    this.n += 1;
    return pt;
  }
}

class SymmetricState {
  ck: Uint8Array;
  h: Uint8Array;
  cs = new CipherState();

  constructor(protocolName: string) {
    const pn = utf8ToBytes(protocolName);
    if (pn.length <= HASHLEN) {
      this.h = new Uint8Array(HASHLEN);
      this.h.set(pn);
    } else {
      this.h = blake2s(pn);
    }
    this.ck = this.h.slice();
    this.cs.initializeKey(null);
  }

  mixKey(ikm: Uint8Array) {
    const [ck, tempK] = hkdf(this.ck, ikm, 2);
    this.ck = ck;
    this.cs.initializeKey(tempK.slice(0, 32));
  }

  mixHash(data: Uint8Array) {
    this.h = blake2s(concat(this.h, data));
  }

  encryptAndHash(plaintext: Uint8Array): Uint8Array {
    const ct = this.cs.encryptWithAd(this.h, plaintext);
    this.mixHash(ct);
    return ct;
  }

  decryptAndHash(ciphertext: Uint8Array): Uint8Array {
    const pt = this.cs.decryptWithAd(this.h, ciphertext);
    this.mixHash(ciphertext);
    return pt;
  }

  split(): [CipherState, CipherState] {
    const [k1, k2] = hkdf(this.ck, EMPTY, 2);
    const c1 = new CipherState();
    c1.initializeKey(k1.slice(0, 32));
    const c2 = new CipherState();
    c2.initializeKey(k2.slice(0, 32));
    return [c1, c2];
  }
}

/**
 * IK handshake state. `initiator` = mobile (pins the responder static `rs`);
 * `!initiator` = responder (desktop), used only for the loopback test.
 */
export class HandshakeState {
  private ss: SymmetricState;
  private readonly initiator: boolean;
  private readonly s: KeyPair;
  private e: KeyPair | null = null;
  private rs: Uint8Array | null;
  private re: Uint8Array | null = null;

  constructor(initiator: boolean, prologue: Uint8Array, s: KeyPair, rs: Uint8Array | null) {
    this.ss = new SymmetricState(PROTOCOL_NAME);
    this.ss.mixHash(prologue);
    this.initiator = initiator;
    this.s = s;
    this.rs = rs;
    // IK pre-message `<- s`: the responder's static is known to the initiator.
    this.ss.mixHash(initiator ? rs! : s.publicKey);
  }

  /** Initiator: message 1 (e, es, s, ss). Responder: message 2 (e, ee, se). */
  writeMessage(payload: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];
    this.e = generateKeyPair();
    parts.push(this.e.publicKey);
    this.ss.mixHash(this.e.publicKey);

    if (this.initiator) {
      this.ss.mixKey(dh(this.e, this.rs!));                  // es
      parts.push(this.ss.encryptAndHash(this.s.publicKey));  // s
      this.ss.mixKey(dh(this.s, this.rs!));                  // ss
    } else {
      this.ss.mixKey(dh(this.e, this.re!));                  // ee
      this.ss.mixKey(dh(this.e, this.rs!));                  // se (rs = initiator static)
    }

    parts.push(this.ss.encryptAndHash(payload));
    return concat(...parts);
  }

  /** Initiator: read message 2 (e, ee, se). Responder: read message 1 (e, es, s, ss). */
  readMessage(message: Uint8Array): Uint8Array {
    let i = 0;
    this.re = message.slice(i, i + DHLEN); i += DHLEN;
    this.ss.mixHash(this.re);

    if (this.initiator) {
      this.ss.mixKey(dh(this.e!, this.re));                 // ee
      this.ss.mixKey(dh(this.s, this.re));                  // se
    } else {
      this.ss.mixKey(dh(this.s, this.re));                  // es
      const encStatic = message.slice(i, i + DHLEN + TAGLEN); i += DHLEN + TAGLEN;
      this.rs = this.ss.decryptAndHash(encStatic);          // s
      this.ss.mixKey(dh(this.s, this.rs));                  // ss
    }

    return this.ss.decryptAndHash(message.slice(i));
  }

  split() { return this.ss.split(); }
}

/**
 * High-level initiator session for the mobile tunnel client. Drives the two
 * handshake messages then encrypts/decrypts transport frames.
 */
export class NoiseSession {
  private hs: HandshakeState;
  private send: CipherState | null = null;
  private recv: CipherState | null = null;

  constructor(remoteStaticPub: Uint8Array, prologue: Uint8Array = EMPTY) {
    this.hs = new HandshakeState(true, prologue, generateKeyPair(), remoteStaticPub);
  }

  /** Handshake message 1 to send (binary). */
  startHandshake(): Uint8Array {
    return this.hs.writeMessage(EMPTY);
  }

  /** Process the responder's message 2; enters transport mode. */
  finishHandshake(message2: Uint8Array): void {
    this.hs.readMessage(message2);
    const [c1, c2] = this.hs.split();
    this.send = c1; // initiator sends with c1
    this.recv = c2; // initiator receives with c2
  }

  get ready() { return this.send !== null; }

  encrypt(plaintext: Uint8Array): Uint8Array {
    if (!this.send) throw new Error('Noise: not in transport mode');
    return this.send.encryptWithAd(EMPTY, plaintext);
  }

  decrypt(ciphertext: Uint8Array): Uint8Array {
    if (!this.recv) throw new Error('Noise: not in transport mode');
    return this.recv.decryptWithAd(EMPTY, ciphertext);
  }
}

export { generateKeyPair };
