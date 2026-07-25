// SpecHost — render a component by id, wiring host state/behaviour/slots. The reusable seam between the
// app's screens and the data-driven UI: a screen says `<SpecHost id="mobile.skillsCard" on={{ openSkill }} />`
// and the spec draws through the native KitRenderer.
//
// Precedence: a DESKTOP-PUSHED spec (mirrored `components` domain, validated) wins over the bundled
// BASELINE of the same id — so the desktop can update a screen live, while the baseline keeps the app
// complete offline (Apple 2.1) and is the fallback whenever no valid live spec exists. A missing id or
// (in dev) an invalid baseline surfaces a visible marker rather than nothing.
import React from 'react';
import { Text as RNText } from 'react-native';
import { KitRenderer, type KitBindings } from './KitRenderer';
import { useLiveSpec } from './useLiveSpec';
import { getBaselineSpec } from '../../lib/kit/baseline';
import { validateGeneralNode } from '../../lib/kit/generalNode';

export function SpecHost({ id, values, on, slots }: { id: string } & KitBindings) {
  // Live (desktop-pushed) spec is already validated in selectLiveSpecs; baseline is validated by the
  // kit test suite, and re-checked here in dev to catch a hand-edited JSON before it ships.
  const live = useLiveSpec(id);
  const baseline = getBaselineSpec(id);
  const node = live ?? baseline;

  if (!node) {
    return <RNText style={{ color: '#f87171', fontSize: 12 }}>{`[no spec "${id}"]`}</RNText>;
  }
  if (__DEV__ && !live) {
    const errors = validateGeneralNode(node);
    if (errors.length) console.warn(`[kit] baseline spec "${id}" is invalid:\n${errors.join('\n')}`);
  }
  return <KitRenderer node={node} values={values} on={on} slots={slots} />;
}
