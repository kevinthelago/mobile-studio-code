import React, {
  createContext, useContext, useEffect, useReducer, type ReactNode,
} from 'react';
import {
  EMPTY_MIRROR, applyMirrorFrame, type MirrorState,
} from './state';
import { mirrorFramesFrom } from './feed';
import { useTunnel } from '../TunnelContext';

/** What a page sees for one domain. `synced` is false until a frame lands. */
export type MirrorDomainView = {
  data: unknown;
  rev: number;
  synced: boolean;
};

const NOT_SYNCED: MirrorDomainView = { data: undefined, rev: -1, synced: false };

const MirrorContext = createContext<MirrorState>(EMPTY_MIRROR);

/**
 * Holds the domain → projection map for the whole app. The tunnel's
 * `store_state` map (contract v2, base-studio-code#2497) is the single wire
 * source: every time it changes, `mirrorFramesFrom` (feed.ts) re-derives the
 * per-domain frames and folds them in. The reducer is rev-deduped, so
 * re-folding the whole map on each change is idempotent — already-seen domains
 * return the same state reference and cause no re-render. This also covers the
 * connect-time replay (frames the desktop replays land in the map before this
 * provider mounts, and the first pass folds them all).
 */
export function MirrorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(applyMirrorFrame, EMPTY_MIRROR);
  const { storeState } = useTunnel();

  useEffect(() => {
    for (const frame of mirrorFramesFrom(storeState)) dispatch(frame);
  }, [storeState]);

  return <MirrorContext.Provider value={state}>{children}</MirrorContext.Provider>;
}

/**
 * Read one mirrored desktop domain. Returns a stable "not synced" view until
 * the desktop has pushed that domain's projection.
 */
export function useMirrorDomain(domain: string): MirrorDomainView {
  const state = useContext(MirrorContext);
  const entry = state[domain];
  if (!entry) return NOT_SYNCED;
  return { data: entry.json, rev: entry.rev, synced: true };
}
