- M-jest+#14 done: stood up jest-expo (testEnvironment node, mocks ./fs + global fetch), added test/test:ci scripts + a CI 'Unit tests' job; 10 tests green covering write_file sha:null recording and the sha:null push create + not_found recovery (manifest left intact for retry).

- #15/#16 deferred, NOT closed: this branch (mobile-core off develop) has no Noise IK relay client merged — tunnel.ts is the plain versioned-WS client and types.ts has no protocol version field, so #15's versioned-schema + mismatch-fallback acceptance is unmet and there's no QR pairing for #16. Both are P3/v0.2.0 and labeled stream:mobile-tunnel-wiring (not mobile-core); the rewrite depends on base #46 schema + #35 ws-server which aren't in this repo yet. Left them open for the tunnel-wiring stream rather than rewriting prematurely.

- ci.yml only triggered on main; PR #44 targets develop so the M-jest CI gate ran no checks. Fixed trigger to pull_request -> [develop, main], dropped push trigger (PR-only CI convention). Committed f92f59a on mobile-core; awaiting push approval.

