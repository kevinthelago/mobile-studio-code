# Release Gate: Standalone E2E

> **Scenario #1 from the project plan's testing section.** This is a **release
> gate**: it must pass before any build is promoted to a release channel
> (`preview` → internal testers / Ad Hoc, `production` → TestFlight / App Store /
> Play Store internal track). It locks in the standalone path — the app working
> entirely on its own against GitHub + Claude, with **no desktop host and no
> tunnel** — so that future tunnel work (#15/#16) cannot silently break the
> primary workflow.

---

## Why this exists

Mobile Studio Code is a **fully standalone IDE first**; desktop pairing is an
optional, additive capability (see `CLAUDE.md` and issue #12). The standalone
path is the one every user depends on, so it gets a fixed, repeatable,
end-to-end check that a human runs before each release.

There are no automated tests for this flow — it requires a real device, a live
GitHub PAT, and a live Anthropic API key, none of which run in CI. `tsc --noEmit`
remains the only automated gate. **This document is the manual gate.**

---

## Preconditions

| Requirement | Notes |
|---|---|
| Physical iOS device (or Simulator dev build) | The agent loop runs only in the foreground; no background execution. |
| A GitHub PAT | `repo` scope (or fine-grained `Contents: write` + `Metadata: read`). |
| An Anthropic API key | Funded; the agent makes real API calls. |
| A throwaway test repo on GitHub | Small, with at least one editable text file (e.g. `README.md`). |
| **No desktop host / tunnel** | Today the tunnel client (#15) does not exist, so "tunnel disabled" is the default. Once #15 lands, run this with the tunnel **off / unreachable** and confirm the steps below are unaffected. |

Build under test: install the `preview` profile build (`eas build --profile
preview`) on the device, or run a `development` dev client. Do **not** run this
gate against an Expo Go session that differs from the build being released.

---

## The scenario

Each step lists the **action**, the **screen/code path** it exercises, and the
**expected result**. A step "passes" only if the expected result is observed on
the device.

### 1. Enter credentials
- **Action:** Launch a fresh install. On the onboarding screen (`app/setup.tsx`),
  enter the GitHub PAT and the Anthropic API key; submit.
- **Path:** `setup` stage → keys persisted to `expo-secure-store` via
  `src/lib/storage.ts`.
- **Expected:** Keys are accepted (PAT verified against GitHub), and the app
  advances past the `setup` stage. Re-launching the app does **not** ask for keys
  again (they survive from the Keychain).

### 2. Pick and clone a repo
- **Action:** On the repo picker (`app/repo.tsx`), search for the test repo and
  select it.
- **Path:** `repo` stage → `downloadRepo()` in `src/lib/github.ts` (tree fetch +
  blob download) → files written under `expo-file-system` `documentDirectory`;
  `.msc-manifest.json` written via `src/lib/fs.ts`.
- **Expected:** Download completes; the app advances to the `ready` stage and the
  Files tab (`app/(tabs)/index.tsx`) shows the repo's folder tree. The branch
  selected at clone time is the working branch (no branch switching exists).

### 3. Agent edits a file
- **Action:** Open the chat (Edit tab, `app/(tabs)/edit.tsx`) and instruct the
  agent in plain language, e.g. *"Add a line `<!-- e2e: <today's date> -->` to the
  end of README.md."*
- **Path:** `session.tsx` → `runAgent()` in `src/lib/agent.ts` → Anthropic
  (`src/lib/anthropic.ts`) → tool calls `read_file` then `write_file` executed by
  `runTool()`. `write_file` updates the file on disk and marks the manifest entry
  `modified: true`.
- **Expected:** The agent reports completion within the iteration cap
  (`MAX_AGENT_ITERATIONS = 20` in `src/lib/agent.ts`). The Edit tab shows the
  new content. The file is now flagged modified.

### 4. Commit (push) to GitHub
- **Action:** Go to the Git tab (`app/(tabs)/git.tsx`). Confirm the changed file
  appears in the changed-files list. Optionally tap **Draft with Claude** for a
  commit message, then **Push**.
- **Path:** `pushModifiedFiles()` in `src/lib/github.ts` → GitHub **Git Data
  API**: POST a blob per modified file → POST a new tree built on the base tree
  → POST a new commit → PATCH `refs/heads/{branch}` to the new commit. On
  success, each file's manifest SHA is updated and `modified` cleared. This is a
  single atomic commit, *not* per-file `PUT /contents` calls.
- **Expected:** Push succeeds with no error surfaced on the `errorBus`. The
  changed-files list empties; the manifest entry returns to `modified: false`
  with a refreshed `sha`.

### 5. Verify on GitHub
- **Action:** In a browser (or `gh`), open the test repo at the working branch.
- **Expected:** The exact edit from step 3 is present in the file, in a commit
  whose message matches what was pushed in step 4. The commit author/time line
  up with the push.

---

## Pass / fail checklist

Copy this into the release PR or issue and tick every box on the device:

- [ ] **1. Credentials** — PAT + API key accepted; survive relaunch
- [ ] **2. Clone** — repo downloads; Files tab renders the tree; reaches `ready`
- [ ] **3. Agent edit** — agent reads + writes the file; change visible in Edit tab
- [ ] **4. Push** — push succeeds; changed-files list clears; no error
- [ ] **5. Verify** — edit + commit message present on GitHub at the working branch
- [ ] Ran with **no desktop host / tunnel disabled** (default today)

**If any box fails, the build is not releasable.** File a `P0` issue referencing
the failed step before promoting anything.

---

## When to run

- Before promoting a build to `preview` (TestFlight / internal track).
- Before promoting a build to `production` (App Store / Play Store).
- After any change to: `setup.tsx`, `repo.tsx`, `agent.ts`, `github.ts`,
  `fs.ts`, `session.tsx`, or the manifest/push logic.
- **Mandatory** on every PR that touches the tunnel client (#15) or pairing
  (#16), to prove standalone still works with the tunnel off.

---

## Related

- #13 — this gate (definition + acceptance criteria)
- #12 — standalone + optional-tunnel architecture docs
- #14 — automated unit test for the manifest `sha: null` new-file push path
- #15 / #16 — tunnel client + pairing (the additive features this gate protects)
