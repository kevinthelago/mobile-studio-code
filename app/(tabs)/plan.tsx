import React from 'react';
import { PlannerProvider } from '../../src/lib/planner/PlannerContext';
import PlannerScreen from '../(planner)/planner';

/**
 * Planner tab — the local project planner. There is no separate Blueprints view: creating a new
 * project starts from a blueprint via PlannerScreen's picker ("NEW FROM A BLUEPRINT"), so blueprints
 * are only surfaced at project creation. `embedded` marks this as a tab root, so the home view shows
 * no back button (there is nothing to go back to). The desktop's live planning session, when running,
 * is reachable from the header's chat glyph.
 */
export default function PlannerTab() {
  return (
    <PlannerProvider>
      <PlannerScreen embedded />
    </PlannerProvider>
  );
}
