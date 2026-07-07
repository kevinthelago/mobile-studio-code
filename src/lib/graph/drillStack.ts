// Drill stack (#220) — the pure navigation model for drilling INTO a graph node: glance L0 project
// network → L1 fleet subgraph; org parent view → a pool's member subgraph. Push on drill-in, pop on
// back (hardware back / swipe-back pops the drill BEFORE leaving the screen — wired by the mounting
// screen, see useDrillBack). Immutable: every operation returns a fresh stack.
//
// Desktop sync: base-studio-code keeps ONE drill id per domain (`glanceDrill: string | null` in the
// core store slice; org drilling is per-pool). `topDrillId` / `stackFromDrillId` are the mapping —
// the mirror issue will push the desktop's value in and publish ours out through them.

export type DrillDomain = 'glance' | 'org';

export interface DrillFrame {
  domain: DrillDomain;
  /** The drilled node id (a glance project id / an org `pool:<personaId>` node id). */
  id: string;
  /** Display label for breadcrumbs. */
  label?: string;
}

export type DrillStack = readonly DrillFrame[];

export const EMPTY_DRILL: DrillStack = [];

/** Push a drill frame. A frame identical to the current top (same domain + id) is a no-op, so a
 *  double-fired tap can't stack duplicates. */
export function drillPush(stack: DrillStack, frame: DrillFrame): DrillStack {
  const top = drillTop(stack);
  if (top && top.domain === frame.domain && top.id === frame.id) return stack;
  return [...stack, frame];
}

/** Pop the top frame (no-op on an empty stack). */
export function drillPop(stack: DrillStack): DrillStack {
  return stack.length ? stack.slice(0, -1) : stack;
}

export function drillTop(stack: DrillStack): DrillFrame | null {
  return stack.length ? stack[stack.length - 1] : null;
}

export function canDrillPop(stack: DrillStack): boolean {
  return stack.length > 0;
}

export function drillDepth(stack: DrillStack): number {
  return stack.length;
}

/** The desktop-shaped drill value for a domain: the topmost frame of that domain, else null
 *  (matches the desktop's single-id `glanceDrill` model). */
export function topDrillId(stack: DrillStack, domain: DrillDomain): string | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].domain === domain) return stack[i].id;
  }
  return null;
}

/** Rebuild a stack from a desktop-shaped drill value (null ⇒ at the root). One frame — the desktop
 *  model is single-level today; deeper mobile-local drills layer on top of a synced base. */
export function stackFromDrillId(domain: DrillDomain, id: string | null, label?: string): DrillStack {
  return id === null ? EMPTY_DRILL : [{ domain, id, label }];
}
