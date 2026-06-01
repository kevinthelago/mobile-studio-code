import React, { useMemo, useState } from 'react';
import { useTunnel } from '../../lib/TunnelContext';
import { PlanNav, PlanView } from './nav';
import { PlanProjects } from './PlanProjects';
import { PlanBoard } from './PlanBoard';
import { PlanIssue } from './PlanIssue';
import { PlanScoping } from './PlanScoping';
import { PlanPairing } from './PlanPairing';

// PlanRoot — the Plan tab's in-tab navigator. The Plan surface mirrors the
// desktop's project-planning views over the tunnel; when the tunnel is not
// connected there is nothing to mirror, so we render the pairing screen.
//
// Navigation is a small local stack (no nested Expo Router navigator): the five
// sub-screens push/pop via the PlanNav callbacks. The stack resets implicitly
// when the tunnel drops, since PlanPairing renders instead of the stack.
export function PlanRoot() {
  const { connectionState } = useTunnel();
  const [stack, setStack] = useState<PlanView[]>([{ name: 'projects' }]);

  const nav = useMemo<PlanNav>(() => ({
    toProjects: () => setStack([{ name: 'projects' }]),
    toBoard: (projectId) => setStack((s) => [...s, { name: 'board', projectId }]),
    toIssue: (projectId, issueN) => setStack((s) => [...s, { name: 'issue', projectId, issueN }]),
    toScoping: (projectId) => setStack((s) => [...s, { name: 'scoping', projectId }]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  }), []);

  if (connectionState !== 'connected') {
    return <PlanPairing />;
  }

  const view = stack[stack.length - 1];
  switch (view.name) {
    case 'board':
      return <PlanBoard nav={nav} projectId={view.projectId} />;
    case 'issue':
      return <PlanIssue nav={nav} projectId={view.projectId} issueN={view.issueN} />;
    case 'scoping':
      return <PlanScoping nav={nav} projectId={view.projectId} />;
    case 'projects':
    default:
      return <PlanProjects nav={nav} />;
  }
}
