/**
 * View-model selectors for the `security` mirror domain (#223, resynced #237).
 *
 * The desktop HAS published this domain since base-studio-code#2530 — the wire
 * shape is literal `buildSecurityPayload` output
 * (`src/features/tunnel/lib/storeProjections.ts:396`):
 *
 *   {
 *     profiles: SecurityProfileCard[],       // the permission CONFIG
 *     paneRoles: Record<paneId, role>,       // transient; empty before a launch
 *     paneProfiles: Record<paneId, profileId>,
 *     audit: AuditRecord[],                  // newest first, capped at 200
 *   }
 *
 * This module reads that shape literally. The version it replaces was written
 * speculatively against an invented `{audit, profiles, assignments}` shape with
 * "generous aliases" so the eventual desktop shape would have room to differ —
 * in practice not one field name matched, the page rendered 200 rows of
 * em-dashes against a live feed, and the aliases are what hid it. Guessing is
 * the anti-pattern here: read the wire, and let a missing field be visibly
 * missing.
 *
 * Assignments are DERIVED, not received: the desktop sends two paneId-keyed
 * records and mobile joins them.
 */

import {
  asArray, asRecord, readBool, readIsoMs, readString, readStringList, readStringMap,
} from './payload';

/** Display class for an audit row — mirrors base-studio-code `auditLog.ts:59`. */
export type AuditKind = 'cmd' | 'net' | 'tool';

export type AuditEntryVM = {
  id: string;
  /** `ts` parsed to epoch ms; null when the wire value is absent/unparseable. */
  at: number | null;
  /** The raw wire `ts`, retained so an unparseable value can still be shown. */
  ts: string;
  /** Originating pane id, e.g. "t0p1". */
  pane: string;
  /** "Bash" | "Edit" | "WebFetch" | … */
  toolName: string;
  /** Command / path / url — already redacted desktop-side. May be empty. */
  target: string;
  kind: AuditKind;
};

export type SecurityProfileVM = {
  id: string;
  name: string;
  /** Base policy for anything not explicitly listed: deny | ask | allow. */
  mode: string | null;
  /** "application" | "user" | "generated". */
  category: string | null;
  desc: string | null;
  /** Profile-scoped shell allowlist (unions with project/repo at run time). */
  commands: string[];
  /** toolKey → tier. A RECORD on the wire, never an array. */
  tools: Record<string, string>;
  /** Filesystem scope. An empty `allow` means read-only. */
  paths: { allow: string[]; deny: string[] };
  /** Allowed network hosts — NOT credentials. `*` means all hosts. */
  net: string[];
  builtin: boolean;
  /** Compact capability summary ("4 commands · 8 tools"); null when bare. */
  summary: string | null;
};

export type SecurityAssignmentVM = {
  /** The paneId — unique per row, since the join is keyed on it. */
  id: string;
  pane: string;
  /** The SessionRole the pane launched under; null if it has no role. */
  role: string | null;
  /** The assigned profile id; null if the pane has no profile. */
  profileId: string | null;
  /** The assigned profile's name, falling back to the raw id. */
  profile: string | null;
};

export type SecurityView = {
  audit: AuditEntryVM[];
  profiles: SecurityProfileVM[];
  assignments: SecurityAssignmentVM[];
  /** True when every section is empty (absent domain or empty payload). */
  empty: boolean;
};

export const EMPTY_SECURITY_VIEW: SecurityView = {
  audit: [], profiles: [], assignments: [], empty: true,
};

// ── audit ────────────────────────────────────────────────────────────────────

const NET_TOOLS = new Set(['WebFetch', 'WebSearch']);

/**
 * The display kind for a tool name, using the same sets as base-studio-code
 * `auditLog.ts:54-61`. Derived here only because the desktop does not send
 * `kind` in the payload — if it ever does, prefer the wire value.
 *
 * Note this is display classification only. The allow/ask/block DECISION is
 * deliberately not re-derived on mobile: it depends on desktop-only policy
 * resolution, and a second implementation would be a second source of truth
 * for a security verdict.
 */
export function auditKind(toolName: string): AuditKind {
  if (toolName === 'Bash') return 'cmd';
  return NET_TOOLS.has(toolName) ? 'net' : 'tool';
}

function toAuditEntry(raw: unknown, index: number): AuditEntryVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  const ts = readString(r.ts, '').trim();
  const pane = readString(r.pane, '').trim();
  const toolName = readString(r.toolName, '').trim();
  // The desktop's own parser requires all three (`auditLog.ts:47`), so a record
  // missing any of them never came from a real log line — and dropping it here
  // is what guarantees no row can render as a bare em-dash.
  if (!ts || !pane || !toolName) return null;
  return {
    // AuditRecord has no id — the wire index is the only stable key, and the
    // list is replaced wholesale on each 15s poll.
    id: `audit-${index}`,
    at: readIsoMs(r.ts),
    ts,
    pane,
    toolName,
    target: readString(r.target, '').trim(),
    kind: auditKind(toolName),
  };
}

