// KitRenderer (React Native) — the native port of base-studio-code's src/shared/ui/spec/KitRenderer.tsx
// @ ec59b972. Walks a `GeneralNode` tree and renders each node through the native registry, wiring
// `binds` (host state a control reads) and `actions` (host callbacks it fires by name). Logic is kept
// deliberately identical to the desktop renderer — the only differences are the imports (RN Text, the
// native `componentFor`) so the two stay legible side by side. Switching kit/theme is a change here,
// never a change to the spec.
//
// There is no per-node branch (like the web version): a node names a real primitive resolved from the
// manifest. An unresolvable/unimplemented `type` renders a VISIBLE marker, never null and never a
// throw — a blank in a data-driven UI is indistinguishable from "the data said render nothing".
import React, { Fragment, type ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import { UI_KIT } from '../../lib/kit/manifest';
import type { GeneralNode } from '../../lib/kit/generalNode';
import { componentFor } from './registry';

const SPEC_BY_NAME = new Map(UI_KIT.map((p) => [p.name as string, p]));

function isNodeLike(v: unknown): boolean {
  return (
    typeof v === 'object' && v !== null && !Array.isArray(v) &&
    typeof (v as Record<string, unknown>).type === 'string'
  );
}

/** Render a slot value: a list of nodes, a single node, or plain text (RN requires text inside Text). */
function renderSlot(value: unknown, ctx: KitBindings, key: string): ReactNode {
  if (Array.isArray(value)) {
    return value.map((v, i) =>
      isNodeLike(v) ? renderNode(v as GeneralNode, ctx, `${key}[${i}]`) : (v as ReactNode));
  }
  if (isNodeLike(value)) return renderNode(value as GeneralNode, ctx, key);
  return value as ReactNode;
}

function renderNode(node: GeneralNode, ctx: KitBindings, key: string): ReactNode {
  // `Slot` (#3504) is the one structural node the renderer resolves itself — a hole the host fills.
  if (node.type === 'Slot') {
    const name = String(node.props?.name ?? '');
    const filled = ctx.slots?.[name];
    if (filled !== undefined) return <Fragment key={key}>{filled}</Fragment>;
  }
  const Comp = componentFor(node.type);
  if (!Comp) {
    return (
      <RNText key={key} style={{ color: '#f87171', fontSize: 12 }}>
        {`[unimplemented primitive "${node.type}"]`}
      </RNText>
    );
  }
  const spec = SPEC_BY_NAME.get(node.type);
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(node.props ?? {})) {
    const declared = spec?.props.find((p) => p.name === name);
    if (declared?.type === 'function') {
      // A handler prop: the value is an action NAME bound to the host callback. Unknown → no-op.
      const action = typeof value === 'string' ? value : '';
      props[name] = (...args: unknown[]) => ctx.on?.[action]?.(...args);
      continue;
    }
    if (declared?.type === 'node') {
      props[name] = renderSlot(value, ctx, `${key}.${name}`);
      continue;
    }
    props[name] = value;
  }

  // binds (#3500): read host state into a prop — state in.
  for (const [propName, stateKey] of Object.entries(node.binds ?? {})) {
    props[propName] = ctx.values?.[stateKey];
  }
  // actions (#3496): applied after the declared-prop pass so it wins; the only way to wire a handler
  // on a passthrough primitive (Button.onClick). Arguments are forwarded (onChange carries the value).
  for (const [propName, actionName] of Object.entries(node.actions ?? {})) {
    props[propName] = (...args: unknown[]) => ctx.on?.[actionName]?.(...args);
  }

  const children =
    node.children !== undefined ? renderSlot(node.children, ctx, `${key}.children`) : props.children;
  delete props.children;
  const C = Comp as React.ComponentType<Record<string, unknown>>;
  return (
    <C key={key} {...props}>
      {children as ReactNode}
    </C>
  );
}

/** The host-supplied wiring a rendered spec binds to. */
export interface KitBindings {
  /** Current host state, keyed by a node's `binds` values. */
  values?: Record<string, unknown>;
  /** Host React keyed by a `Slot` node's `name` — the seam for parts a spec cannot express. */
  slots?: Record<string, ReactNode>;
  /** Host callbacks keyed by an action name (a node's `actions`, or a `function` prop's value). */
  on?: Record<string, (...args: unknown[]) => void>;
}

export interface KitRendererProps extends KitBindings {
  /** The spec tree to render (validate with validateGeneralNode before rendering untrusted data). */
  node: GeneralNode;
}

/** Render a node tree. `values`/`on`/`slots` wire the spec's `binds`/`actions`/`Slot`s to the host. */
export function KitRenderer({ node, values, on, slots }: KitRendererProps) {
  return <>{renderNode(node, { values, on, slots }, '$')}</>;
}
