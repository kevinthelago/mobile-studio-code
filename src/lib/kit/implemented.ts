// The primitive names the native kit can draw — a PLAIN data list (no React Native import) so node
// tests can check spec coverage without loading the RN/registry module. Split into the primitives the
// registry maps to a component, and the ones the KitRenderer resolves itself (Slot). registry.tsx
// builds its component map against REGISTRY_PRIMITIVES and asserts they match at load, so this stays
// the single source of truth. IMPLEMENTED_PRIMITIVES is everything a spec may name and have rendered.

/** Primitives the RN registry maps to a native component. */
export const REGISTRY_PRIMITIVES = [
  'Box', 'Stack', 'Row', 'Spacer', 'Text', 'Card', 'Chip', 'StatTile', 'Button',
  'EmptyState', 'StatusDot', 'Banner', 'SectionHeader', 'CardListRow',
  'Toggle', 'TextField', 'SegmentedControl', 'SectionLabel',
] as const;

/** Primitives the renderer resolves itself, with no registry entry (host-filled holes). */
export const RENDERER_NATIVE = ['Slot'] as const;

/** Every primitive a spec may use and have the native kit draw. */
export const IMPLEMENTED_PRIMITIVES = [...REGISTRY_PRIMITIVES, ...RENDERER_NATIVE] as const;
