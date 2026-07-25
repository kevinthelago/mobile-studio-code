// Bundled demo projections — the standalone/review data (mobile#250). The app is a desktop mirror, so
// without a paired base-studio-code it would be empty ("Awaiting sync") and read as non-functional to
// an App Store reviewer (guideline 2.1). MirrorContext serves these as a fallback while `demoActive`
// (no real connection has happened this session), so every tab is populated and exercisable on first
// launch. A real connection flips `demoActive` off, and live frames take over — a connected user then
// sees honest awaiting states for whatever the desktop doesn't project.
//
// Each payload matches its mobile selector's expected shape exactly (glancePage / skillsPage /
// designPage / automationsView / mcpView), so it renders through the real view-models, not a mock path.
// Representative, not exhaustive — a handful of items per domain.

// Demo data is served ONLY in a release build — for App Store reviewers and the offline first-run
// (#250). It is OFF in the dev client (`__DEV__`), so live-tunnel testing sees real desktop state and
// honest awaiting/empty states, not mock data. To preview the demo path in dev, hardcode `true`; to
// force it off everywhere, hardcode `false`.
export const DEMO_ENABLED = !__DEV__;

export const DEMO_PROJECTIONS: Record<string, unknown> = {
  // Glance — a small project network (selectGlance: health/activity/category unions, #238).
  glance: {
    projects: [
      { id: 'api', name: 'API', role: 'service', category: 'greenfield', health: 'healthy', activity: 'building', faults: 0 },
      { id: 'web', name: 'Web App', role: 'client', category: 'transform', health: 'warning', activity: 'review', reason: '2 checks failing', faults: 2 },
      { id: 'infra', name: 'Infra', role: 'infra', category: 'harden', health: 'healthy', activity: 'live', faults: 0 },
      { id: 'data', name: 'Analytics', role: 'data', category: 'data', health: 'idle', activity: 'idle', faults: 0 },
    ],
    links: [
      { id: 'web>api', from: 'web', to: 'api', kind: 'api' },
      { id: 'api>data', from: 'api', to: 'data', kind: 'data' },
      { id: 'web>infra', from: 'web', to: 'infra', kind: 'events' },
    ],
    drill: null,
    drillFleet: null,
    // A fleet per project (#2530) — the L1 agents shown when a node is drilled. Stream ids pair with
    // the demo panes in TunnelContext (`<project>:<stream>`) so tapping an agent opens its chat.
    fleets: {
      api: {
        streams: [
          { id: 'backend', name: 'backend', persona: 'p-backend', dependsOn: [] },
          { id: 'reviewer', name: 'reviewer', persona: 'p-reviewer', dependsOn: ['backend'] },
          { id: 'tester', name: 'tester', persona: 'p-tester', dependsOn: ['backend'] },
        ],
        director: { enabled: true, role: 'director' },
      },
      web: {
        streams: [
          { id: 'ui', name: 'ui', persona: 'p-ui', dependsOn: [] },
          { id: 'designer', name: 'designer', persona: 'p-designer', dependsOn: ['ui'] },
        ],
        director: { enabled: true, role: 'director' },
      },
      infra: {
        streams: [
          { id: 'ops', name: 'ops', persona: 'p-ops', dependsOn: [] },
        ],
        director: { enabled: false },
      },
    },
    personaRoles: {
      'p-backend': 'worker', 'p-reviewer': 'reviewer', 'p-tester': 'tester',
      'p-ui': 'worker', 'p-designer': 'designer', 'p-ops': 'infra',
    },
  },

  // Skills — library cards + a group + a pending lesson.
  skills: {
    skills: [
      { id: 'deep-research', name: 'Deep research', kind: 'workflow', source: 'first-party', desc: 'Fan-out web search, adversarial verification, cited synthesis.', projects: ['api', 'web'], enabled: true, pinned: true },
      { id: 'dataviz', name: 'Data viz', kind: 'scaffold', source: 'first-party', desc: 'Design-system-consistent charts that read in light and dark.', projects: ['web'], enabled: true, pinned: false },
      { id: 'security-review', name: 'Security review', kind: 'review', source: 'team', desc: 'Threat-model the pending diff before it merges.', projects: [], enabled: false, pinned: false, packaged: true },
    ],
    groups: [
      { id: 'research', name: 'Research', hue: '#5b9dff', skillIds: ['deep-research', 'dataviz'] },
    ],
    lessons: {
      project: 'web',
      pending: [
        { id: 'l1', mistake: 'Committed to main directly', cause: 'skipped the branch check', rule: 'Always branch from an issue before writing code', status: 'pending', seen: 3 },
      ],
    },
  },

  // Components — kits + component summaries (Studio · Components).
  components: {
    kits: [
      { id: 'mobile', name: 'mobile', tech: 'react-native', style: 'mobile', stack: 'React Native', dot: '#5b9dff', builtin: true },
      { id: 'react-ui', name: 'react-ui', tech: 'react', style: 'studio', stack: 'React · TypeScript', dot: '#4fd6a0', builtin: true },
    ],
    components: [
      { id: 'button', name: 'Button', kitId: 'react-ui', role: 'primitive', version: '2.3.0', used: 214, tags: ['control', 'form'], variants: ['primary', 'ghost', 'danger'], composes: [], builtin: true },
      { id: 'card', name: 'Card', kitId: 'react-ui', role: 'composite', version: '1.3.2', used: 121, tags: ['surface'], variants: ['default', 'loading'], composes: [], builtin: true },
      { id: 'stattile', name: 'StatTile', kitId: 'react-ui', role: 'primitive', version: '1.0.0', used: 47, tags: ['data'], variants: [], composes: ['Text'], builtin: true },
    ],
    usage: [
      { projectKey: 'web', kitId: 'react-ui', live: true },
      { projectKey: 'mobile', kitId: 'mobile', live: true, auto: true },
    ],
  },

  // Themes — the registry (Studio · Themes).
  themes: {
    active: 'dark',
    themes: [
      { id: 'dark', label: 'Dark', description: 'The base look on the dark surface — no overrides.', vars: {}, builtin: true },
      { id: 'nord', label: 'Nord', description: 'An arctic, north-bluish palette — cool Polar Night surfaces.', vars: { '--bg-canvas': '#2e3440', '--fg': '#eceff4', '--accent': '#88c0d0' }, builtin: true },
      { id: 'gruvbox', label: 'Gruvbox', description: 'Retro, warm earth tones.', vars: { '--bg-canvas': '#282828', '--fg': '#ebdbb2', '--accent': '#fabd2f' }, builtin: true },
    ],
  },

  // Automations — scheduled rules + a system hook.
  automations: {
    automations: [
      {
        id: 'nightly', name: 'Nightly test sweep', armed: true,
        when: { kind: 'simple', every: 'day', at: '02:00' },
        lastRunAt: 1735700000000, nextRunAt: 1735786400000,
        runs: [
          { at: 1735700000000, status: 'ok', note: 'all suites green' },
          { at: 1735613600000, status: 'fail', note: '2 flaky tests retried' },
        ],
      },
      {
        id: 'deploy', name: 'Deploy on green', armed: false,
        when: { kind: 'cron', expr: '0 */6 * * *' },
        lastRunAt: null, nextRunAt: null, runs: [],
      },
    ],
    hooks: [
      { id: 'bsc-deny', name: 'bsc-deny', enabled: true, event: 'PreToolUse', matcher: 'Bash', projects: [] },
    ],
  },

  // MCP — configured servers (Automations · MCP servers).
  mcp: {
    servers: [
      { id: 'research', name: 'Research', enabled: true, transport: 'stdio', projects: [], installed: true },
      { id: 'compliance', name: 'Compliance', enabled: true, transport: 'stdio', projects: [], installed: true },
      { id: 'github', name: 'GitHub', enabled: false, transport: 'http', projects: ['web'], url: 'https://api.github.com', installed: false },
    ],
  },
};

