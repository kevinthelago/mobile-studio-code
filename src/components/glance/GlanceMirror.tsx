import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { openSessionChat } from '../../lib/sessions/nav';
import { GraphCanvas, type GraphCanvasHandle, type GraphSelection } from '../graph/GraphCanvas';
import { useDrillBack } from '../graph/useDrillBack';
import {
  EMPTY_DRILL, canDrillPop, drillPop, drillPush, drillTop, buildGlanceScene, buildFleetScene,
  HEALTH_META,
  type DrillStack, type GraphScene,
} from '../../lib/graph';
import { selectGlance, glanceL0Input, agentPaneId } from '../../lib/pages/glancePage';

/**
 * Glance mirror (#221) — the read-only project network + fleet drill, fed by the mirrored `glance`
 * store domain. L0 is the project graph; drilling a project opens its fleet subgraph. Tap-to-act: a
 * project node with a fleet drills in on press; at L1 a node that maps to a live desktop pane
 * (`<project>:<stream>`) opens its chat on press. No details panel. Back-gesture pops the drill.
 */
export function GlanceMirror({ data }: { data: unknown }) {
  const t = useTheme();
  const { panes } = useTunnel();
  const model = useMemo(() => selectGlance(data), [data]);
  const input = useMemo(() => (model ? glanceL0Input(model) : null), [model]);

  const [drill, setDrill] = useState<DrillStack>(EMPTY_DRILL);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const top = drillTop(drill);

  const scene: GraphScene = useMemo(() => {
    if (!input) return { nodes: [], edges: [], worldW: 0, worldH: 0 };
    return top ? buildFleetScene(input, top.id) : buildGlanceScene(input);
  }, [input, top]);

  const popDrill = (): void => { setDrill((s) => drillPop(s)); };
  useDrillBack(canDrillPop(drill), popDrill);

  // Tap acts: a project with a fleet drills in; a live agent opens its chat. Non-actionable nodes
  // (a project with no fleet, a director hub with no pane) do nothing — there is no details panel.
  const handleSelect = useCallback((sel: GraphSelection | null): void => {
    if (!sel || sel.kind !== 'node') return;
    const node = scene.nodes.find((n) => n.id === sel.id);
    if (!node) return;
    if (!top && node.drillId) {
      setDrill((s) => drillPush(s, { domain: 'glance', id: node.drillId!, label: node.title }));
      return;
    }
    const paneId = top ? agentPaneId(top.id, node.id) : node.id;
    if (panes[paneId]) openSessionChat(paneId);
  }, [scene, top, panes]);

  const canvasColors = {
    card: t.surfaceSolid, cardStack: t.bg, border: t.borderColor,
    text: t.fg, muted: t.fgMuted, selection: t.accent,
  };

  if (!model) {
    return (
      <View style={styles.fallback}>
        <Text style={[styles.fallbackText, { color: t.fgMuted }]}>
          Couldn’t read the desktop’s Glance projection.
        </Text>
      </View>
    );
  }

  if (input && input.projects.length === 0) {
    return (
      <View style={styles.fallback}>
        <Text style={[styles.fallbackText, { color: t.fgMuted }]}>No projects yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={[styles.crumb, { color: t.fgMuted }]} numberOfLines={1}>
          {['Projects', ...drill.map((f) => f.label ?? f.id)].join('  ›  ')}
        </Text>
        {canDrillPop(drill) ? (
          <Pressable style={[styles.chip, { borderColor: t.borderColor }]} onPress={popDrill} hitSlop={6}>
            <Text style={[styles.chipText, { color: t.accent }]}>‹ Back</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.chip, { borderColor: t.borderColor }]} onPress={() => canvasRef.current?.fitToView()} hitSlop={6}>
          <Text style={[styles.chipText, { color: t.fg }]}>Fit</Text>
        </Pressable>
      </View>

      {top ? null : <HealthLegend />}

      <GraphCanvas ref={canvasRef} scene={scene} selected={null} onSelect={handleSelect} colors={canvasColors} style={styles.canvas} />

      <Text style={[styles.hint, { color: t.fgDim }]}>
        {top ? 'tap an agent to open its chat · swipe back to the network' : 'tap a project to drill into its agents · drag to pan · pinch to zoom'}
      </Text>
    </View>
  );
}

/**
 * What the dot colours mean (desktop `GlanceCanvas.tsx:380-384`). Health is the only
 * colour-bearing axis, so this one strip explains the whole palette.
 */
function HealthLegend() {
  const t = useTheme();
  return (
    <View style={styles.legend}>
      {(['healthy', 'idle', 'warning', 'error', 'off'] as const).map((h) => (
        <View key={h} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: HEALTH_META[h].color }]} />
          <Text style={[styles.legendText, { color: t.fgDim }]}>{HEALTH_META[h].label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 14, paddingBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  crumb: { flex: 1, fontSize: 11.5 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  canvas: { flex: 1 },
  hint: { fontSize: 11, textAlign: 'center', paddingVertical: 12 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
