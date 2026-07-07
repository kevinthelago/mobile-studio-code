// vitestShim — a minimal vitest-compatible facade over node:test + node:assert, so the VENDORED
// graph-core tests (layers/order/cycles/edgePath — copied byte-exact from base-studio-code, which
// runs vitest) need only their import line adapted (`from "vitest"` → `from "./vitestShim"`).
// Implements exactly the expect() surface those four files use — nothing more. Runs under this
// repo's `tsx --test` (node:test) convention.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export { describe, it };

class Expectation {
  constructor(
    private readonly actual: unknown,
    private readonly negated: boolean = false,
  ) {}

  /** Inverts the assertion (`expect(x).not.toBe(y)`). */
  get not(): Expectation {
    return new Expectation(this.actual, !this.negated);
  }

  private check(pass: boolean, message: string): void {
    if (pass === this.negated) {
      assert.fail(`expected ${this.negated ? 'NOT ' : ''}${message}`);
    }
  }

  toBe(expected: unknown): void {
    this.check(Object.is(this.actual, expected), `${format(this.actual)} toBe ${format(expected)}`);
  }

  toEqual(expected: unknown): void {
    let pass = true;
    try {
      assert.deepStrictEqual(this.actual, expected);
    } catch {
      pass = false;
    }
    this.check(pass, `${format(this.actual)} toEqual ${format(expected)}`);
  }

  toBeUndefined(): void {
    this.check(this.actual === undefined, `${format(this.actual)} toBeUndefined`);
  }

  toBeGreaterThan(expected: number): void {
    this.check((this.actual as number) > expected, `${format(this.actual)} toBeGreaterThan ${expected}`);
  }

  toBeLessThan(expected: number): void {
    this.check((this.actual as number) < expected, `${format(this.actual)} toBeLessThan ${expected}`);
  }

  /** vitest semantics: |actual − expected| < 10^−digits / 2 (digits defaults to 2). */
  toBeCloseTo(expected: number, digits: number = 2): void {
    const pass = Math.abs((this.actual as number) - expected) < Math.pow(10, -digits) / 2;
    this.check(pass, `${format(this.actual)} toBeCloseTo ${expected} (±10^-${digits}/2)`);
  }
}

function format(v: unknown): string {
  if (v instanceof Map) return `Map(${JSON.stringify([...v.entries()])})`;
  if (v instanceof Set) return `Set(${JSON.stringify([...v.values()])})`;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

export function expect(actual: unknown): Expectation {
  return new Expectation(actual);
}
