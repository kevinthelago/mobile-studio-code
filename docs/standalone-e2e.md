# Standalone E2E — release gate scenario

Mobile Studio Code must work as a **fully standalone** IDE: a phone with a GitHub
PAT and an Anthropic API key, talking directly to GitHub (REST) and Claude, with
**no desktop, server, or tunnel involved**. This document is the manual release
gate that proves the standalone path still works end to end before any build is
cut. Run it on a real device (or a dev build) with the **tunnel disabled and no
desktop paired**.

Related: issue #13 (this scenario), issue #12 (standalone-first architecture).
The automated half of this coverage lives in `src/lib/__tests__/` (the agent
`write_file` manifest bookkeeping and the `github.ts` push pipeline) and runs via
`npm test`; this doc covers what those unit tests can't — the real network round
trip to GitHub and Anthropic.

## Preconditions

- A fresh app install (or Settings → reset credentials / clear repo).
- A GitHub fine-grained PAT with **Contents: read+write** (and **Workflows:
  read+write** only if you'll touch `.github/workflows/`) for a scratch repo you
  own.
- A valid Anthropic API key.
- No desktop Studio Code paired. The Run and Plan tabs should show their
  "offline / pair to enable" empty states — confirm the rest of the app is still
  fully usable. This is the core invariant: **standalone never depends on the tunnel.**

## Scenario (must pass)

1. **Enter keys.** Launch the app. Provide the GitHub PAT and Anthropic API key
   when prompted (just-in-time; there is no onboarding gate). Verify each key is
   accepted (PAT verified against `GET /user`).
2. **Pick a repo.** Open the repo picker (`/repo`), search for the scratch repo,
   and clone it. Verify the file tree populates in the Files tab and a manifest
   (`.msc-manifest.json`) is written.
3. **Agent edits a file.** In the Edit tab chat dock, ask Claude to make a small,
   verifiable change — e.g. *"add a line to README.md that says HELLO-E2E"*.
   Verify the agent calls `write_file` and the file shows as modified (dot in the
   tree / Git tab). For a brand-new file, confirm it's created locally and tracked
   with `sha: null`.
4. **Commit (push).** Go to the Git tab. Optionally draft the commit message with
   Claude. Push. Verify the push reports success (one atomic commit) and the
   modified count returns to zero.
5. **Verify on GitHub.** In a browser / the GitHub app, open the repo on the
   branch you pushed to and confirm the change is present in the latest commit
   (and that a brand-new file was created, not just modified).

## Pass criteria

- Every step above completes with the **tunnel disabled / no desktop present**.
- The pushed change is visible on GitHub on the expected branch.
- No step requires pairing, a relay, or any companion process.

## Failure-mode spot checks (optional but recommended)

- **New file that already exists on remote** → push reports a `sha_mismatch`
  asking you to pull first (not a silent overwrite, not a bare `not_found`).
- **Wrong/expired PAT or wrong branch** → push reports `auth` / `not_found` with
  an actionable message, and the app stays usable after re-entering a good token.

If any step fails, the standalone path is broken — block the release regardless
of tunnel/Plan progress.
