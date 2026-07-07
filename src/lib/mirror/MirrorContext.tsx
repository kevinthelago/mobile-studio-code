import React, {
  createContext, useContext, useEffect, useReducer, type ReactNode,
} from 'react';
import {
  EMPTY_MIRROR, applyMirrorFrame, type MirrorState,
} from './state';
import { subscribeMirrorFeed } from './feed';

/** What a page sees for one domain. `synced` is false until a frame lands. */
export type MirrorDomainView = {
  data: unknown;
  rev: number;
  synced: boolean;
};

const NOT_SYNCED: MirrorDomainView = { data: undefined, rev: -1, synced: false };

const MirrorContext = createContext<MirrorState>(EMPTY_MIRROR);

/**
 * Holds the domain → projection map for the whole app. The feed (`feed.ts`)
 * is the single wire attachment point; the provider itself never knows the
 * transport. Stale frames return the same state reference from the reducer,
 * so they cause no re-render.
 */
export function MirrorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(applyMirrorFrame, EMPTY_MIRROR);

  useEffect(() => subscribeMirrorFeed(dispatch), []);

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
