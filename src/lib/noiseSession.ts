// Framing helpers for the tunnel's Noise transport (#16 / #197).
//
// After the Noise IK handshake completes, every application message is a single
// JSON object carried as ONE Noise transport message on a BINARY WebSocket frame —
// raw ciphertext, no base64, no length prefix, no associated data. This must match
// the desktop responder byte-for-byte (`base-studio-code/src-tauri/src/tunnel.rs`,
// which does `serde_json::to_vec(msg)` → `write_message` → `Message::Binary`).
//
// Kept separate from the socket plumbing so it's pure and testable against an
// in-process responder (see `scripts/tunnel-selftest.ts`).
import type { CipherState } from './noise/noise';

const EMPTY = new Uint8Array(0);
const encoder = new TextEncoder();

/** Decode a standard base64 string (e.g. the QR `hostPubKey`) to bytes. RN ships
 *  `atob` but not `Buffer`, so we expand the binary string by char code. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Coerce a WebSocket binary payload (ArrayBuffer or view) to a Uint8Array. */
export function toBytes(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  return data instanceof Uint8Array
    ? data
    : ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
}

export function utf8Encode(s: string): Uint8Array {
  return encoder.encode(s);
}

/** Minimal UTF-8 decoder — avoids depending on `TextDecoder` being present on the
 *  Hermes runtime (terminal output can carry arbitrary multi-byte UTF-8). */
export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if (b0 < 0xe0) {
      const b1 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
    } else if (b0 < 0xf0) {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
    } else {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      const b3 = bytes[i++] & 0x3f;
      let cp = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3;
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

/** Encrypt one app message (JSON) into a Noise transport frame. */
export function sealFrame(send: CipherState, msg: unknown): Uint8Array {
  return send.encrypt(EMPTY, utf8Encode(JSON.stringify(msg)));
}

/** Decrypt + parse one Noise transport frame back into an app message. Throws on a
 *  bad tag (tampered / desynced) or malformed JSON — the caller treats that as a
 *  fatal session error and reconnects. */
export function openFrame<T>(recv: CipherState, frame: Uint8Array): T {
  return JSON.parse(utf8Decode(recv.decrypt(EMPTY, frame))) as T;
}
