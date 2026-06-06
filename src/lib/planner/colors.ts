// Semantic status colors for the planner, theme-independent (like run.tsx's
// pane status colors). The Claude orange→purple gradient matches PrimaryButton.

export const PLAN_COLORS = {
  good: '#7ee2c4',
  lime: '#a3e635',
  warn: '#ffd479',
  bad: '#ff8fa3',
  info: '#7dd3fc',
  plan: '#c084fc',
} as const;

export const GRADE_COLOR: Record<string, string> = {
  A: PLAN_COLORS.good,
  B: PLAN_COLORS.lime,
  C: PLAN_COLORS.warn,
  D: '#ffb088',
  F: PLAN_COLORS.bad,
};

export const PLAN_GRADIENT = ['#d97757', '#c084fc'] as const;

/** Color for a grade percentage (≥90 good, ≥80 lime, else accent-ish). */
export function gradeBarColor(pct: number): string {
  if (pct >= 90) return PLAN_COLORS.good;
  if (pct >= 80) return PLAN_COLORS.lime;
  return PLAN_COLORS.warn;
}
