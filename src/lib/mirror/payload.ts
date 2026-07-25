/**
 * Tolerant readers + shared formatting for mirror-domain view models (#223).
 *
 * Mirror payloads arrive as versionless JSON pushed by the desktop projector
 * (base-studio-code `storeProjections.ts`). Selectors must never throw on a
 * missing, extra, or mistyped field — a partial frame renders partially, and
 * wire garbage renders as an empty view. These helpers are the one place that
 * defensive posture lives.
 */

/** The value as a plain object, or null for anything else (incl. arrays). */
export function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** The value as an array, else `[]`. */
export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** The value if it is a non-empty-safe string, else the fallback. */
export function readString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

export function readBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/**
 * A `string[]` wire field as a clean list — non-strings and blanks dropped, so a
 * count of the result is always a count of things worth rendering.
 */
export function readStringList(v: unknown): string[] {
  return asArray(v)
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * A `Record<string, string>` wire field as a clean map — non-string values
 * dropped. Several projections key by id this way (`security.tools`,
 * `security.paneRoles`, `security.paneProfiles`), and a record silently failing
 * an `Array.isArray` guard is exactly the bug #237 was filed for.
 */
export function readStringMap(v: unknown): Record<string, string> {
  const r = asRecord(v);
  if (!r) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(r)) {
    if (typeof val === 'string') out[k] = val;
  }
  return out;
}

/** Finite number or null — epoch fields tolerate absence/garbage as null. */
export function readNumOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * ISO-8601 string → epoch ms, or null for an absent/malformed value.
 *
 * Not every desktop timestamp crosses the wire as a number: audit records carry
 * `ts` as an ISO-8601 STRING (base-studio-code `security/lib/auditLog.ts:23`).
 * Everything downstream — sorting, {@link relativeTime}, {@link clockTime} —
 * works in epoch ms, so this is the single conversion point.
 */
export function readIsoMs(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Scope hint for a desktop `projects` list, where `[]` (or absence) means the
 * item is global.
 */
export function scopeLabel(projects: unknown): string {
  const list = asArray(projects);
  if (list.length === 0) return 'Global';
  return list.length === 1 ? '1 project' : `${list.length} projects`;
}

/**
 * Compact relative time ("2h ago" / "in 15m" / "just now") for epoch-ms
 * mirror timestamps. Pure — pass `now` in tests. Null/garbage renders "—".
 */
export function relativeTime(at: number | null | undefined, now: number = Date.now()): string {
  if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) return '—';
  const delta = now - at;
  const future = delta < 0;
  const abs = Math.abs(delta);
  if (abs < 45_000) return future ? 'in moments' : 'just now';
  const minutes = Math.round(abs / 60_000);
  const unit = minutes < 60
    ? `${minutes}m`
    : minutes < 60 * 48
      ? `${Math.round(minutes / 60)}h`
      : `${Math.round(minutes / (60 * 24))}d`;
  return future ? `in ${unit}` : `${unit} ago`;
}

/**
 * Local 24h clock time (`HH:MM:SS`) for an epoch-ms timestamp — parity with the
 * desktop's `fmtAuditTime` (base-studio-code `security/lib/auditRows.ts:91`),
 * which is the absolute half of every audit row's timestamp. Null/garbage
 * renders "—".
 *
 * Formatted by hand rather than via `toLocaleTimeString` — Hermes' Intl support
 * is not guaranteed, and the `hour12: false` midnight-as-"24:00:00" quirk is
 * real on some engines.
 */
export function clockTime(at: number | null | undefined): string {
  if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) return '—';
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
