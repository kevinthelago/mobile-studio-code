// Shared fixture-decode helpers for the tunnel contract parity tests (#246).
//
// Lifted verbatim out of `tunnelProtocol.fixtures.test.ts` so the FRAME parity test and the
// forthcoming PAYLOAD parity test (`storePayloads.fixtures.test.ts`) share one definition
// instead of two copies that can drift from each other — which would be an unusually silly
// way to fail at contract-drift detection.
//
// The idiom these implement: decode a raw fixture object by copying ONLY the fields the
// mobile model recognizes, then deep-equal the result back against the raw. That fails on
// drift in BOTH directions:
//   • a fixture field the model doesn't know   → never copied → extra key in raw → mismatch
//   • a field the model expects but lacks      → the typed getter throws, naming the field
//
// NOTE the deliberate asymmetry between the required getters and the `copyOpt*` helpers: an
// optional field that DISAPPEARS from the wire is not caught here, because "absent" is legal
// for it. That hole is exactly how base-studio-code#2541 deleted `ProjectLite.status` without
// tripping anything (#238), and it is why the payload harness pairs this layer with a
// selector smoke test rather than relying on re-encode alone.
//
// Not named `*.test.ts` so the `npm test` glob does not try to run it as a suite.
import assert from 'node:assert/strict';

/** An undecoded fixture object straight from JSON. */
export type Raw = Record<string, unknown>;

// ── Required field getters — assert presence + JS type, returning the value. ──

export function str(o: Raw, k: string): string {
  assert.equal(typeof o[k], 'string', `field "${k}" must be a string`);
  return o[k] as string;
}

export function num(o: Raw, k: string): number {
  assert.equal(typeof o[k], 'number', `field "${k}" must be a number`);
  return o[k] as number;
}

export function bool(o: Raw, k: string): boolean {
  assert.equal(typeof o[k], 'boolean', `field "${k}" must be a boolean`);
  return o[k] as boolean;
}

/** Required value that may legitimately be null (e.g. `session_state.prompt`). */
export function strOrNull(o: Raw, k: string): string | null {
  assert.ok(o[k] === null || typeof o[k] === 'string', `field "${k}" must be string|null`);
  return o[k] as string | null;
}

export function arr(o: Raw, k: string): Raw[] {
  assert.ok(Array.isArray(o[k]), `field "${k}" must be an array`);
  return o[k] as Raw[];
}

/** A `Record<string, string>` field (e.g. `plan_sync_manifest.files`). */
export function strRecord(o: Raw, k: string): Record<string, string> {
  const v = o[k];
  assert.ok(v !== null && typeof v === 'object' && !Array.isArray(v), `field "${k}" must be an object`);
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    assert.equal(typeof val, 'string', `field "${k}.${key}" must be a string`);
    out[key] = val as string;
  }
  return out;
}

// ── Optional field copiers — copy only when present, so deep-equal stays exact. ──

export function copyOptStr(src: Raw, dst: Raw, k: string): void {
  if (k in src) dst[k] = str(src, k);
}

export function copyOptNum(src: Raw, dst: Raw, k: string): void {
  if (k in src) dst[k] = num(src, k);
}

export function copyOptBool(src: Raw, dst: Raw, k: string): void {
  if (k in src) dst[k] = bool(src, k);
}
