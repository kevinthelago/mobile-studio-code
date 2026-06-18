// The local planner AI driver. v1 is non-streaming: one Claude call per turn over
// the existing fetch client (src/lib/anthropic.ts), then the tag parsers run on the
// full reply (see apply.ts). Streaming (SSE) is a later enhancement.

import { anthropicChat, ANTHROPIC_MODEL } from '../anthropic';
import type { ChatMessage } from '../types';
import { buildPlannerSystemPrompt } from './prompt';
import type { PlanProject } from './project';

/**
 * Ask Claude for the next planner turn. `project` must already include the latest
 * user message (use appendUserMessage first). Returns the assistant's RAW text
 * (tags intact); the caller applies it via applyAssistantReply.
 */
export async function plannerReply(
  project: PlanProject,
  apiKey: string,
  _model: string = ANTHROPIC_MODEL,
): Promise<string> {
  const system = buildPlannerSystemPrompt(project);
  const messages: ChatMessage[] = project.messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));
  // TODO: pass model when anthropicChat supports a model override parameter
  const res = await anthropicChat(apiKey, messages, [], system);
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text?: string }).text ?? '')
    .join('')
    .trim();
}
