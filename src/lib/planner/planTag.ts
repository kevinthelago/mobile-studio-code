// Parsers for the planner's content tags: <plan_update section="key">…md…</plan_update>
// and <plan_focus section="key" />. Authored on mobile in the same quote-flexible
// style as the ported pipeline/ui_preview parsers.
//
// NOTE (sync): these two parsers were NOT part of the shared pure modules handed
// over (only pipelineTag/uiPreviewTag were). They should be reconciled with the
// desktop's plan-tag parser when it's shared, and folded into plannerCore.fixtures.json.

import { stripPipelineTags, stripUiPreviewTags } from './core';

const Q = '["“”]';
const UPDATE = `<plan_update\\b([^>]*)>([\\s\\S]*?)<\\/plan_update>`;
const FOCUS = `<plan_focus\\b([^>]*?)\\/>`;
// Self-closing single-line tags we recognise but only need to strip from display.
const AUTOMATION = `<automation_assign\\b[^>]*?\\/>`;
const STARTUP = `<startup_script\\b[^>]*?\\/>`;

export interface PlanUpdate { section: string; content: string }

function attr(name: string, attrs: string): string | undefined {
  const m = new RegExp(`${name}=${Q}([^"“”]*)${Q}`).exec(attrs);
  return m ? m[1] : undefined;
}

/** Every <plan_update section="…">…</plan_update>, in stream order. Tags without a
 *  section are skipped; content is trimmed. */
export function parsePlanUpdates(text: string): PlanUpdate[] {
  const re = new RegExp(UPDATE, 'g');
  const out: PlanUpdate[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const section = attr('section', m[1]);
    if (!section) continue;
    out.push({ section: section.trim(), content: m[2].trim() });
  }
  return out;
}

/** Section keys referenced by <plan_focus section="…" />, in order. */
export function parsePlanFocus(text: string): string[] {
  const re = new RegExp(FOCUS, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const section = attr('section', m[1]);
    if (section) out.push(section.trim());
  }
  return out;
}

/** Strip ALL planner tags (plan_update/plan_focus/pipeline/ui_preview/automation/
 *  startup) for display, and collapse the whitespace they leave behind. */
export function stripAllPlannerTags(text: string): string {
  let out = text
    .replace(new RegExp(UPDATE, 'g'), '')
    .replace(new RegExp(FOCUS, 'g'), '')
    .replace(new RegExp(AUTOMATION, 'g'), '')
    .replace(new RegExp(STARTUP, 'g'), '');
  out = stripPipelineTags(out);
  out = stripUiPreviewTags(out);
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
