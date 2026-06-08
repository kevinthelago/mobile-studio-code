// Builtin pipeline handlers. The kickoff lists lint-plan + grade-plan as pure ports,
// but they weren't in the shared modules, so they're authored here over the same
// StageContext/PipelineRunResult contract — reconcile with desktop's real handlers
// when shared (and fold into plannerCore.fixtures.json).

import {
  registerPipelineHandler, type StageContext, type PipelineRunResult,
} from './core';

function parseArr(content: string | undefined): unknown[] {
  if (!content) return [];
  try { const v: unknown = JSON.parse(content); return Array.isArray(v) ? v : []; } catch { return []; }
}
function field(o: unknown, k: string): unknown {
  return o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined;
}

/** lint-plan — scan the plan's artifacts for gaps. Fails (with findings) if any. */
export function lintPlan(ctx: StageContext): PipelineRunResult {
  const findings: string[] = [];
  const issues = parseArr(ctx.artifacts['issues.json']);
  const phases = parseArr(ctx.artifacts['phases.json']);

  if (!ctx.artifacts['goal']) findings.push('Goal not captured.');
  if (phases.length === 0) findings.push('No phases/milestones defined.');
  if (issues.length === 0) findings.push('No agent-ready issues defined.');
  issues.forEach((it, i) => {
    const title = String(field(it, 'title') ?? `#${i + 1}`);
    if (!field(it, 'acceptance')) findings.push(`Issue "${title}" has no acceptance criteria.`);
    if (!field(it, 'files')) findings.push(`Issue "${title}" has no owned files.`);
  });

  return findings.length
    ? { status: 'fail', message: `${findings.length} gap${findings.length === 1 ? '' : 's'} found`, output: findings }
    : { status: 'ok', message: 'No gaps found', output: [] };
}

/** grade-plan — heuristic agent-readiness score + suggestions. Always succeeds. */
export function gradePlan(ctx: StageContext): PipelineRunResult {
  const issues = parseArr(ctx.artifacts['issues.json']);
  const phases = parseArr(ctx.artifacts['phases.json']);
  const withAcceptance = issues.filter((i) => field(i, 'acceptance')).length;
  const withFiles = issues.filter((i) => field(i, 'files')).length;

  let score = 0;
  if (ctx.artifacts['goal']) score += 15;
  if (ctx.artifacts['scope']) score += 10;
  if (phases.length) score += 20;
  if (issues.length) score += 20;
  if (issues.length) score += Math.round((withAcceptance / issues.length) * 20);
  if (issues.length) score += Math.round((withFiles / issues.length) * 15);
  score = Math.min(100, score);

  const letter = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  const suggestions: string[] = [];
  if (!phases.length) suggestions.push('Add phases/milestones.');
  if (issues.length && withAcceptance < issues.length) suggestions.push('Add acceptance criteria to every issue.');
  if (issues.length && withFiles < issues.length) suggestions.push('Assign owned files/globs to every issue.');
  if (!issues.length) suggestions.push('Break the work into agent-ready issues.');

  return { status: 'ok', message: `Grade ${letter} (${score}%)`, output: { score, letter, suggestions } };
}

let registered = false;
/** Register the builtin handlers once (idempotent). Call on planner init. */
export function registerBuiltinPipelines(): void {
  if (registered) return;
  registered = true;
  registerPipelineHandler('lint-plan', lintPlan);
  registerPipelineHandler('grade-plan', gradePlan);
}
