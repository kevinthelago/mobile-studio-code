# Noise IK — mobile tunnel crypto

The mobile tunnel is end-to-end encrypted with **Noise IK** so the relay (a
blind Cloudflare Worker pipe) can't read terminal data. The desktop
(`base-studio-code`) is the **responder**; this app is the **initiator** and
learns the desktop's static public key out-of-band from the pairing QR.

- Pattern: `Noise_IK_25519_ChaChaPoly_BLAKE2s` (X25519 · ChaCha20-Poly1305 · BLAKE2s)
- `noise.ts` — the state machine (initiator + responder), pure, RNG injected.
- `random.ts` — on-device CSPRNG (`expo-crypto`).
- `noise-vectors.json` — the interop vector (below).
- The QR `psk` is the **app-level auth token** (sent in `auth {token}` after the
  handshake), **not** a Noise PSK modifier — so the pattern is plain IK.

## Cross-impl interop (the #1 risk)

The JS impl must be **byte-compatible with the desktop's Rust `snow`**. We prove
this with a deterministic vector rather than a live handshake.

```bash
npm run test:noise           # internal round-trip + imposter-key rejection
npm run test:noise:interop   # replay noise-vectors.json, assert byte-equality
npm run test:noise:vectors   # regenerate noise-vectors.json from the JS impl
```

### What the desktop side must do

`noise-vectors.json` is in the **cacophony / noise-c** vector format. On the
desktop, load the same file and, using `snow` configured as
`Noise_IK_25519_ChaChaPoly_BLAKE2s`, drive a handshake with the fixed keys:

| field | meaning |
|---|---|
| `init_static`, `init_ephemeral` | initiator (mobile) private keys (hex) |
| `init_remote_static` | responder static **public** key the initiator knows |
| `resp_static`, `resp_ephemeral` | responder (desktop) private keys (hex) |
| `init_prologue` | prologue — **empty here; confirm snow uses the same** |
| `messages[]` | `{payload, ciphertext}` in order: msg1 (i→r), msg2 (r→i), transport (i→r), transport (r→i) |

Assert that `snow`, fed the same fixed keys/ephemerals, produces **identical
`ciphertext`** for each message and correctly **decrypts ours**. Any mismatch is
an interop bug to resolve before the mobile transport/session is built.

**Coordination points (confirmed against the desktop `tunnel.rs` / relay, #16):**
1. **Prologue** — empty (`""`). The desktop builds the same `Noise_IK_…` with no
   prologue; the relay never mixes into the handshake.
2. **Transport message framing** — each app message is one Noise transport message
   sent as a **binary** WebSocket frame, **raw ciphertext, no length prefix** (the
   relay is a blind byte pipe and preserves frame boundaries). The desktop side does
   `serde_json::to_vec(msg)` → `write_message` → `Message::Binary`.
3. **Associated data** — none on transport messages (`encrypt(ad=∅, …)`).
4. **Relay envelope** — there is none on the wire: the room is in the
   `…/connect?room=<room>&role=guest|host` upgrade URL, and the DO forwards each
   frame verbatim to the other peer. The mobile is always `role=guest`.
5. **Auth** — the QR `psk` is the app-level token in the first in-session frame
   (`auth { token: psk }`), not a Noise PSK modifier.

The transport that uses all of the above lives in `../noiseSession.ts` (framing) and
`../tunnel.ts` (`TunnelClient`); `npm run test:tunnel` exercises the handshake + framing
round-trip in-process.
