// FNV-1a (32-bit) hash used for per-file change detection in the plan sync
// manifest. Both mobile (this file) and the desktop must produce identical
// output for the same UTF-8 content — the plannerCore.fixtures.json fixture
// includes known vectors for cross-platform validation.
//
// Algorithm: offset_basis = 2166136261, prime = 16777619 (32-bit).
// Input is UTF-8 encoded (via TextEncoder) so byte streams match across
// platforms regardless of JS string encoding.
// Math.imul performs wrapping 32-bit multiplication.

const encoder = new TextEncoder();

/** Returns the FNV-1a hash of text as an 8-char lowercase hex string. */
export function fnv1a(text: string): string {
  const bytes = encoder.encode(text);
  let h = 2166136261; // offset_basis (unsigned 32-bit)
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619); // wrapping 32-bit multiply (FNV prime)
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
