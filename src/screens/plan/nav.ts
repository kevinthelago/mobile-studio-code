// In-tab navigation contract for the Plan surface. The Plan tab is a single
// Expo Router route (app/(tabs)/plan.tsx) that hosts five sub-screens; rather
// than nest a navigator we drive them from a small local state machine in
// PlanRoot and pass these callbacks down. Pairing is not part of the stack — it
// renders whenever the tunnel is not connected (see PlanRoot).

export const TAB_BAR_HEIGHT = 60;

export type PlanView =
  | { name: 'projects' }
  | { name: 'board'; projectId: string }
  | { name: 'issue'; projectId: string; issueN: number }
  | { name: 'scoping'; projectId: string };

export interface PlanNav {
  toProjects: () => void;
  toBoard: (projectId: string) => void;
  toIssue: (projectId: string, issueN: number) => void;
  toScoping: (projectId: string) => void;
  back: () => void;
}
