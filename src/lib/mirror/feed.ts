import type { MirrorFrame } from './state';

export type MirrorFeedUnsubscribe = () => void;

/**
 * The ONE swap point between the mirror consumer tree and the wire.
 *
 * Today the desktop `store_state` projection frames (epic base-studio-code#2496
 * contract) are not wired into the mobile tunnel client yet, so this feed is
 * inert: it never publishes and returns a no-op unsubscriber. Every page
 * therefore renders its awaiting-sync state, which is the intended scaffold
 * behavior.
 *
 * When the contract lands: adapt the tunnel client's `store_state` callback to
 * `MirrorFrame` and publish it here. Nothing else changes — `MirrorProvider`,
 * `useMirrorDomain`, and every page keep their exact shape.
 */
export function subscribeMirrorFeed(
  _publish: (frame: MirrorFrame) => void,
): MirrorFeedUnsubscribe {
  return () => {};
}
