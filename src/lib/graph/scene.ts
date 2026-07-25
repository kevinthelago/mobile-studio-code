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
  /**
   * The dot is lit only by a DEPENDENCY's health, not the node's own (desktop
   * `healthInherited`, `GlanceCanvas.tsx:260`). Renders at half opacity with the
   * pulse suppressed, so the node you must actually look at stays distinct.
   */
  statusMuted?: boolean;
  /**
   * The whole card renders dimmed — a user-deactivated node (health `off`,
   * base-studio-code#3239, `GlanceCanvas.tsx:265`).
   */
  dimmed?: boolean;
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

/**
 * Glance lifecycle category → accent colour (desktop `CATEGORY_META`,
 * glanceGraph.ts:243, base-studio-code#2583). This is the L0 accent channel:
 * what KIND of work a project is. Deliberately distinct from the health palette
 * so the two channels never blur — which is exactly why the desktop dropped the
 * hash-assigned `role` tier at L0 in #2591.
 */
export const CATEGORY_COLOR: Record<string, string> = {
  greenfield: '#16b3a7', // teal — creating from a pitch
  transform: '#7b74f2', // indigo — restructuring existing repos
  harden: '#b8862f', // bronze — improving/securing in place
  maintain: '#8b93a7', // slate — keeping it running
  data: '#d05fa8', // magenta — a data migration
  script: '#d0a92e', // gold — a single-purpose invocable function
};

/**
 * Axis 1 — HEALTH → dot colour + pulse (desktop `HEALTH_META`, glanceGraph.ts:253,
 * base-studio-code#2541). The attention signal, and the only axis that carries
 * colour. `error` is the one that pulses: the node to look at. `off` (#3239) is
 * the manual user-deactivated state.
 */
export const HEALTH_META: Record<string, { label: string; color: string; pulse: boolean }> = {
  idle: { label: 'idle', color: '#5b9dff', pulse: false },
  healthy: { label: 'healthy', color: '#4fd6a0', pulse: false },
  warning: { label: 'warning', color: '#f2b155', pulse: false },
  error: { label: 'error', color: '#f2555f', pulse: true },
  off: { label: 'off', color: '#6b7280', pulse: false },
};

/**
 * Axis 2 — ACTIVITY → the lifecycle word (desktop `ACTIVITY_META`,
 * glanceGraph.ts:263). **No colour by design** — colour is the health axis's
 * job. `pulse` marks a genuinely-running state; the mobile card has one dot,
 * driven by health, so this flag rides along for the legend/inspector rather
 * than the canvas.
 *
 * Note `waiting` is the desktop's calm replacement for the old `blocked`: an
 * EXPECTED park (an agent waiting on the user), which is why it lives here and
 * not on the health axis.
 */
export const ACTIVITY_META: Record<string, { label: string; pulse: boolean }> = {
  idle: { label: 'idle', pulse: false },
  planning: { label: 'planning', pulse: false },
  building: { label: 'building', pulse: true },
  waiting: { label: 'waiting', pulse: false },
  review: { label: 'in review', pulse: false },
  live: { label: 'live', pulse: true },
};

/**
 * Glance edge kind → colour · dash · width (desktop `EDGE_META`,
 * glanceGraph.ts:277). Five kinds: the three project-network contracts plus the
 * cross-graph library edges `uses-kit` (#2571) and `requires` (#3119).
 *
 * The L0 labels are the #2561 vocabulary — `api` reads "depends on", NOT the
 * microservice "API contract" framing it replaced. The internal key stays `api`
 * for persistence stability.
 */
export const EDGE_META: Record<string, { label: string; color: string; dash: string; w: number }> = {
  api: { label: 'depends on', color: '#5b9dff', dash: '', w: 1.8 },
  data: { label: 'data flow', color: '#b98bff', dash: '', w: 1.8 },
  events: { label: 'event stream', color: '#4fd6a0', dash: '6 5', w: 1.7 },
  'uses-kit': { label: 'uses kit', color: '#22d3ee', dash: '4 4', w: 1.6 },
  requires: { label: 'requires', color: '#8b93a7', dash: '4 4', w: 1.6 },
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
