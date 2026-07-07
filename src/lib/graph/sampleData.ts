// Sample graph data (#220) — demo-screen fixtures. The glance sample borrows the shape (and a
// recognizable subset) of base-studio-code's packaged Northwind spine (src-tauri/data/glance/
// sample-graph.json — 14 nodes / 20 edges incl. the analytics↔reporting mutual-dependency cycle),
// trimmed to phone scale, plus a deterministic sample fleet per building project (mirroring the
// desktop's glanceFleet sample topology: director hub + workers + a reviewer). The org sample
// mirrors the desktop's built-in fleet org shape: scaffold singletons (director / reviewer) plus a
// stacked engineer pool, a stewarded resource, and an external user.
import type { GlanceGraphInput, GlanceAgent } from './glanceAdapter';
import type { OrgGraphInput } from './orgAdapter';

/** A small deterministic fleet: director hub, N workers depending on the director, one reviewer. */
function sampleFleet(projectId: string, workers: number): GlanceAgent[] {
  const director: GlanceAgent = { id: `${projectId}:director`, name: 'director', role: 'director', status: 'building' };
  const workerAgents: GlanceAgent[] = Array.from({ length: workers }, (_, i) => ({
    id: `${projectId}:w${i + 1}`,
    name: `worker ${i + 1}`,
    role: 'worker',
    status: i === 0 ? 'building' : 'planning',
    dependsOn: [director.id],
  }));
  const reviewer: GlanceAgent = {
    id: `${projectId}:reviewer`,
    name: 'reviewer',
    role: 'reviewer',
    status: 'idle',
    dependsOn: workerAgents.map((w) => w.id),
  };
  return [director, ...workerAgents, reviewer];
}

/** The glance demo graph: 9 projects of the Northwind spine + 2 drillable sample fleets.
 *  Keeps the analytics↔reporting cycle so the hazard styling shows. */
export const SAMPLE_GLANCE: GlanceGraphInput = {
  projects: [
    { id: 'auth-core', role: 'infra', status: 'done' },
    { id: 'events-bus', role: 'infra', status: 'done' },
    { id: 'identity-svc', role: 'service', status: 'building', agents: sampleFleet('identity-svc', 3) },
    { id: 'ledger', role: 'data', status: 'review' },
    { id: 'user-api', role: 'service', status: 'building', agents: sampleFleet('user-api', 2) },
    { id: 'billing-svc', role: 'service', status: 'planning' },
    { id: 'analytics', role: 'data', status: 'blocked', faults: 2 },
    { id: 'reporting', role: 'data', status: 'blocked' },
    { id: 'web-app', role: 'client', status: 'building' },
  ],
  links: [
    { from: 'identity-svc', to: 'auth-core', kind: 'api' },
    { from: 'user-api', to: 'identity-svc', kind: 'api' },
    { from: 'billing-svc', to: 'identity-svc', kind: 'api' },
    { from: 'billing-svc', to: 'ledger', kind: 'data' },
    { from: 'ledger', to: 'events-bus', kind: 'events' },
    { from: 'analytics', to: 'events-bus', kind: 'events' },
    { from: 'web-app', to: 'user-api', kind: 'api' },
    { from: 'web-app', to: 'billing-svc', kind: 'api' },
    { from: 'reporting', to: 'ledger', kind: 'data' },
    { from: 'reporting', to: 'analytics', kind: 'data' },
    { from: 'analytics', to: 'reporting', kind: 'data' }, // the mutual-dependency cycle
  ],
};

/** The org demo graph: director + reviewer scaffold, a 3-member engineer pool (stacks — one member
 *  is wired differently so the stack shows `mixed wiring`), the shared commons resource, and an
 *  external user. */
export const SAMPLE_ORG: OrgGraphInput = {
  personas: [
    { id: 'director', name: 'Director', role: 'director' },
    { id: 'reviewer', name: 'Reviewer', role: 'reviewer' },
    { id: 'engineer', name: 'Engineer', role: 'worker' }, // worker-role ⇒ stacks by default
  ],
  positions: [
    { nodeId: 'n-director', kind: 'agent', personaId: 'director' },
    { nodeId: 'n-reviewer', kind: 'agent', personaId: 'reviewer' },
    { nodeId: 'n-eng-a', kind: 'agent', personaId: 'engineer', label: 'Engineer A' },
    { nodeId: 'n-eng-b', kind: 'agent', personaId: 'engineer', label: 'Engineer B' },
    { nodeId: 'n-eng-c', kind: 'agent', personaId: 'engineer', label: 'Engineer C' },
    { nodeId: 'n-commons', kind: 'resource', label: 'Shared commons' },
    { nodeId: 'n-user', kind: 'external', label: 'User' },
  ],
  relationships: [
    { id: 'r1', archetype: 'manages', from: 'n-director', to: 'n-eng-a' },
    { id: 'r2', archetype: 'manages', from: 'n-director', to: 'n-eng-b' },
    { id: 'r3', archetype: 'manages', from: 'n-director', to: 'n-eng-c' },
    { id: 'r4', archetype: 'oversees', from: 'n-reviewer', to: 'n-eng-a' },
    { id: 'r5', archetype: 'oversees', from: 'n-reviewer', to: 'n-eng-b' },
    // Engineer C is stewarded onto the commons instead of overseen — mixed wiring (#2436 shape).
    { id: 'r6', archetype: 'stewards', from: 'n-eng-c', to: 'n-commons' },
    { id: 'r7', archetype: 'peers', from: 'n-eng-a', to: 'n-eng-b' }, // internal mesh, folds away
    { id: 'r8', archetype: 'consults', from: 'n-director', to: 'n-reviewer' },
    { id: 'r9', archetype: 'serves', from: 'n-director', to: 'n-user' },
  ],
};
