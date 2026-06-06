// Data model for the mobile project planner (UI scaffold). Mirrors the design
// in design/Mobile Studio Code/planner-*.jsx. Backed by local/seeded state for
// now; the real staged planning agent + GitHub publishing are follow-ups.

export type StageId =
  | 'context' | 'repos' | 'ui' | 'structure' | 'perms' | 'auto' | 'skills';

export type StageState = 'done' | 'current' | 'gated' | 'upcoming';

export type PlannerTab = 'chat' | 'plan' | 'preview' | 'grade';

export type StageInfo = { id: StageId; label: string };

export const STAGES: StageInfo[] = [
  { id: 'context', label: 'Context' },
  { id: 'repos', label: 'Repos' },
  { id: 'ui', label: 'UI' },
  { id: 'structure', label: 'Structure' },
  { id: 'perms', label: 'Perms' },
  { id: 'auto', label: 'Autos' },
  { id: 'skills', label: 'Skills' },
];

export type Section = {
  stage: StageId;
  title: string;
  lines: string[];
  meta: string[];
  confirmed: boolean;
};

export type PlannerMessage =
  | { kind: 'assistant'; text: string }
  | { kind: 'user'; text: string }
  | { kind: 'system'; text: string }
  | { kind: 'section'; section: Section };

export type MilestoneStatus = 'done' | 'ready' | 'gated';
export type Milestone = {
  name: string;
  issues: number;
  agents: number;
  status: MilestoneStatus;
};

export type ContextFile = { name: string; size: string };

export type GateCheck = { label: string; ok: boolean };

export type GradeCategory = { name: string; pct: number };
export type GradeSuggestion = {
  severity: 'warn' | 'info' | 'bad';
  title: string;
  detail: string;
};
export type Grade = {
  letter: string;
  pct: number;
  summary: string;
  categories: GradeCategory[];
  suggestions: GradeSuggestion[];
};

export type Blueprint = {
  id: string;
  name: string;
  /** Number of active stages (0 = custom / pick stages). */
  stages: number;
  desc: string;
};

export type PlanStatus = 'setup' | 'drafting' | 'blocked' | 'ready';

export type Plan = {
  title: string;
  repo: string | null;
  status: PlanStatus;
  blueprintId: string;
  stageStates: Record<StageId, StageState>;
  messages: PlannerMessage[];
  contextFiles: ContextFile[];
  milestones: Milestone[];
  /** Gate checks for the current stage transition (Structure → Perms in seed). */
  gate: GateCheck[];
  grade: Grade;
};

export const BLUEPRINTS: Blueprint[] = [
  { id: 'full', name: 'Full app', stages: 7, desc: 'Pitch → full GitHub plan' },
  { id: 'ui', name: 'UI prototype', stages: 3, desc: 'Context · UI · Structure' },
  { id: 'refactor', name: 'Refactor existing', stages: 5, desc: 'From your repos' },
  { id: 'custom', name: 'Custom', stages: 0, desc: 'Pick stages' },
];

/** Count of confirmed sections / total stages, e.g. "2/7". */
export function confirmedLabel(plan: Plan): string {
  const total = STAGES.length;
  const confirmed = plan.messages.filter(
    (m) => m.kind === 'section' && m.section.confirmed,
  ).length;
  return `${confirmed}/${total}`;
}
