import React from 'react';
import { MirrorScaffold } from '../../src/components/shell/MirrorScaffold';

/**
 * UI (Design) tab (#218 scaffold) — will mirror the desktop's Design Studio:
 * page specs, component kit, and previews, read-only. Content lands with its
 * content issue (#221 line).
 */
export default function UiTab() {
  return (
    <MirrorScaffold
      domain="design"
      title="UI"
      subtitle="Design Studio · read-only mirror"
      blurb="UI mirrors the desktop's Design Studio — pages, components, and the kit."
    />
  );
}