/**
 * Newest first. Rows whose `ts` did not parse cannot be ordered, so they sink
 * below every dated row and hold their wire order relative to each other —
 * `Array.prototype.sort` is stable (ES2019), and the desktop already sends the
 * list newest-first, so "wire order" is the best available fallback.
 */
function byNewestFirst(a: AuditEntryVM, b: AuditEntryVM): number {
  if (a.at === null) return b.at === null ? 0 : 1;
  if (b.at === null) return -1;
  return b.at - a.at;
}

// ── profiles ─────────────────────────────────────────────────────────────────

function plural(n: number, label: string): string {
  return `${n} ${label}${n === 1 ? '' : 's'}`;
}

/**
 * The one-line capability summary. Counts every axis of the permission model,
 * including the ones the pre-#237 version could not see: `tools` is a record
 * (an `Array.isArray` guard silently counted it as zero) and the write scope
 * lives under `paths`, not `writePaths`.
 */
function capabilitySummary(p: {
  commands: string[];
  tools: Record<string, string>;
  paths: { allow: string[]; deny: string[] };
  net: string[];
}): string | null {
  const parts: string[] = [];
  const paths = p.paths.allow.length + p.paths.deny.length;
  if (p.commands.length > 0) parts.push(plural(p.commands.length, 'command'));
  const tools = Object.keys(p.tools).length;
  if (tools > 0) parts.push(plural(tools, 'tool'));
  if (paths > 0) parts.push(plural(paths, 'path'));
  if (p.net.length > 0) parts.push(plural(p.net.length, 'host'));
  return parts.length > 0 ? parts.join(' · ') : null;
}

function toProfile(raw: unknown, index: number): SecurityProfileVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = readString(r.id, '').trim() || `profile-${index}`;
  const pathsRaw = asRecord(r.paths);
  const caps = {
    commands: readStringList(r.commands),
    tools: readStringMap(r.tools),
    paths: {
      allow: readStringList(pathsRaw?.allow),
      deny: readStringList(pathsRaw?.deny),
    },
    net: readStringList(r.net),
  };
  return {
    id,
    name: readString(r.name, '').trim() || id,
    mode: readString(r.mode, '').trim() || null,
    category: readString(r.category, '').trim() || null,
    desc: readString(r.desc, '').trim() || null,
    ...caps,
    builtin: readBool(r.builtin, false),
    summary: capabilitySummary(caps),
  };
}

// ── assignments (derived) ────────────────────────────────────────────────────

/**
 * Join the two paneId-keyed records into one row per pane. The union of keys,
 * not the intersection: a pane can hold a role with no profile assigned (and
 * vice versa), and dropping those rows would under-report what is running.
 */
function toAssignments(
  paneRoles: Record<string, string>,
  paneProfiles: Record<string, string>,
  profiles: SecurityProfileVM[],
): SecurityAssignmentVM[] {
  const nameById = new Map(profiles.map((p) => [p.id, p.name]));
  const panes = [...new Set([...Object.keys(paneRoles), ...Object.keys(paneProfiles)])];
  panes.sort();
  return panes.map((pane) => {
    const profileId = paneProfiles[pane]?.trim() || null;
    return {
      id: pane,
      pane,
      role: paneRoles[pane]?.trim() || null,
      profileId,
      // An id with no matching profile still renders — as the raw id, which is
      // the honest thing to show when the profile list and the assignment
      // disagree.
      profile: profileId ? nameById.get(profileId) ?? profileId : null,
    };
  });
}

// ── root ─────────────────────────────────────────────────────────────────────

/** The whole `security` domain payload → display model. Never throws. */
export function selectSecurityView(data: unknown): SecurityView {
  const root = asRecord(data);
  if (!root) return EMPTY_SECURITY_VIEW;

  const audit = asArray(root.audit)
    .map(toAuditEntry)
    .filter((e): e is AuditEntryVM => e !== null)
    .sort(byNewestFirst);
  const profiles = asArray(root.profiles)
    .map(toProfile)
    .filter((p): p is SecurityProfileVM => p !== null);
  const assignments = toAssignments(
    readStringMap(root.paneRoles),
    readStringMap(root.paneProfiles),
    profiles,
  );

  return {
    audit,
    profiles,
    assignments,
    // `assignments` is the key union of paneRoles and paneProfiles, so it is
    // empty exactly when both of those records are.
    empty: audit.length === 0 && profiles.length === 0 && assignments.length === 0,
  };
}
