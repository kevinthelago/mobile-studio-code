import type { PaneDescriptor, PaneKind, PaneState, PaneStatus } from '../types';

// Pure session-roster model (#219): groups the tunnel's panes map into the
// SESSION roster — every addressable desktop session (console panes, fleet
// workers, planner, designer, triage), grouped by kind. No React Native
// imports so it can be unit-tested under node/tsx.

/** One roster row, projected from a PaneState for display. */
export type RosterEntry = {
  paneId: string;
  /** Display name (falls back to the pane id). */
  name: string;
  kind: PaneKind;
  /** Live status — the structured session_state wins over the descriptor. */
  status: PaneStatus;
  /** Shortened cwd for the row's second line ('' when the desktop sent none). */
  cwdHint: string;
  /** The session is paused on a user_request. */
  awaitingInput: boolean;
  lastActivityAt: number | null;
};

/** One kind-group of the roster, in display order. Empty groups are omitted. */
export type RosterSection = {
  kind: PaneKind;
  title: string;
  entries: RosterEntry[];
};

/** Display order of the kind groups (the #219 roster spec order). */
export const KIND_ORDER: readonly PaneKind[] = [
  'console', 'worker', 'planner', 'designer', 'triage',
];

export const KIND_LABEL: Record<PaneKind, string> = {
  console: 'Consoles',
  worker: 'Fleet workers',
  planner: 'Planner',
  designer: 'Designer',
  triage: 'Triage',
};

/**
 * A pane's kind. The descriptor's wire `kind` (contract v2) wins; a pre-v2
 * desktop omits it, so fall back to inferring from the desktop's
 * session-identity id shapes (`planning_<key>`, `design-studio:…`) and treat
 * everything else as a console — matching the wire contract's documented
 * default.
 */
export function paneKind(descriptor: PaneDescriptor): PaneKind {
  if (descriptor.kind) return descriptor.kind;
  if (descriptor.id.startsWith('planning_')) return 'planner';
  if (descriptor.id.startsWith('design-studio:')) return 'designer';
  return 'console';
}

/**
 * Shorten an absolute cwd to its last two path segments (both separator
 * styles), e.g. `C:\Users\k\Projects\app` → `Projects/app`.
 */
export function shortCwd(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.slice(-2).join('/');
}

/** Project one pane into its roster row. */
export function toRosterEntry(pane: PaneState): RosterEntry {
  const d = pane.descriptor;
  return {
    paneId: d.id,
    name: d.name || d.id,
    kind: paneKind(d),
    status: pane.sessionState?.status ?? d.status,
    cwdHint: shortCwd(d.cwd),
    awaitingInput: pane.hasUserRequest,
    lastActivityAt: pane.lastActivityAt,
  };
}

/**
 * Sort within a group: sessions paused on a user_request float first (most
 * recent request first), then by last activity (newest first), then by name
 * for a stable order — the same precedence the tunnel's orderedPaneIds uses.
 */
function compareEntries(a: RosterEntry & { lastReq: number }, b: RosterEntry & { lastReq: number }): number {
  const aReq = a.awaitingInput ? a.lastReq : -1;
  const bReq = b.awaitingInput ? b.lastReq : -1;
  if (aReq !== bReq) return bReq - aReq;
  const act = (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
  if (act !== 0) return act;
  return a.name.localeCompare(b.name);
}

/**
 * Build the grouped session roster from the tunnel's panes map. Sections come
 * out in KIND_ORDER; kinds with no sessions are omitted.
 */
export function buildRoster(panes: Record<string, PaneState>): RosterSection[] {
  const rows = Object.values(panes).map((p) => ({
    ...toRosterEntry(p),
    lastReq: p.lastUserRequestAt ?? 0,
  }));
  return KIND_ORDER.flatMap((kind) => {
    const entries = rows
      .filter((r) => r.kind === kind)
      .sort(compareEntries)
      .map(({ lastReq: _lastReq, ...entry }) => entry);
    return entries.length > 0 ? [{ kind, title: KIND_LABEL[kind], entries }] : [];
  });
}

/**
 * The live planning session's pane, if the desktop is running one — the
 * `planning_<key>` session (kind `planner`). Most recently active wins when
 * several exist.
 */
export function findPlannerPane(panes: Record<string, PaneState>): PaneState | null {
  const planners = Object.values(panes)
    .filter((p) => paneKind(p.descriptor) === 'planner')
    .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));
  return planners[0] ?? null;
}
