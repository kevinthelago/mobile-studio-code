// Shared mock data for remote Claude sessions (tunneling feature).
// Used by the global Session Strip and the Run tab's grid + terminal states.

// Status language: running=green, awaiting_input=amber, error=red, idle=grey
const SESSION_STATUS = {
  running:        { color: '#34d399', label: 'running' },
  awaiting_input: { color: '#f5b94a', label: 'awaiting input' },
  error:          { color: '#f87171', label: 'error' },
  idle:           { color: '#8b93a7', label: 'idle' },
};

// One paired desktop ("base-studio-code") exposing several Claude console panes.
const SESSIONS = [
  {
    id: 's1', name: 'api-refactor', status: 'awaiting_input',
    task: 'Migrate auth to OAuth device flow',
    preview: 'Proceed with deleting legacy session table? (y/n)',
    cwd: '~/work/base-studio-code', ago: 'just now', needsInput: true,
  },
  {
    id: 's2', name: 'web-ui', status: 'running',
    task: 'Build settings page',
    preview: '● Editing src/screens/Settings.tsx …',
    cwd: '~/work/msc-app', ago: '2m', needsInput: false,
  },
  {
    id: 's3', name: 'db-migrate', status: 'running',
    task: 'Add indexes for search',
    preview: 'Running: alembic upgrade head',
    cwd: '~/work/base-studio-code', ago: '5m', needsInput: false,
  },
  {
    id: 's4', name: 'docs', status: 'idle',
    task: 'Idle — last task complete',
    preview: '✓ Wrote 4 files. Awaiting next instruction.',
    cwd: '~/work/handbook', ago: '1h', needsInput: false,
  },
  {
    id: 's5', name: 'ci-fix', status: 'error',
    task: 'Fix failing GH Action',
    preview: 'Error: process exited with code 1',
    cwd: '~/work/base-studio-code', ago: '20m', needsInput: false,
  },
];

// Ordered: awaiting-input first, then most-recent activity (already roughly ordered).
function orderSessions(list) {
  const rank = (s) => (s.needsInput ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b));
}

// ANSI-stripped live output for the focused terminal view.
const SESSION_OUTPUT = [
  { t: 'sys',  v: '$ claude --resume api-refactor' },
  { t: 'sys',  v: 'Resumed session · 14 turns · sonnet 4.6' },
  { t: 'dim',  v: '' },
  { t: 'tool', v: '⏺ read_file  src/auth/session.py' },
  { t: 'tool', v: '⏺ grep_file  "session_table"  → 6 hits' },
  { t: 'out',  v: 'Found legacy session storage in 3 modules.' },
  { t: 'out',  v: 'The OAuth device flow makes the session table' },
  { t: 'out',  v: 'redundant. I can drop it and migrate live rows.' },
  { t: 'dim',  v: '' },
  { t: 'ask',  v: 'Proceed with deleting legacy session table? (y/n)' },
];

Object.assign(window, { SESSION_STATUS, SESSIONS, orderSessions, SESSION_OUTPUT });
