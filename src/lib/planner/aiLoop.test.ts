import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBlueprints } from './core';
import { createPlanProject } from './project';
import { parsePlanUpdates, parsePlanFocus, stripAllPlannerTags } from './planTag';
import { deriveStageFromProject } from './derive';
import { appendUserMessage, applyAssistantReply } from './apply';

function project() {
  return createPlanProject(
    makeBlueprints().find((b) => b.id === 'default')!,
    { id: 'p', title: 'T', now: 0 },
  );
}

// ── tag parsing ───────────────────────────────────────────────────────────────

test('parsePlanUpdates: captures section + trimmed content, skips section-less', () => {
  const text = 'Great.\n<plan_update section="goal">\n# Goal\nShip an MVP.\n</plan_update>\n'
    + '<plan_update>orphan</plan_update> done';
  const ups = parsePlanUpdates(text);
  assert.equal(ups.length, 1);
  assert.deepEqual(ups[0], { section: 'goal', content: '# Goal\nShip an MVP.' });
});

test('parsePlanFocus + smart quotes', () => {
  assert.deepEqual(parsePlanFocus('<plan_focus section="scope" /> <plan_focus section=“stack” />'), ['scope', 'stack']);
});

test('stripAllPlannerTags removes every planner tag and tidies whitespace', () => {
  const text = 'Here.\n<plan_update section="goal">x</plan_update>\n<plan_focus section="goal" />\n'
    + '<pipeline id="lint-plan" cmd="run" />\n<ui_preview screen="Home" />\nNext?';
  const out = stripAllPlannerTags(text);
  assert.ok(!/<plan_update|<plan_focus|<pipeline|<ui_preview/.test(out));
  assert.ok(out.startsWith('Here.'));
  assert.ok(out.endsWith('Next?'));
});

// ── derive ────────────────────────────────────────────────────────────────────

test('deriveStageFromProject: context topics + core confirmation', () => {
  const p = project();
  p.sections.goal = { state: 'confirmed', content: 'g' };
  p.sections.scope = { state: 'confirmed', content: 's' };
  p.sections.stack = { state: 'drafted', content: 'st' };       // surfaced, not confirmed
  const st = deriveStageFromProject(p);
  assert.equal(st.context.total, 3);
  assert.equal(st.context.resolved, 2);
  assert.equal(st.context.coreConfirmed, false);                 // stack surfaced but unconfirmed
});

test('deriveStageFromProject: structure + fleet from JSON artifacts', () => {
  const p = project();
  p.sections['phases.json'] = { state: 'confirmed', content: '[{"name":"MVP"}]' };
  p.sections['issues.json'] = { state: 'confirmed', content: '[{"title":"a"},{"title":"b"}]' };
  p.sections['fleet.json'] = { state: 'confirmed', content: '[{"name":"x","profile":{}}]' };
  const st = deriveStageFromProject(p);
  assert.equal(st.phasesConfirmed, true);
  assert.equal(st.issueCount, 2);
  assert.equal(st.fleet.streams, 1);
  assert.equal(st.fleet.profilesComplete, true);
});

// ── apply: tags → live project state ──────────────────────────────────────────

test('appendUserMessage adds a user turn', () => {
  const p = appendUserMessage(project(), 'hi');
  assert.deepEqual(p.messages, [{ role: 'user', text: 'hi' }]);
});

test('applyAssistantReply writes sections, mirrors artifacts, recomputes signals, appends turn', () => {
  const reply = "Let's lock the goal.\n"
    + '<plan_update section="goal"># Goal\nShip it.</plan_update>\n'
    + '<plan_update section="issues.json">[{"title":"a"}]</plan_update>\n'
    + '<plan_focus section="scope" />';
  const { project: next, focus } = applyAssistantReply(project(), reply);

  // sections written + confirmed
  assert.equal(next.sections.goal.state, 'confirmed');
  assert.equal(next.sections.goal.content, '# Goal\nShip it.');
  // file-like keys mirrored into artifacts for transfer
  assert.equal(next.artifacts['issues.json'], '[{"title":"a"}]');
  // signals recomputed from the new sections
  assert.equal(next.stage.context.total, 1);
  assert.equal(next.stage.issueCount, 1);
  // focus + raw assistant turn appended (raw text keeps the tags)
  assert.equal(focus, 'scope');
  assert.equal(next.messages.at(-1)?.role, 'assistant');
  assert.ok(next.messages.at(-1)!.text.includes('<plan_update'));
});
