import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { GraphCanvas, type GraphCanvasHandle, type GraphSelection } from '../graph/GraphCanvas';
import { buildGlanceScene, type GraphScene } from '../../lib/graph';
import {
  selectComponents, groupByKit, hasComposition, compositionInput, type ComponentCardVM,
} from '../../lib/pages/designPage';

type View2 = 'graph' | 'kit';

/**
 * Components mirror (#221) — read-only view of the desktop's `components` domain. The payload ships
 * composition edges (`ComponentCard.composes`), so when any resolve we render a composition graph via
 * the #220 GraphCanvas (each component a node, each composes an edge); otherwise we group by kit. The
 * "By kit" list stays available as a segment. No editing.
 */
export function ComponentsMirror({ data }: { data: unknown }) {
  const t = useTheme();
  const model = useMemo(() => selectComponents(data), [data]);
  const composable = model ? hasComposition(model) : false;
  const [view, setView] = useState<View2>('graph');
  const effective: View2 = composable ? view : 'kit';

  if (!model) {
    return (
      <View style={styles.fallback}>
        <Text style={[styles.fallbackText, { color: t.fgMuted }]}>Couldn’t read the desktop’s Components projection.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {composable && (
        <View style={styles.segmentRow}>
          {(['graph', 'kit'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[styles.seg, { borderColor: t.borderColor }, effective === v && { backgroundColor: t.surface }]}
            >
              <Text style={[styles.segText, { color: effective === v ? t.fg : t.fgMuted }]}>
                {v === 'graph' ? 'Composition' : 'By kit'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {effective === 'graph' ? <CompositionGraph model={model} /> : <KitList model={model} />}
    </View>
  );
}

function CompositionGraph({ model }: { model: NonNullable<ReturnType<typeof selectComponents>> }) {
  const t = useTheme();
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const [selected, setSelected] = useState<GraphSelection | null>(null);
  const scene: GraphScene = useMemo(() => buildGlanceScene(compositionInput(model)), [model]);
  const byId = useMemo(() => new Map(model.components.map((c) => [c.id, c])), [model]);
  const comp = selected?.kind === 'node' ? byId.get(selected.id) : undefined;

  const colors = {
    card: t.surfaceSolid, cardStack: t.bg, border: t.borderColor,
    text: t.fg, muted: t.fgMuted, selection: t.accent,
  };

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={[styles.crumb, { color: t.fgMuted }]}>{model.components.length} components · composition</Text>
        <Pressable style={[styles.chip, { borderColor: t.borderColor }]} onPress={() => canvasRef.current?.fitToView()} hitSlop={6}>
          <Text style={[styles.chipText, { color: t.fg }]}>Fit</Text>
        </Pressable>
      </View>
      <GraphCanvas ref={canvasRef} scene={scene} selected={selected} onSelect={setSelected} colors={colors} style={styles.canvas} />
      {comp ? (
        <Surface style={styles.inspector} radius={12}>
          <Text style={[styles.inspTitle, { color: t.fg }]}>{comp.name}</Text>
          <Text style={[styles.inspSub, { color: t.fgMuted }]}>
            {comp.role}{comp.version ? ` · v${comp.version}` : ''} · used {comp.used}×
          </Text>
          {comp.composes.length ? (
            <Text style={[styles.inspSub, { color: t.fgDim }]} numberOfLines={2}>composes {comp.composes.join(', ')}</Text>
          ) : null}
        </Surface>
      ) : (
        <Text style={[styles.hint, { color: t.fgDim }]}>drag to pan · pinch to zoom · tap a component</Text>
      )}
    </View>
  );
}

function KitList({ model }: { model: NonNullable<ReturnType<typeof selectComponents>> }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const groups = useMemo(() => groupByKit(model), [model]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.listInner, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {groups.map((g) => (
        <Surface key={g.kit.id} style={styles.kitCard} radius={8}>
          <View style={styles.kitHead}>
            <View style={[styles.dot, { backgroundColor: g.kit.dot }]} />
            <Text style={[styles.kitName, { color: t.fg }]} numberOfLines={1}>{g.kit.name}</Text>
            {g.kit.builtin ? <Tag border={false} bg={t.surface}>built-in</Tag> : null}
            <Text style={[styles.kitCount, { color: t.fgDim }]}>{g.components.length}</Text>
          </View>
          {g.kit.stack ? <Text style={[styles.kitStack, { color: t.fgMuted }]}>{g.kit.stack}</Text> : null}
          {g.consumers.length ? (
            <Text style={[styles.kitStack, { color: t.fgDim }]}>
              {g.consumers.length} consumer{g.consumers.length === 1 ? '' : 's'}
              {g.consumers.some((c) => c.live) ? ' · live' : ''}
            </Text>
          ) : null}
          <View style={styles.compList}>
            {g.components.map((c: ComponentCardVM) => (
              <View key={c.id} style={styles.compRow}>
                <Text style={[styles.compName, { color: t.fg }]} numberOfLines={1}>{c.name}</Text>
                <Tag border={false} bg={t.surface}>{c.role}</Tag>
                {c.used ? <Text style={[styles.compUsed, { color: t.fgDim }]}>{c.used}×</Text> : null}
              </View>
            ))}
          </View>
        </Surface>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  segmentRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  segText: { fontSize: 12.5, fontWeight: '600' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  crumb: { flex: 1, fontSize: 11.5 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  canvas: { flex: 1 },
  inspector: { margin: 12, padding: 13, gap: 4 },
  inspTitle: { fontSize: 15, fontWeight: '700' },
  inspSub: { fontSize: 12 },
  hint: { fontSize: 11, textAlign: 'center', paddingVertical: 12 },
  listInner: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  kitCard: { padding: 12, gap: 7 },
  kitHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  kitName: { flex: 1, fontSize: 14, fontWeight: '700' },
  kitCount: { fontSize: 12 },
  kitStack: { fontSize: 11.5 },
  compList: { gap: 6, marginTop: 2 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compName: { flex: 1, fontSize: 13, fontWeight: '500' },
  compUsed: { fontSize: 11 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
