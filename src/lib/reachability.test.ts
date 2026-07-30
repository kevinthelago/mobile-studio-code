// Reachability guard (#262) — fails when a source file is reachable from no `app/` route.
//
// WHY THIS EXISTS. Orphaned code is not merely dead weight, it is a trap for issue authors:
// the file compiles, its tests pass, and nothing renders it. It has already cost two issues.
// `54c13fb` (2026-07-25) rewrote `app/(tabs)/plan.tsx` and removed the segment strip that was
// the only mount point for the Blueprints and Live-plan mirrors, leaving the components on
// disk. #236 was then written entirely against `BlueprintsSection`, and the `plan` half of
// #245 against `LivePlanBoard` — the latter was implemented and had to be stripped back out
// before merge.
//
// Deleting the files was a one-off; this test is the part that stops it recurring. It runs in
// the normal suite, so it costs no CI wiring and fails locally before you push.
//
// THE RULE, mirroring `PENDING_DOMAINS` in the payload harness: `ORPHANS` may only SHRINK.
//   • A file that is unreachable and not listed        → fail (you just orphaned something).
//   • A listed file that has become reachable          → fail (delete the stale entry).
//   • A listed file with no reason                     → fail (debt must be explained).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXTS = ['.ts', '.tsx', '.json'];

/**
 * Unreachable BY DESIGN — imported only by tests, never by a route. Not debt.
 * Contract fixtures and the shared decode helpers live here.
 */
const TEST_ONLY = new Set([
  'src/lib/tunnel/fixtureDecode.ts',
  'src/lib/tunnel/noiseVectors.json',
  'src/lib/tunnel/storePayloads.fixtures.json',
  'src/lib/tunnel/tunnelProtocol.fixtures.json',
  'src/lib/planner/sync/plannerCore.fixtures.json',
  'src/lib/graph/vitestShim.ts',
]);

/**
 * Known orphans, each with the decision that must resolve it. THIS LIST MAY ONLY SHRINK.
 *
 * Nothing here is "delete me eventually" — every entry is blocked on a decision that is not
 * this file's to make, which is exactly why they were left rather than quietly removed.
 */
const ORPHANS: Record<string, string> = {
  // ── Superseded by the #250 planner reshape. Deleting the selectors means deciding whether
  //    `plan` and `blueprints` stay in STORE_DOMAINS at all — resolve #236 and the #245
  //    re-scope first, then remove these together with their domains.
  'src/components/planner/LivePlanBoard.tsx': '#245 — the `plan` domain\'s only consumer; superseded by the plan_state path',
  'src/lib/pages/plannerBoard.ts': '#245 — selector for the above',
  'src/components/planner/BlueprintsSection.tsx': '#236 — the `blueprints` domain\'s only consumer',
  'src/lib/pages/blueprintsPage.ts': '#236 — selector for the above; still re-exports shared team parsing',
  'src/components/planner/ChatTab.tsx': '#262 — planner UI superseded by PlanConversation',
  'src/components/planner/PlanTab.tsx': '#262 — planner UI superseded by BlueprintStageBar',
  'src/components/planner/PreviewTab.tsx': '#262 — planner UI with no route',
  'src/components/planner/PlannerChrome.tsx': '#262 — planner chrome superseded by the embedded planner',
  'src/components/planner/atoms.tsx': '#262 — shared by the orphaned planner tabs only',

  // ── Repo-client surface. `repo.tsx`, `agent.ts`, `github.ts`, `fs.ts`, `tasks.ts` and
  //    `session.tsx` are all still LIVE, but the Files/Edit/Git tabs that rendered these are
  //    gone. Needs a product call on whether that surface returns before anything is deleted.
  'src/components/github/BranchGraph.tsx': '#262 — repo-client UI; awaiting a call on the IDE surface',
  'src/components/github/LanguageBar.tsx': '#262 — repo-client UI; awaiting a call on the IDE surface',
  'src/components/github/charts.tsx': '#262 — repo-client UI; awaiting a call on the IDE surface',
  'src/lib/diff.ts': '#262 — only mattered with a Git tab',
  'src/lib/syntax.ts': '#262 — only mattered with an Edit tab',
  'src/lib/githubCache.ts': '#262 — repo-client support; awaiting a call on the IDE surface',
  'src/lib/githubPulse.ts': '#262 — repo-client support; awaiting a call on the IDE surface',
  'src/lib/planner/seed.ts': '#262 — planner seed data with no consumer',

  // ── Task-system UI. `lib/tasks.ts` and `session.tsx` ARE live (SessionProvider is mounted in
  //    app/_layout.tsx), so the state layer survives while its UI does not. Same product call.
  'src/components/ui/TaskSheet.tsx': '#262 — task UI; lib/tasks.ts is still live',
  'src/components/ui/IssueLinkSheet.tsx': '#262 — task UI; lib/tasks.ts is still live',
  'src/components/ui/TopPill.tsx': '#262 — repo status pill from the old tab shell',

  // ── Deliberately ahead of its consumer, NOT debt: built by #235 for #233's Teams segment,
  //    which will render `org.orgs`. Guarded by the payload harness (`org` is in DECODERS) and
  //    by its own unit tests, so it cannot rot unnoticed.
  'src/lib/pages/orgPage.ts': '#233 — built ahead for the Studio Teams segment; harness-guarded',
};

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // package import — not our graph
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, 'index' + e))];
  for (const p of candidates) {
    // path.join, never `base + '/index.ts'`: a raw '/' produces a mixed-separator key on
    // Windows that matches nothing, which silently reports every barrel as unreachable.
    if (existsSync(p) && statSync(p).isFile()) return path.normalize(p);
  }
  return null;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (EXTS.includes(path.extname(entry.name))) out.push(p);
  }
  return out;
}

