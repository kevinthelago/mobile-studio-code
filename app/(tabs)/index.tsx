import React from 'react';
import { MirrorScaffold } from '../../src/components/shell/MirrorScaffold';
import { openSessionsRoster } from '../../src/lib/sessions/nav';

/**
 * Glance tab (#218 scaffold) — will mirror the desktop's Glance graph
 * (fleet + project drill-down, L0→L1) read-only. Content lands with #220.
 * The header's "Sessions" pill opens the session roster (#219); once the
 * graph gains real data, tapping a live agent node will openSessionChat
 * for that agent directly.
 */
export default function GlanceTab() {
  return (
    <MirrorScaffold
      domain="glance"
      title="Glance"
      subtitle="Your fleet at a glance · read-only mirror"
      blurb="Glance mirrors the desktop's live fleet graph — projects, agents, and their status."
      headerAction={{ label: 'Sessions', onPress: openSessionsRoster }}
    />
  );
}
