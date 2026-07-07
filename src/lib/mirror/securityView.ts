/**
 * View-model selectors for the `security` mirror domain (#223).
 *
 * NOTE: the desktop projector does NOT publish this domain yet (no
 * `buildSecurityPayload` exists in base-studio-code as of #2498) — this
 * module defines the MOBILE-SIDE expectation so the page is feed-ready:
 *
 *   { audit: [...], profiles: [...], assignments: [...] }
 *
 * Field names are read with generous aliases (e.g. an audit row's action may
 * arrive as `action` | `tool` | `name`) so the eventual desktop shape has
 * room to differ without breaking the page. Everything degrades to empty
 * sections — the page's "not yet published" state covers the absent domain.
 */

import {
  asArray, asRecord, readNumOrNull, readString,
} from './payload';

export type AuditEntryVM = {
  id: string;
  at: number | null;
  action: string;
  detail: string | null;
  actor: string | null;
};

export type SecurityProfileVM = {
  id: string;
  name: string;
  role: string | null;
  /** Compact capability summary ("4 commands · 2 write paths"); null if unknown. */
  summary: string | null;
};

export type SecurityAssignmentVM = {
  id: string;
  /** Who is bound (stream / session / pane). */
  subject: string;
  /** The profile it is bound to. */
  profile: string;
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

function firstString(r: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = readString(r[k], '').trim();
    if (v) return v;
  }
  return '';
}

function toAuditEntry(raw: unknown, index: number): AuditEntryVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  return {
    id: readString(r.id, '') || `audit-${index}`,
    at: readNumOrNull(r.at),
    action: firstString(r, ['action', 'tool', 'name']) || '—',
    detail: firstString(r, ['detail', 'note', 'summary']) || null,
    actor: firstString(r, ['actor', 'session', 'pane', 'role']) || null,
  };
}

function capabilitySummary(r: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const count = (key: string, label: string) => {
    const list = r[key];
    if (Array.isArray(list) && list.length > 0) {
      parts.push(`${list.length} ${label}${list.length === 1 ? '' : 's'}`);
    }
  };
  count('commands', 'command');
  count('tools', 'tool');
  count('writePaths', 'write path');
  return parts.length > 0 ? parts.join(' · ') : null;
}

function toProfile(raw: unknown, index: number): SecurityProfileVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = readString(r.id, '') || `profile-${index}`;
  return {
    id,
    name: readString(r.name, '').trim() || id,
    role: firstString(r, ['role']) || null,
    summary: firstString(r, ['summary']) || capabilitySummary(r),
  };
}

function toAssignment(raw: unknown, index: number): SecurityAssignmentVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  const subject = firstString(r, ['subject', 'stream', 'session', 'pane']);
  const profile = firstString(r, ['profile', 'profileName', 'profileId']);
  if (!subject && !profile) return null;
  return {
    id: readString(r.id, '') || `assignment-${index}`,
    subject: subject || '—',
    profile: profile || '—',
  };
}

/** The whole `security` domain payload → display model. Never throws. */
export function selectSecurityView(data: unknown): SecurityView {
  const root = asRecord(data);
  if (!root) return EMPTY_SECURITY_VIEW;
  const audit = asArray(root.audit)
    .map(toAuditEntry)
    .filter((e): e is AuditEntryVM => e !== null)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const profiles = asArray(root.profiles)
    .map(toProfile)
    .filter((p): p is SecurityProfileVM => p !== null);
  const assignments = asArray(root.assignments)
    .map(toAssignment)
    .filter((a): a is SecurityAssignmentVM => a !== null);
  return {
    audit,
    profiles,
    assignments,
    empty: audit.length === 0 && profiles.length === 0 && assignments.length === 0,
  };
}
