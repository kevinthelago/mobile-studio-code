/**
 * View-model selectors for the `automations` mirror domain (#223).
 *
 * Wire contract (desktop `buildAutomationsPayload`, base-studio-code#2498):
 *   { automations: AutomationCard[], hooks: HookCard[] }
 *   AutomationCard = { id, name, armed, when, lastRunAt, nextRunAt, runs }
 *   HookCard       = { id, name, enabled, event, matcher?, projects }
 *
 * Two fields this file used to read speculatively are GONE (#239). Neither was
 * "not yet published" — the desktop has ruled both out, with regression tests
 * pinning their absence:
 *
 *   - `targetTab` / `targetPaneIdx`: withheld on purpose. `storeProjections.test.ts`
 *     asserts the serialized payload does not contain "targetTab" — the card is
 *     schedule + outcome, the dispatch target stays desktop-side.
 *   - `builtin` on a hook: cannot exist. `Hook` is exclusively user-authored
 *     config, and `HookCard` field-exactness is asserted desktop-side.
 *
 * The desktop's always-on system floor (`SYSTEM_HOOKS` — bsc-deny, bsc-confine,
 * bsc-scope) is a module constant the projector never reads, so it crosses no
 * frame at all. Surfacing it needs a new `systemHooks` field on the payload;
 * until that lands there is nothing here to render, and pretending otherwise
 * showed the user an empty hook list implying nothing is enforced.
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
};

export type AutomationsView = {
  automations: AutomationVM[];
  hooks: HookVM[];
};

export const EMPTY_AUTOMATIONS_VIEW: AutomationsView = { automations: [], hooks: [] };

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
  return { automations, hooks };
}
