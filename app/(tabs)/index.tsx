import React from 'react';
import { MirrorScaffold } from '../../src/components/shell/MirrorScaffold';

/**
 * Glance tab (#218 scaffold) — will mirror the desktop's Glance graph
 * (fleet + project drill-down, L0→L1) read-only. Content lands with #220.
 */
export default function GlanceTab() {
  return (
    <MirrorScaffold
      domain="glance"
      title="Glance"
      subtitle="Your fleet at a glance · read-only mirror"
      blurb="Glance mirrors the desktop's live fleet graph — projects, agents, and their status."
    />
  );
}
