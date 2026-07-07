// Graph module barrel (#220) — the public surface: the vendored base-studio-code graph core
// (layers/order/cycles/edgePath/types — see each file's VENDORED header), the scene contract the
// GraphCanvas renders, the layered layout, the drill stack, and the two model adapters + demo
// fixtures. The shell issue mounts GraphDemoScreen (src/screens/GraphDemoScreen.tsx) over this.

// Vendored core (byte-exact from base-studio-code src/shared/lib/graph @ 6349c0a2).
export type { GraphNode, GraphEdge } from './types';
export { layerDag } from './layers';
export { orderLayers, type OrderLayersOpts } from './order';
export { findBackEdges, mutualPairs } from './cycles';
export { graphEdge, anchor, type EdgeBox, type EdgeRouting, type GraphEdgeOpts, type GraphEdgeGeom } from './edgePath';

// Scene contract + palettes.
export type { GraphScene, SceneNode, SceneEdge } from './scene';
export { ROLE_COLOR, STATUS_META, EDGE_META, styleDash } from './scene';

// Layout.
export { layeredLayout, gridLayout, type LayeredLayout, type LayeredLayoutOpts } from './layout';

// Drill stack.
export {
  EMPTY_DRILL,
  drillPush,
  drillPop,
  drillTop,
  canDrillPop,
  drillDepth,
  topDrillId,
  stackFromDrillId,
  type DrillDomain,
  type DrillFrame,
  type DrillStack,
} from './drillStack';

// Adapters.
export {
  buildGlanceScene,
  buildFleetScene,
  GLANCE_NODE_W,
  GLANCE_NODE_H,
  type GlanceGraphInput,
  type GlanceProject,
  type GlanceAgent,
  type GlanceLink,
  type GlanceRole,
  type GlanceStatus,
  type GlanceEdgeKind,
} from './glanceAdapter';
export {
  buildOrgScene,
  buildPoolScene,
  detectPools,
  collapseOrg,
  poolSubgraph,
  ORG_ARCHETYPES,
  ORG_NODE_SIZE,
  type OrgGraphInput,
  type OrgPosition,
  type OrgRelationship,
  type OrgPersona,
  type OrgPool,
  type OrgPositionKind,
  type CollapsedOrg,
} from './orgAdapter';

// Demo fixtures.
export { SAMPLE_GLANCE, SAMPLE_ORG } from './sampleData';
