// Network orchestrator for publishing a plan to GitHub: find-or-create milestones,
// then create issues (labels + milestone links). The pure plan-building lives in
// publishPlan.ts (re-exported here for convenience).

import {
  listMilestones, createMilestone, createIssueWithMeta, type GithubIssue,
} from '../github';
import type { PublishPlan } from './publishPlan';

export * from './publishPlan';

export interface PublishResult {
  milestonesCreated: number;
  issues: { title: string; url: string }[];
  failures: { title: string; error: string }[];
}

/** Create the milestones (find-or-create by title) and issues on GitHub. */
export async function publishToGitHub(
  plan: PublishPlan,
  repo: string,
  pat: string,
  onProgress?: (done: number, total: number, label: string) => void,
): Promise<PublishResult> {
  const total = plan.milestones.length + plan.issues.length;
  let done = 0;
  const tick = (label: string) => onProgress?.(++done, total, label);

  const existing = await listMilestones(pat, repo);
  const byName = new Map<string, number>(existing.map((m) => [m.title, m.number]));
  let milestonesCreated = 0;
  for (const m of plan.milestones) {
    if (!byName.has(m.name)) {
      const created = await createMilestone(pat, repo, m.name, m.description);
      byName.set(m.name, created.number);
      milestonesCreated++;
    }
    tick(`milestone: ${m.name}`);
  }

  const issues: { title: string; url: string }[] = [];
  const failures: { title: string; error: string }[] = [];
  for (const it of plan.issues) {
    try {
      const created: GithubIssue = await createIssueWithMeta(pat, repo, {
        title: it.title,
        body: it.body,
        labels: it.labels,
        milestone: it.milestone ? byName.get(it.milestone) : undefined,
      });
      issues.push({ title: created.title, url: created.url });
    } catch (e) {
      failures.push({ title: it.title, error: (e as Error)?.message ?? String(e) });
    }
    tick(`issue: ${it.title}`);
  }
  return { milestonesCreated, issues, failures };
}
