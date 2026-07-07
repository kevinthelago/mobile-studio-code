// Graph scene (#220) — the ONE render contract between the pure model adapters (glanceAdapter /
// orgAdapter) and the react-native-svg GraphCanvas. Adapters turn domain data (glance projects /
// org positions) into a laid-out scene of boxes + pre-routed edge paths; the canvas is a thin,
// READ-ONLY renderer (pan/zoom/tap-select only — no drag-move, no connect, no context menus).
// Pure (React-free) so scenes are unit-testable and deterministic.

/** A laid-out node card, in world (design-space) coordinates — top-left box. */
export interface SceneNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Card title (project slug / persona name). */
  title: string;
  /** Secondary line under the title (role · status / persona role). */
  subtitle?: string;
  /** Left accent-bar + selection colour (role/archetype hue). */
  accentColor: string;
  /** Status dot colour; omitted = no dot (org resource/external nodes). */
  statusColor?: string;
  /** The status is live activity (desktop pulses these; the mobile canvas brightens the dot). */
  pulse?: boolean;
  /** ≥2 ⇒ render as a STACKED card (pool of interchangeable members) with a count badge. */
  stackCount?: number;
  /** Pool stacks only: false = members have mixed external wiring (desktop #2436's flag). */
  homogeneous?: boolean;
  /** The drill target this node opens (a project's fleet / a pool's members), if any. */
  drillId?: string;
}

/** A pre-routed edge: cubic-bezier path + arrowhead(s), in world coordinates. */
export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  /** SVG path `d` for the curve (vendored edgePath geometry). */
  d: string;
  /** Filled-triangle arrowhead path at the target. */
  arrow: string;
  /** Second arrowhead at the source (bidirectional org archetypes). */
  arrowStart?: string;
  color: string;
  /** SVG stroke-dasharray ("" = solid). */
  dash: string;
  width: number;
  /** Optional short label at the curve midpoint. */
  label?: string;
  labelX?: number;
  labelY?: number;
  /** Part of a mutual-dependency cycle (glance hazard styling). */
  isCycle?: boolean;
}

export interface GraphScene {
  nodes: SceneNode[];
  edges: SceneEdge[];
  /** World bounds the viewport fits to. */
  worldW: number;
  worldH: number;
}

// ── Palettes (mirroring the desktop's glance/org colour language) ────────────────────────────────

/** Glance role → accent colour (desktop `ROLE_COLOR`, glanceGraph.ts). */
export const ROLE_COLOR: Record<string, string> = {
  infra: '#5b9dff',
  service: '#4fd6a0',
  data: '#b98bff',
  client: '#f2b155',
};

/** Glance status → colour + pulse (desktop `STATUS_META`, glanceGraph.ts). */
export const STATUS_META: Record<string, { label: string; color: string; pulse: boolean }> = {
  idle: { label: 'idle', color: '#6b7280', pulse: false },
  planning: { label: 'planning', color: '#5b9dff', pulse: false },
  building: { label: 'building', color: '#4fd6a0', pulse: true },
  review: { label: 'in review', color: '#f2b155', pulse: false },
  blocked: { label: 'blocked', color: '#f2555f', pulse: true },
  done: { label: 'shipped', color: '#3f7d63', pulse: false },
  live: { label: 'live', color: '#3fe08f', pulse: true },
};

/** Glance edge kind → colour · dash · width (desktop `EDGE_META`, glanceGraph.ts). */
export const EDGE_META: Record<string, { label: string; color: string; dash: string; w: number }> = {
  api: { label: 'API contract', color: '#5b9dff', dash: '', w: 1.8 },
  data: { label: 'data read', color: '#b98bff', dash: '', w: 1.8 },
  events: { label: 'event stream', color: '#4fd6a0', dash: '6 5', w: 1.7 },
};

/** Org archetype line style → SVG dash-array (desktop `styleDash`, orgLayout.ts). */
export function styleDash(style: string): string {
  switch (style) {
    case 'dashed':
      return '7 5';
    case 'gated':
      return '3 5';
    case 'dotted':
      return '1 6';
    case 'resource':
      return '4 6';
    default:
      return '0'; // solid
  }
}
