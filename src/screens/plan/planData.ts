// Plan tab — mock planning data.
//
// The Plan tab is the mobile face of the project-planning surface hosted on the
// paired desktop (base-studio-code) and read over the tunnel. The tunnel
// protocol does not yet carry planning state (it only streams terminal panes —
// see src/lib/types.ts), so these screens render a faithful, ready-to-wire
// presentation layer seeded with the same fixtures as the design mockup
// (design/msc-redesign/.../screen-plan.jsx). When the relay protocol gains a
// planning channel, swap these fixtures for live `useTunnel()` state — the
// component props are shaped to make that a drop-in.
//
// oklch() is not a valid React Native color, so the design's oklch person/label
// hues are approximated here as hex (same intent: distinct, palette-coherent).

export type PersonId = 'lina' | 'alex' | 'pete' | 'zara' | 'bot';

export interface Person {
  color: string;
  initial: string;
}

export const PLAN_PEOPLE: Record<PersonId, Person> = {
  lina: { color: '#d98b6b', initial: 'L' }, // oklch(0.7 0.13 30)
  alex: { color: '#6fa8d0', initial: 'A' }, // oklch(0.7 0.10 220)
  pete: { color: '#5fb074', initial: 'P' }, // oklch(0.68 0.13 145)
  zara: { color: '#ab90d8', initial: 'Z' }, // oklch(0.7 0.12 290)
  bot: { color: '#6b6660', initial: '⌬' },  // oklch(0.45 0 0)
};

export type LabelId =
  | 'net' | 'perf' | 'security' | 'docs' | 'refactor' | 'api' | 'infra' | 'test';

export interface PlanLabel {
  c: string; // hue (hex approximation of the design's oklch)
  t: string; // display text
}

export const PLAN_LABELS: Record<LabelId, PlanLabel> = {
  net: { c: '#6fa3dd', t: 'net' },        // oklch(0.72 0.13 250)
  perf: { c: '#dca85a', t: 'perf' },      // oklch(0.78 0.14 70)
  security: { c: '#e27d66', t: 'security' }, // oklch(0.7 0.18 25)
  docs: { c: '#b3a97c', t: 'docs' },      // oklch(0.7 0.06 90)
  refactor: { c: '#9c95b2', t: 'refactor' }, // oklch(0.68 0.05 280)
  api: { c: '#57c0aa', t: 'api' },        // oklch(0.72 0.12 175)
  infra: { c: '#5fa6ab', t: 'infra' },    // oklch(0.65 0.08 195)
  test: { c: '#6fb787', t: 'test' },      // oklch(0.72 0.10 145)
};

export function labelOf(id: string): PlanLabel {
  return (PLAN_LABELS as Record<string, PlanLabel>)[id] ?? { c: '#7a736b', t: id };
}

export interface PlanProject {
  id: string;
  gh: number;
  name: string;
  pitch: string;
  repo: string;
  iteration: string;
  open: number;
  total: number;
  prs: number;
  mile: number;
  owner: PersonId;
  last: string;
  planning?: boolean;
  progress?: number;
  host: boolean;
}

export const PLAN_PROJECTS: PlanProject[] = [
  {
    id: 'prj_31a', gh: 14, name: 'Settlement webhooks v2',
    pitch: 'Sub-second merchant dashboard notifications via webhook fanout.',
    repo: 'acme/payments', iteration: 'Iter 24 · ends Fri',
    open: 17, total: 23, prs: 3, mile: 5, owner: 'lina',
    last: '4m ago', planning: false, host: true,
  },
  {
    id: 'prj_2fa', gh: 15, name: 'Offline pairing mode',
    pitch: 'Same-LAN desktop ↔ mobile pairing without relay round-trip.',
    repo: 'acme/payments', iteration: 'drafting',
    open: 0, total: 0, prs: 0, mile: 0, owner: 'lina',
    last: 'yesterday', planning: true, progress: 0.38, host: true,
  },
  {
    id: 'prj_27e', gh: 9, name: 'Knowledge → Notion sync',
    pitch: 'One-way mirror of selected #docs blocks into a Notion workspace.',
    repo: 'acme/docs', iteration: 'Iter 12 · ends Wed',
    open: 9, total: 18, prs: 1, mile: 4, owner: 'alex',
    last: '2d ago', host: false,
  },
];

export interface PlanColumn {
  k: string;
  t: string;
  n: number;
  c: string; // semantic token name resolved per-theme at render
  on?: boolean;
}

