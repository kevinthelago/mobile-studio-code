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

**Coordination points to confirm with the desktop:**
1. **Prologue** — empty (`""`) here. If snow mixes a prologue (protocol id, room,
   version), it must match exactly; update the vector.
2. **Transport message framing** — each app message is one Noise transport
   message (ciphertext above) sent as a **binary** WebSocket frame. No extra
   length prefix unless the relay requires one — confirm.
3. **Associated data** — none on transport messages here (`encrypt(ad=∅, …)`).
