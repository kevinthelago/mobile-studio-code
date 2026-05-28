// Color helpers for the redesign primitives.

/**
 * Convert a `#rrggbb` token to an `rgba()` string at the given alpha.
 *
 * The redesign's CSS uses `color-mix(in oklch, <token>, transparent <n>%)` for
 * tints; React Native has no `color-mix`, so we approximate by emitting rgba()
 * at the equivalent alpha (`transparent 88%` → alpha 0.12, etc.). Not
 * perceptually identical to oklch mixing, but visually close at MSC's palette.
 *
 * Falls back to returning the input unchanged if it isn't a 6-digit hex (e.g.
 * an already-rgba() value), so callers can pass theme tokens safely.
 */
export function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}
