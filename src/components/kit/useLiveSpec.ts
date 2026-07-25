// Bridge from the mirrored `components` domain to a single spec by id — the React half of liveSpecs.ts.
// Returns the desktop-pushed spec for `id`, or undefined when the domain isn't synced or carries no
// spec for it (the common case today, until base-studio-code ships `spec` on the components payload).
import { useMemo } from 'react';
import { useMirrorDomain } from '../../lib/mirror/MirrorContext';
import { selectLiveSpecs } from '../../lib/kit/liveSpecs';
import type { GeneralNode } from '../../lib/kit/generalNode';

export function useLiveSpec(id: string): GeneralNode | undefined {
  const { data, synced } = useMirrorDomain('components');
  const specs = useMemo(() => (synced ? selectLiveSpecs(data) : {}), [synced, data]);
  return specs[id];
}
