import { Plan, StageId, StageState } from './types';

// Seed plan used by the UI scaffold. Models the design's "Habit tracker"
// drafting session (UI stage current, Structure gated). Real plans will be
// produced by the staged planning agent (follow-up).

const DRAFTING_STAGES: Record<StageId, StageState> = {
  context: 'done',
  repos: 'done',
  ui: 'current',
  structure: 'gated',
  perms: 'upcoming',
  auto: 'upcoming',
  skills: 'upcoming',
};

export function seedPlan(title: string, blueprintId: string): Plan {
  return {
    title: title || 'New project',
    repo: 'kevinthelago/habits',
    status: 'drafting',
    blueprintId,
    stageStates: { ...DRAFTING_STAGES },
    messages: [
      { kind: 'system', text: 'UI stage · screens & flows' },
      {
        kind: 'assistant',
        text: "Based on the goal and stack, here's the screen set I'd build. I kept it to the core loop — log a habit, see streaks, review trends.",
      },
      {
        kind: 'section',
        section: {
          stage: 'ui',
          title: 'Screens & flows',
          lines: [
            '6 screens across 3 flows',
            'Onboarding → Home → Detail',
            'Empty, loading & error states',
          ],
          meta: ['react-native', 'expo-router', '6 screens', '3 flows'],
          confirmed: false,
        },
      },
      {
        kind: 'assistant',
        text: 'The live preview is rendering now — open the Preview tab to walk through it. Confirm the section when it looks right and I’ll gate Structure open.',
      },
    ],
    contextFiles: [
      { name: 'goal.md', size: '1.2 KB' },
      { name: 'stack.md', size: '0.8 KB' },
      { name: 'architecture.md', size: '2.4 KB' },
      { name: 'conventions.md', size: '1.1 KB' },
      { name: 'data-model.md', size: '0.9 KB' },
      { name: 'glossary.md', size: '0.4 KB' },
    ],
    milestones: [
      { name: 'M1 · Foundations', issues: 6, agents: 2, status: 'done' },
      { name: 'M2 · Core logging', issues: 8, agents: 2, status: 'ready' },
      { name: 'M3 · Streaks & trends', issues: 6, agents: 1, status: 'ready' },
      { name: 'M4 · Polish & ship', issues: 3, agents: 1, status: 'gated' },
    ],
    gate: [
      { label: '3 issues missing acceptance criteria', ok: false },
      { label: '1 milestone has no agent assigned', ok: false },
      { label: 'All issues have file ownership', ok: true },
    ],
    grade: {
      letter: 'A-',
      pct: 91,
      summary: 'Agent-ready. Clear two warnings to reach A.',
      categories: [
        { name: 'Acceptance criteria', pct: 95 },
        { name: 'File ownership', pct: 88 },
        { name: 'Milestone assignment', pct: 92 },
        { name: 'Issue scope', pct: 90 },
        { name: 'Context coverage', pct: 86 },
        { name: 'Dependency order', pct: 94 },
      ],
      suggestions: [
        { severity: 'warn', title: '3 issues in M2 lack acceptance criteria', detail: 'Blocks the Structure → Perms gate' },
        { severity: 'warn', title: 'M4 has no agent assigned', detail: 'Assign from the fleet or auto-assign' },
        { severity: 'info', title: 'Context coverage thin on error states', detail: 'Add a conventions note for failures' },
      ],
    },
  };
}