// `c` is a key into a per-theme color map (see PlanBoard) so columns track the
// active theme rather than hard-coding the dawn palette.
export const PLAN_COLUMNS: PlanColumn[] = [
  { k: 'backlog', t: 'Backlog', n: 9, c: 'fgDim' },
  { k: 'upnext', t: 'Up next', n: 4, c: 'info' },
  { k: 'doing', t: 'In progress', n: 3, c: 'accent', on: true },
  { k: 'review', t: 'In review', n: 2, c: 'success' },
  { k: 'done', t: 'Done', n: 5, c: 'fgMuted' },
];

export interface PlanCard {
  n: number;
  t: string;
  labels: LabelId[];
  who: PersonId[];
  ai: number;
  comments: number;
  pr?: string;
  m?: string;
  focused?: boolean;
}

export const PLAN_DOING: PlanCard[] = [
  {
    n: 418, t: 'net: framing v2 + schema regen', labels: ['net'],
    who: ['lina', 'alex'], ai: 3, comments: 5, pr: '#418', m: 'M1', focused: true,
  },
  {
    n: 417, t: 'Subscriber HMAC verification middleware', labels: ['security', 'net'],
    who: ['alex'], ai: 2, comments: 1, pr: '#417 draft', m: 'M2',
  },
  {
    n: 416, t: 'Worker → webhook emitter', labels: ['net'],
    who: ['pete'], ai: 1, comments: 2, m: 'M1',
  },
];

export interface PlanSubtask {
  n: number;
  t: string;
  done?: boolean;
  isNew?: boolean;
  note: string;
  est: string;
}

export const PLAN_SUBTASKS: PlanSubtask[] = [
  { n: 1, t: 'Spec the v2 frame shape', done: true, note: 'checked-in to docs/framing.md @ b04', est: '½d' },
  { n: 2, t: 'Encoder + tests (round-trip + size budget)', note: 'draft on feat/tunnel-v2 · 70% done', est: '1d' },
  { n: 3, t: 'Regenerate schema.json from proto.rs', note: 'CI must fail on drift', est: '¼d' },
  { n: 4, t: 'Capability negotiation in pairing hello', isNew: true, note: 'suggested · client must downgrade gracefully', est: '½d' },
];

export interface PlanActivity {
  who: PersonId;
  a: string;
  t: string;
}

export const PLAN_ACTIVITY: PlanActivity[] = [
  { who: 'lina', a: 'opened the issue', t: 'yesterday 16:02' },
  { who: 'alex', a: 'asked: "can we hold for the encoder benchmark?"', t: '17:14' },
  { who: 'bot', a: 'linked PR #418 (draft)', t: '18:01' },
  { who: 'lina', a: 'moved to In progress · self-assigned + @alex', t: 'today 10:42' },
  { who: 'bot', a: 'CI · clippy + cargo test passed', t: '11:08' },
];

export interface ScopingMessage {
  who: 'you' | 'claude';
  t: string;
}

export const SCOPING_MESSAGES: ScopingMessage[] = [
  { who: 'you', t: 'Same-LAN desktop ↔ mobile pairing without round-trip through the relay.' },
  { who: 'claude', t: 'Got it. A few questions before I draft issues.\n\n**1. Discovery mechanism** — mDNS, manual IP entry, or a QR code shown on desktop?' },
  { who: 'you', t: 'QR code shown on desktop. Mobile scans it.' },
  { who: 'claude', t: 'Good — that handles auth too. Want me to reuse the existing pairing token format (PRJ-1f-XXXX) or move to a one-shot Diffie-Hellman?' },
  { who: 'you', t: 'DH. Less reuse-risk on stolen QR.' },
  { who: 'claude', t: 'Three more:\n\n**2.** Fallback when no LAN route is found — keep relay path, or refuse?\n**3.** Should pairing carry a "capabilities" frame, or stay symmetric with the existing protocol?\n**4.** Multi-host: can mobile pair with > 1 desktop simultaneously?' },
  { who: 'you', t: 'Keep relay fallback. Capabilities frame yes. Multi-host: yes.' },
];

export interface ScopingDraftItem {
  t: string;
  est: string;
  labels: LabelId[];
}

export const SCOPING_DRAFT: ScopingDraftItem[] = [
  { t: 'Desktop: render pairing QR with DH ephemeral public key', est: '½d', labels: ['security'] },
  { t: 'Mobile: QR scan + DH handshake completion', est: '1d', labels: ['security', 'net'] },
  { t: 'LAN discovery — fall back to relay after 2s timeout', est: '½d', labels: ['net'] },
  { t: 'Add "capabilities" frame to pairing hello', est: '¼d', labels: ['net'] },
  { t: 'Multi-host registry on mobile (stored hosts list)', est: '1d', labels: ['api'] },
  { t: 'Docs · pairing flow + threat model', est: '¼d', labels: ['docs', 'security'] },
];
