import React from 'react';
import { PlannerProvider } from '../../src/lib/planner/PlannerContext';
import PlannerScreen from '../(planner)/planner';

/**
 * Planner tab (#218) — mounts the existing, mature planner suite as a bottom
 * tab. The `/(planner)/planner` modal route stays too (it is still pushed from
 * the repo picker); this tab is the primary home. The route file is named
 * `plan` (not `planner`) so its URL does not collide with `/(planner)/planner`
 * — both would otherwise serialize to `/planner`.
 */
export default function PlannerTab() {
  return (
    <PlannerProvider>
      <PlannerScreen />
    </PlannerProvider>
  );
}