/** Domains that have bundled demo data (used to gate the fallback). */
export const DEMO_DOMAINS: readonly string[] = Object.keys(DEMO_PROJECTIONS);

// ── Demo sessions (agent chats) ──────────────────────────────────────────────────────────────────
// One pane per Glance fleet agent, keyed `<project>:<stream>` to match agentPaneId(), so drilling a
// project and tapping an agent opens its session chat (a read-only PTY mirror) with sample output.
// TunnelContext serves these while `demoActive`; a real pane_list overrides by id.
import type { PaneState } from '../types';

function demoPane(id: string, name: string, cwd: string, kind: PaneState['descriptor']['kind'], output: string): PaneState {
  return {
    descriptor: { id, cwd, name, status: 'running', kind },
    streamingState: 'dormant',
    outputBuffer: output,
    sessionState: null,
    ptySize: null,
    hasUserRequest: false,
    lastUserRequestAt: null,
    lastActivityAt: null,
  };
}

export const DEMO_PANES: Record<string, PaneState> = {
  'api:backend': demoPane('api:backend', 'backend', '/worktrees/api/backend', 'worker',
    '$ implement POST /auth (issue #142)\n> reading src/routes/auth.ts\n> writing handler + token refresh\n> added 14 unit tests\n✓ 14 passed\nawaiting review …'),
  'api:reviewer': demoPane('api:reviewer', 'reviewer', '/worktrees/api/reviewer', 'triage',
    '$ review backend#142\n> diff: src/routes/auth.ts (+96 −14)\n> flagged: missing rate-limit on /auth\n> requested one change\n'),
  'api:tester': demoPane('api:tester', 'tester', '/worktrees/api/tester', 'worker',
    '$ run integration suite\n✓ auth flow\n✓ token refresh\n✗ rate-limit (not implemented)\n2/3 green — blocking merge\n'),
  'web:ui': demoPane('web:ui', 'ui', '/worktrees/web/ui', 'worker',
    '$ build the settings screen\n> composing Card + SegmentedControl + Toggle\n> wired the provider picker\n✓ renders in light + dark\n'),
  'web:designer': demoPane('web:designer', 'designer', '/worktrees/web/designer', 'designer',
    '$ author the mobile kit\n> bsc ui set mobile.skillItem\n> bsc ui validate → ok\n> exported 7 components\n'),
  'infra:ops': demoPane('infra:ops', 'ops', '/worktrees/infra/ops', 'console',
    '$ terraform plan\n> 3 to add, 1 to change, 0 to destroy\n> apply gated on review\nidle — waiting on approval\n'),
};
