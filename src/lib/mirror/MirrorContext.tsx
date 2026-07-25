import React, {
  createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode,
} from 'react';
import {
  EMPTY_MIRROR, applyMirrorFrame, type MirrorState,
} from './state';
import { mirrorFramesFrom } from './feed';
import { DEMO_PROJECTIONS } from './demoData';
import { useTunnel } from '../TunnelContext';

/** What a page sees for one domain. `synced` is false until a frame lands. */
export type MirrorDomainView = {
  data: unknown;
  rev: number;
  synced: boolean;
};

const NOT_SYNCED: MirrorDomainView = { data: undefined, rev: -1, synced: false };

type MirrorContextValue = {
  entries: MirrorState;
  /** No real connection has happened this session → serve bundled demo data as a fallback (#250). */
  demoActive: boolean;
};

const MirrorContext = createContext<MirrorContextValue>({ entries: EMPTY_MIRROR, demoActive: false });

/**
 * Holds the domain → projection map for the whole app. The tunnel's
 * `store_state` map (contract v2, base-studio-code#2497) is the single wire
 * source: every time it changes, `mirrorFramesFrom` (feed.ts) re-derives the
 * per-domain frames and folds them in. The reducer is rev-deduped, so
 * re-folding the whole map on each change is idempotent — already-seen domains
 * return the same state reference and cause no re-render. This also covers the
 * connect-time replay (frames the desktop replays land in the map before this
 * provider mounts, and the first pass folds them all).
 *
 * Standalone demo (#250): until a real connection is established this session,
 * `demoActive` is true and `useMirrorDomain` falls back to bundled demo data for
 * domains with no live frame — so the app is populated and reviewable without a
 * desktop. The first successful connection latches `demoActive` off, so a
 * connected user sees honest awaiting states for whatever the desktop doesn't
 * project. A real frame always wins over demo (it's a live entry in the map).
 */
export function MirrorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(applyMirrorFrame, EMPTY_MIRROR);
  const { storeState, connectionState } = useTunnel();
  const [everConnected, setEverConnected] = useState(false);

  useEffect(() => {
    for (const frame of mirrorFramesFrom(storeState)) dispatch(frame);
  }, [storeState]);

  useEffect(() => {
    if (connectionState === 'connected') setEverConnected(true);
  }, [connectionState]);

  const value = useMemo<MirrorContextValue>(
    () => ({ entries: state, demoActive: !everConnected }),
    [state, everConnected],
  );

  return <MirrorContext.Provider value={value}>{children}</MirrorContext.Provider>;
}

/**
 * Read one mirrored desktop domain. Returns the live projection when the desktop
 * has pushed it; otherwise, while `demoActive`, the bundled demo projection (#250);
 * otherwise a stable "not synced" view.
 */
export function useMirrorDomain(domain: string): MirrorDomainView {
  const { entries, demoActive } = useContext(MirrorContext);
  const entry = entries[domain];
  if (entry) return { data: entry.json, rev: entry.rev, synced: true };
  if (demoActive && domain in DEMO_PROJECTIONS) {
    return { data: DEMO_PROJECTIONS[domain], rev: 0, synced: true };
  }
  return NOT_SYNCED;
}
