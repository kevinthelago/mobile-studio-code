import React from 'react';
import { PlanRoot } from '../../src/screens/plan';

// The Plan tab is the mobile face of the project-planning surface hosted on the
// paired desktop (base-studio-code) and read over the Noise relay tunnel. All of
// its sub-screens (projects → board → issue → scoping, plus the offline pairing
// state) live in src/screens/plan/; this route is a thin host for that
// navigator. See design/msc-redesign/.../screen-plan.jsx for the target.
export default function PlanScreen() {
  return <PlanRoot />;
}
