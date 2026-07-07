import { router } from 'expo-router';

// Navigation helpers into the sessions surfaces (#219). Kept in one place so
// every entry point — the roster, the Glance header, the Planner chat
// affordance, FCM notification taps, the user_request toast, and (later) a
// tapped live agent node on the Glance graph — pushes the SAME route.

/**
 * Open the reusable chat surface for one desktop session. `paneId` is a live
 * desktop pane id from `pane_list` (e.g. `t0p0`, `<project>:<stream>`,
 * `planning_<key>`); it travels as a query param (never a path segment) since
 * the desktop's session-identity ids contain `:`.
 */
export function openSessionChat(paneId: string) {
  router.push({ pathname: '/(sessions)/chat', params: { paneId } });
}

/** Open the sessions roster (every desktop session, grouped by kind). */
export function openSessionsRoster() {
  // The route is `/roster`, not the group index — a `(sessions)/index` would
  // serialize to `/` and collide with the (tabs) group's index route.
  router.push('/(sessions)/roster');
}
