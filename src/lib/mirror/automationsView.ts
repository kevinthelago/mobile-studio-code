/**
 * View-model selectors for the `automations` mirror domain (#223).
 *
 * Wire contract (desktop `buildAutomationsPayload`, base-studio-code#2498):
 *   { automations: AutomationCard[], hooks: HookCard[] }
 *   AutomationCard = { id, name, armed, when, lastRunAt, nextRunAt, runs }
 *   HookCard       = { id, name, enabled, event, matcher?, projects }
 *
 * The projection does not (yet) carry the automation's target pane or a
 * built-in marker on hooks; both are read tolerantly so they light up the
 * moment the desktop starts publishing them, and render as absent until then.
 */

import {
  asArray, asRecord, readBool, readNumOrNull, readString, scopeLabel,
} from './payload';

export type RunStatus = 'ok' | 'skipped' | 'fail' | 'unknown';

export type AutomationRunVM = {
  at: number | null;
  status: RunStatus;
  note: string;
};

export type AutomationVM = {
  id: string;
  name: string;
  /** Read-only display state — the phone never arms/disarms (chat does). */
  armed: boolean;
  /** Human cadence label derived from the `when` union ("every day at 09:00"). */
  whenLabel: string;
  /** "Tab · pane N" when the payload carries the target; null until it does. */
  targetLabel: string | null;
  lastRunAt: number | null;
  nextRunAt: number | null;
  /** Newest first, capped to the projection's 10. */
  runs: AutomationRunVM[];
};

export type HookVM = {
  id: string;
  name: string;
  enabled: boolean;
  event: string;
  matcher: string | null;
  scopeLabel: string;
  /** Marked by the payload as part of the desktop's always-on system floor. */
  builtin: boolean;
};

export type AutomationsView = {
  automations: AutomationVM[];
  hooks: HookVM[];
  /** Any hook is marked built-in → show the system-floor note row. */
  hasSystemFloor: boolean;
};

export const EMPTY_AUTOMATIONS_VIEW: AutomationsView = {
  automations: [], hooks: [], hasSystemFloor: false,
};

/** Runs shown per schedule card (mirrors the desktop projection cap). */
export const RUNS_SHOWN = 10;

/** Human label for the desktop's `AutomationWhen` union (simple | cron). */
export function formatWhen(when: unknown): string {
  const w = asRecord(when);
  if (!w) return '—';
  if (w.kind === 'cron') {
    const expr = readString(w.expr, '').trim();
    return expr ? `cron ${expr}` : 'cron';
  }
  if (w.kind === 'simple') {
    const every = readString(w.every, '').trim();
    if (!every) return '—';
    if (every === 'minute') return 'every minute';
    const at = readString(w.at, '').trim();
    return at ? `every ${every} at ${at}` : `every ${every}`;
  }
  return '—';
}

function toRun(raw: unknown): AutomationRunVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  const status: RunStatus =
    r.status === 'ok' || r.status === 'skipped' || r.status === 'fail' ? r.status : 'unknown';
  return { at: readNumOrNull(r.at), status, note: readString(r.note, '') };
}

function toAutomation(raw: unknown, index: number): AutomationVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = readString(r.id, '') || `automation-${index}`;

  // Target pane — not in today's projection; render when the desktop adds it.
  const targetTab = readString(r.targetTab, '').trim();
  const paneIdx = readNumOrNull(r.targetPaneIdx);
  const targetLabel = targetTab
    ? paneIdx !== null ? `${targetTab} · pane ${paneIdx + 1}` : targetTab
    : null;

  const runs = asArray(r.runs)
    .map(toRun)
    .filter((run): run is AutomationRunVM => run !== null)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    .slice(0, RUNS_SHOWN);

  return {
    id,
    name: readString(r.name, '').trim() || id,
    armed: readBool(r.armed, false),
    whenLabel: formatWhen(r.when),
    targetLabel,
    lastRunAt: readNumOrNull(r.lastRunAt),
    nextRunAt: readNumOrNull(r.nextRunAt),
    runs,
  };
}

function toHook(raw: unknown, index: number): HookVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = readString(r.id, '') || `hook-${index}`;
  return {
    id,
    name: readString(r.name, '').trim() || id,
    enabled: readBool(r.enabled, false),
    event: readString(r.event, '').trim() || '—',
    matcher: readString(r.matcher, '').trim() || null,
    scopeLabel: scopeLabel(r.projects),
    builtin: readBool(r.builtin, false),
  };
}

/** The whole `automations` domain payload → display model. Never throws. */
export function selectAutomationsView(data: unknown): AutomationsView {
  const root = asRecord(data);
  if (!root) return EMPTY_AUTOMATIONS_VIEW;
  const automations = asArray(root.automations)
    .map(toAutomation)
    .filter((a): a is AutomationVM => a !== null);
  const hooks = asArray(root.hooks)
    .map(toHook)
    .filter((h): h is HookVM => h !== null);
  return { automations, hooks, hasSystemFloor: hooks.some((h) => h.builtin) };
}
