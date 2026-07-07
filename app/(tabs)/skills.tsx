import React from 'react';
import { MirrorScaffold } from '../../src/components/shell/MirrorScaffold';
import { SkillsLibrary } from '../../src/components/skills/SkillsLibrary';

/**
 * Skills tab (#221) — mirrors the desktop's Skills library read-only: skill cards (name/kind/scope,
 * pinned + enabled), task groups, and the active project's pending lessons, fed by the `skills` store
 * domain. MirrorScaffold keeps the awaiting/empty state until the desktop pushes its projection.
 */
export default function SkillsTab() {
  return (
    <MirrorScaffold
      domain="skills"
      title="Skills"
      subtitle="The skills library · read-only mirror"
      blurb="Skills mirrors the desktop's reusable skills library — the injectable context your agents run with."
    >
      {(data) => <SkillsLibrary data={data} />}
    </MirrorScaffold>
  );
}
