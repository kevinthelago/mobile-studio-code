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

/** Finite number or null — epoch fields tolerate absence/garbage as null. */
export function readNumOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
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
