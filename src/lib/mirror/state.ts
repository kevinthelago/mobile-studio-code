/**
 * Pure state for the read-only desktop mirror (#218, epic base-studio-code#2496).
 *
 * The desktop pushes generic `store_state` projection frames — one per domain
 * (glance, skills, design, automations, mcp, themes, …) with a monotonically
 * increasing revision. Mobile keeps the latest frame per domain and renders it
 * read-only; adding a page never means designing a new frame, just reading a
 * new domain.
 *
 * NOTE: `MirrorFrame` is a PLACEHOLDER shape. The real wire types land with
 * the contract work (src/lib/types.ts / src/lib/tunnel); when they do, only
 * `feed.ts` (the adapter) changes — this reducer and the consumer API stay.
 */

export type MirrorFrame = {
  /** Which desktop store projection this is (e.g. "skills", "themes"). */
  domain: string;
  /** Monotonic revision — stale/duplicate frames (rev <= current) are ignored. */
  rev: number;
  /** The projection payload, exactly as the desktop's own pages read it. */
  json: unknown;
};

export type MirrorEntry = { rev: number; json: unknown };

/** domain → latest accepted projection. */
export type MirrorState = Readonly<Record<string, MirrorEntry>>;

export const EMPTY_MIRROR: MirrorState = {};

/**
 * Fold one frame into the domain map.
 *
 * Contract:
 * - Malformed frames (missing/empty domain, non-finite rev) are dropped.
 * - A frame whose rev is <= the domain's current rev is dropped (replay /
 *   out-of-order broadcast protection).
 * - Dropped frames return the SAME state reference, so React consumers skip
 *   the re-render entirely.
 */
export function applyMirrorFrame(state: MirrorState, frame: MirrorFrame): MirrorState {
  if (!frame || typeof frame.domain !== 'string' || frame.domain.length === 0) return state;
  if (typeof frame.rev !== 'number' || !Number.isFinite(frame.rev)) return state;
  const current = state[frame.domain];
  if (current && frame.rev <= current.rev) return state;
  return { ...state, [frame.domain]: { rev: frame.rev, json: frame.json } };
}
