// The baseline spec bundle — the app's UI shipped as DATA. Each JSON here is a component record of the
// shape base-studio-code's `bsc ui export` emits (`{ id, name, role, spec }`, extra fields ignored);
// the mobile app renders them offline, with zero connection, which is what makes it a complete,
// Apple-reviewable product on its own (guideline 2.1). When the tunnel is connected, live specs from
// the `components` domain override these by id.
//
// Node-safe (only JSON + the GeneralNode type — no react-native), so tests can validate the whole
// baseline. New records: drop the JSON next to these and add an import line (a codegen'd index can
// replace the hand-list once the set grows).
import type { GeneralNode } from '../generalNode';
import mirrorEmpty from './mobile.mirrorEmpty.json';
import mirrorDisconnected from './mobile.mirrorDisconnected.json';
import moreMenu from './mobile.moreMenu.json';
import connectionStatus from './mobile.connectionStatus.json';
import skillItem from './mobile.skillItem.json';
import skillGroup from './mobile.skillGroup.json';
import lessonItem from './mobile.lessonItem.json';

/** A baseline component record — the pared `bsc ui export` shape the app needs to render. */
export interface BaselineRecord {
  id: string;
  name?: string;
  role?: string;
  spec: GeneralNode;
}

// The JSON's `spec.type` widens to `string`; the record is validated at load/test time by
// validateGeneralNode, so the structural cast here is checked, not blind.
// PLACEHOLDERS pending the designer session's canonical exports. base-studio-code is the source of
// truth for spec CONTENT; each record here is replaced when its `bsc ui export` (same `mobile.<id>`)
// is ingested. The renderer/loader is permanent; this list is transitional.
const RECORDS = [
  mirrorEmpty, mirrorDisconnected, moreMenu, connectionStatus,
  skillItem, skillGroup, lessonItem,
] as unknown as BaselineRecord[];

export const BASELINE_RECORDS: Record<string, BaselineRecord> = Object.fromEntries(
  RECORDS.map((r) => [r.id, r]),
);
export const BASELINE_IDS: readonly string[] = Object.keys(BASELINE_RECORDS);

/** The spec for a baseline component id, or undefined if it isn't bundled. */
export function getBaselineSpec(id: string): GeneralNode | undefined {
  return BASELINE_RECORDS[id]?.spec;
}
