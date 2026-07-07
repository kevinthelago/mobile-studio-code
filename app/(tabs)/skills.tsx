import React from 'react';
import { MirrorScaffold } from '../../src/components/shell/MirrorScaffold';

/**
 * Skills tab (#218 scaffold) — will mirror the desktop's Skills library
 * (global skills + task groups) read-only. Content lands with #221.
 */
export default function SkillsTab() {
  return (
    <MirrorScaffold
      domain="skills"
      title="Skills"
      subtitle="The skills library · read-only mirror"
      blurb="Skills mirrors the desktop's reusable skills library — the injectable context your agents run with."
    />
  );
}
