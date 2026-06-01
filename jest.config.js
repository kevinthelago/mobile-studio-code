/**
 * jest-expo runner for Mobile Studio Code.
 *
 * Introduced in mobile v0.1.0 (#14) as the first automated test framework for
 * this repo — `tsc --noEmit` was previously the only correctness gate. The
 * jest-expo preset wires up the Expo / React Native module transforms so tests
 * can import app code (which transitively imports `expo-*` packages) without a
 * device or Metro bundler.
 *
 * Tests live under `src/**​/__tests__`. Pure-logic suites mock `./fs` (the only
 * native dependency, `expo-file-system`) and the global `fetch`, so they run in
 * plain Node with no simulator.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // Speed: these suites never touch a DOM. node is lighter than jsdom and the
  // lib code under test is environment-agnostic.
  testEnvironment: 'node',
  clearMocks: true,
};
