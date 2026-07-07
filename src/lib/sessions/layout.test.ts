import test from 'node:test';
import assert from 'node:assert/strict';
import { inputBottomPadding } from './layout';

test('keyboard down → base gap plus the safe-area inset', () => {
  assert.equal(
    inputBottomPadding({ keyboardHeight: 0, reservedBelow: 0, safeAreaBottom: 34 }),
    42,
  );
});

test('keyboard down with space already reserved below (old tab-bar case) → just the base', () => {
  assert.equal(
    inputBottomPadding({ keyboardHeight: 0, reservedBelow: 83, safeAreaBottom: 0 }),
    8,
  );
});

test('keyboard up on a full-screen page → lift by the whole keyboard', () => {
  // kb covers the home indicator, so the safe-area inset is NOT added on top
  assert.equal(
    inputBottomPadding({ keyboardHeight: 336, reservedBelow: 0, safeAreaBottom: 34 }),
    344,
  );
});

test('keyboard up over an in-flow tab bar → lift only by the part above it (c97cdce)', () => {
  assert.equal(
    inputBottomPadding({ keyboardHeight: 336, reservedBelow: 83, safeAreaBottom: 0 }),
    261,
  );
});

test('never sinks below the base gap when the reserved space exceeds the keyboard', () => {
  assert.equal(
    inputBottomPadding({ keyboardHeight: 50, reservedBelow: 400, safeAreaBottom: 0 }),
    8,
  );
});

test('honours a custom base gap', () => {
  assert.equal(
    inputBottomPadding({ keyboardHeight: 0, reservedBelow: 0, safeAreaBottom: 0, base: 12 }),
    12,
  );
});
