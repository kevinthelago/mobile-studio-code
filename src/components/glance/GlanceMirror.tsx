import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { useTunnel } from '../../lib/TunnelContext';
import { openSessionChat } from '../../lib/sessions/nav';
import { GraphCanvas, type GraphCanvasHandle, type GraphSelection } from '../graph/GraphCanvas';
import { useDrillBack } from '../graph/useDrillBack';
import {
  EMPTY_DRILL, canDrillPop, drillPop, drillPush, drillTop, buildGlanceScene, buildFleetScene,
  ACTIVITY_META, CATEGORY_COLOR, HEALTH_META,
  type DrillStack, type GraphScene,
} from '../../lib/graph';
import { selectGlance, glanceL0Input, agentPaneId } from '../../lib/pages/glancePage';
import { Surface } from '../ui/Surface';

/**
 * Glance mirror (#221) — the read-only project network + fleet drill, fed by the mirrored `glance`
 * store domain. L0 is the project graph; drilling a project (the one the desktop has drilled, the only
 * fleet the payload ships) opens its fleet subgraph. A node tap opens a display-only inspector; a node
 * that maps to a LIVE desktop pane (`<project>:<stream>`) offers "Open chat". Back-gesture pops the
 * drill (useDrillBack). No editing affordances.
 */
export function GlanceMirror({ data }: { data: unknown }) {
  const t = useTheme();
  const { panes } = useTunnel();
  const model = useMemo(() => selectGlance(data), [data]);
  const input = useMemo(() => (model ? glanceL0Input(model) : null), [model]);

  const [drill, setDrill] = useState<DrillStack>(EMPTY_DRILL);
  const [selected, setSelected] = useState<GraphSelection | null>(null);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const top = drillTop(drill);

  const scene: GraphScene = useMemo(() => {
    if (!input) return { nodes: [], edges: [], worldW: 0, worldH: 0 };
    return top ? buildFleetScene(input, top.id) : buildGlanceScene(input);
  }, [input, top]);

  const popDrill = (): void => { setDrill((s) => drillPop(s)); setSelected(null); };
  useDrillBack(canDrillPop(drill), popDrill);

  const selectedNode = selected?.kind === 'node' ? scene.nodes.find((n) => n.id === selected.id) : undefined;
  // The inspector reads the PROJECT, not the laid-out card: the scene flattens both axes into one
  // subtitle, and the whole point of #238 is that health and activity are separate signals.
  const selectedProject = !top && selectedNode
    ? input?.projects.find((p) => p.id === selectedNode.id)
    : undefined;

  const drillIn = (): void => {
    if (!selectedNode?.drillId) return;
    setDrill((s) => drillPush(s, { domain: 'glance', id: selectedNode.drillId!, label: selectedNode.title }));
    setSelected(null);
  };

  // Live-agent chat: at L1 a fleet node is `<project>:<stream>`; at L0 the node id is tried directly.
  const livePaneId = selectedNode
    ? (top ? agentPaneId(top.id, selectedNode.id) : selectedNode.id)
    : null;
  const liveAgent = livePaneId ? !!panes[livePaneId] : false;

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

      <GraphCanvas ref={canvasRef} scene={scene} selected={selected} onSelect={setSelected} colors={canvasColors} style={styles.canvas} />

      {selectedNode ? (
        <Surface style={styles.inspector} radius={12}>
          <Text style={[styles.inspTitle, { color: t.fg }]}>{selectedNode.title}</Text>
          {selectedProject ? (
            <View style={styles.inspRows}>
              <InspectorRow
                label="health"
                value={HEALTH_META[selectedProject.health].label}
                color={HEALTH_META[selectedProject.health].color}
                note={selectedNode.statusMuted ? 'inherited from a dependency' : undefined}
              />
              <InspectorRow
                label="activity"
                value={ACTIVITY_META[selectedProject.activity].label}
              />
              {selectedProject.category ? (
                <InspectorRow
                  label="category"
                  value={selectedProject.category}
                  color={CATEGORY_COLOR[selectedProject.category]}
                />
              ) : null}
              {selectedProject.reason ? <InspectorRow label="reason" value={selectedProject.reason} /> : null}
              {selectedProject.faults ? (
                <InspectorRow label="faults" value={String(selectedProject.faults)} />
              ) : null}
            </View>
          ) : selectedNode.subtitle ? (
            <Text style={[styles.inspSub, { color: t.fgMuted }]}>{selectedNode.subtitle}</Text>
          ) : null}
          <View style={styles.inspActions}>
            {selectedNode.drillId ? (
              <Pressable style={[styles.action, { borderColor: t.accent }]} onPress={drillIn}>
                <Text style={[styles.actionText, { color: t.accent }]}>Drill in ›</Text>
              </Pressable>
            ) : null}
            {liveAgent && livePaneId ? (
              <Pressable style={[styles.action, { borderColor: t.accent }]} onPress={() => openSessionChat(livePaneId)}>
                <Text style={[styles.actionText, { color: t.accent }]}>Open chat</Text>
              </Pressable>
            ) : null}
          </View>
        </Surface>
      ) : (
        <Text style={[styles.hint, { color: t.fgDim }]}>drag to pan · pinch to zoom · tap a node</Text>
      )}
    </View>
  );
}

/**
 * What the dot colours mean (desktop `GlanceCanvas.tsx:380-384`). Health is the only
 * colour-bearing axis, so this one strip explains the whole palette — mobile had no legend at all,
 * which made a red dot unreadable without prior desktop knowledge.
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

function InspectorRow({
  label, value, color, note,
}: { label: string; value: string; color?: string; note?: string }) {
  const t = useTheme();
  return (
    <View style={styles.inspRow}>
      <Text style={[styles.inspLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>{label}</Text>
      {color ? <View style={[styles.legendDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.inspValue, { color: t.fg }]} numberOfLines={2}>
        {value}
        {note ? <Text style={{ color: t.fgDim }}>{`  ${note}`}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 14, paddingBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10 },
  inspRows: { gap: 3, marginTop: 2 },
  inspRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  inspLabel: { fontSize: 10, width: 58, letterSpacing: 0.4, textTransform: 'uppercase' },
  inspValue: { flex: 1, fontSize: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  crumb: { flex: 1, fontSize: 11.5 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  canvas: { flex: 1 },
  inspector: { margin: 12, padding: 13, gap: 4 },
  inspTitle: { fontSize: 15, fontWeight: '700' },
  inspSub: { fontSize: 12 },
  inspActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  actionText: { fontSize: 12.5, fontWeight: '600' },
  hint: { fontSize: 11, textAlign: 'center', paddingVertical: 12 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
