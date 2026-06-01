// Smoke test: confirms the jest-expo runner is wired up and can execute a
// TypeScript suite. If this fails, the test framework itself is broken — debug
// jest.config.js before looking at any other suite.

describe('jest-expo runner', () => {
  it('runs TypeScript tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('has base64 globals available (used by github.ts blob encode/decode)', () => {
    expect(typeof btoa).toBe('function');
    expect(typeof atob).toBe('function');
    expect(atob(btoa('hello'))).toBe('hello');
  });
});
