import React from 'react';
import { MirrorScaffold } from '../../src/components/shell/MirrorScaffold';
import { GlanceMirror } from '../../src/components/glance/GlanceMirror';
import { openSessionsRoster } from '../../src/lib/sessions/nav';

/**
 * Glance tab (#221) — mirrors the desktop's Glance graph read-only: the project network (L0) and,
 * drilling a project, its fleet subgraph (L1), fed by the `glance` store domain. A node tap opens a
 * display-only inspector; a node that maps to a live desktop pane offers "Open chat". The header's
 * "Sessions" pill opens the session roster (#219). MirrorScaffold keeps the awaiting/empty state
 * until the desktop pushes its glance projection.
 */
export default function GlanceTab() {
  return (
    <MirrorScaffold
      domain="glance"
      title="Glance"
      subtitle="Your fleet at a glance · read-only mirror"
      blurb="Glance mirrors the desktop's live fleet graph — projects, agents, and their status."
      headerAction={{ label: 'Sessions', onPress: openSessionsRoster }}
    >
      {(data) => <GlanceMirror data={data} />}
    </MirrorScaffold>
  );
}
