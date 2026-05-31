// Jest configuration for Mobile Studio Code.
//
// We test the pure standalone logic (the agent tool runner, the GitHub push
// pipeline) rather than rendered React Native screens, so we run on the `node`
// test environment and mock the Expo / Anthropic native surface in each suite.
// The `jest-expo` preset is still used so the Babel transform matches the app's
// (`babel-preset-expo`) and future component tests can drop in without reconfig.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  // The Noise / tunnel self-tests are standalone node scripts (run via the
  // `test:noise*` / `test:tunnel` npm scripts), not jest suites — exclude them.
  modulePathIgnorePatterns: ['<rootDir>/scripts/'],
};