const IMPORT_RE = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;

function reachableFromRoutes(): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      return;
    }
    for (const m of src.matchAll(IMPORT_RE)) {
      const target = resolveImport(file, m[1]);
      if (target) visit(target);
    }
  };
  walk(path.join(ROOT, 'app')).forEach(visit);
  for (const entry of ['App.tsx', 'index.ts', 'index.js']) {
    const p = path.join(ROOT, entry);
    if (existsSync(p)) visit(p);
  }
  return seen;
}

const rel = (abs: string): string => path.relative(ROOT, abs).split(path.sep).join('/');

const reachable = reachableFromRoutes();
const unreachable = walk(path.join(ROOT, 'src'))
  .filter((f) => !reachable.has(f) && !/\.test\.(ts|tsx)$/.test(f))
  .map(rel)
  .sort();

test('no source file is orphaned without being declared', () => {
  const undeclared = unreachable.filter((f) => !TEST_ONLY.has(f) && !(f in ORPHANS));
  assert.deepEqual(
    undeclared,
    [],
    `these files are reachable from no app/ route — wire them up, delete them, or add them to ` +
      `ORPHANS with the decision that must resolve each:\n  ${undeclared.join('\n  ')}`,
  );
});

test('the ORPHANS list may only shrink', () => {
  // A listed file that has become reachable is good news — the entry is now a lie, so drop it.
  const stale = Object.keys(ORPHANS).filter((f) => !unreachable.includes(f));
  assert.deepEqual(
    stale,
    [],
    `these are no longer orphaned — remove them from ORPHANS:\n  ${stale.join('\n  ')}`,
  );
});

test('every declared orphan cites the decision that resolves it', () => {
  for (const [file, reason] of Object.entries(ORPHANS)) {
    assert.match(reason, /#\d+/, `ORPHANS["${file}"] must cite its tracking issue`);
  }
});

test('every TEST_ONLY entry is a real file that tests actually reach', () => {
  // Keeps the "by design" escape hatch from outliving its files.
  for (const f of TEST_ONLY) {
    assert.ok(existsSync(path.join(ROOT, f)), `TEST_ONLY lists "${f}", which does not exist`);
  }
});

test('the walker found the app and resolved barrels (guards against a silent empty graph)', () => {
  // If resolveImport regressed, `reachable` collapses and every file looks orphaned. Two
  // canaries: a route-mounted component, and a directory barrel (the case that broke first).
  assert.ok(reachable.size > 100, `only ${reachable.size} files reachable — the walker is broken`);
  assert.ok(
    reachable.has(path.join(ROOT, 'src', 'lib', 'graph', 'index.ts')),
    'src/lib/graph/index.ts should be reachable via a barrel import — separator bug?',
  );
});
