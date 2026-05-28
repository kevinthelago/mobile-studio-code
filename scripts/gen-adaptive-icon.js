// Generates assets/adaptive-icon.png — the Android adaptive-icon foreground.
//
// The mark is the app's "Claude orb": the same #d97757 -> #ffaecf diagonal
// gradient disc used by src/components/ui/ClaudeAvatar.tsx, on a transparent
// background so the adaptiveIcon backgroundColor (#0b0d14) shows behind it.
//
// Pure Node (zlib only) so it needs no extra dependencies. Re-run with:
//   node scripts/gen-adaptive-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;
// Orb diameter 600px (radius 300), centered. Android adaptive icons get masked
// to the launcher's shape (circle, squircle, rounded square, teardrop...), and
// only the central 66% of the foreground image is guaranteed visible — the
// "safe zone" is 0.66 * 1024 ≈ 676px. A 600px disc (radius 300) sits
// comfortably inside that, so the mark survives every mask. Do not enlarge the
// radius without re-checking the safe zone on the launcher shapes.
const R = 300;
const CX = (SIZE - 1) / 2;
const CY = (SIZE - 1) / 2;
const FROM = [0xd9, 0x77, 0x57]; // #d97757 (top-left)
const TO = [0xff, 0xae, 0xcf]; // #ffaecf (bottom-right)

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1)); // +1 filter byte per row
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // filter: None
  for (let x = 0; x < SIZE; x++) {
    const dist = Math.hypot(x - CX, y - CY);
    // 1px anti-aliased edge coverage.
    const coverage = Math.max(0, Math.min(1, R - dist + 0.5));
    const t = (x + y) / (2 * (SIZE - 1)); // diagonal gradient param 0..1
    raw[p++] = lerp(FROM[0], TO[0], t);
    raw[p++] = lerp(FROM[1], TO[1], t);
    raw[p++] = lerp(FROM[2], TO[2], t);
    raw[p++] = Math.round(255 * coverage);
  }
}

// --- minimal PNG encoder (8-bit RGBA) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
// 10,11,12 = compression/filter/interlace = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'assets', 'adaptive-icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes, ${SIZE}x${SIZE})`);
