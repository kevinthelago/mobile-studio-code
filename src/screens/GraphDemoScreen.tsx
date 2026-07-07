// GraphDemoScreen (#220) — the demo surface for the read-only graph stack: both model adapters
// (glance project network / org relationship graph) over sample data, with pan / pinch-zoom /
// tap-select / drill. NOT wired into the tab bar — the shell issue mounts it (it just needs to sit
// under the expo-router navigator for useDrillBack's beforeRemove wiring).
//
// Drill demo: glance L0 project → its fleet subgraph; org pool (stacked card) → its members.
// Hardware back / swipe-back pop the drill before leaving the screen (useDrillBack).
// Inspectors are display-only (#220: no editing; a live agent node opening chat lands with the
// mirror issue — here the inspector only reports what was selected).
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GraphCanvas, type GraphCanvasHandle, type GraphSelection } from '../components/graph/GraphCanvas';
import { useDrillBack } from '../components/graph/useDrillBack';
import {
  EMPTY_DRILL,
  canDrillPop,
  drillPop,
  drillPush,
  drillTop,
  type DrillStack,
} from '../lib/graph/drillStack';
import { buildFleetScene, buildGlanceScene } from '../lib/graph/glanceAdapter';
import { buildOrgScene, buildPoolScene } from '../lib/graph/orgAdapter';
import { SAMPLE_GLANCE, SAMPLE_ORG } from '../lib/graph/sampleData';
import type { GraphScene } from '../lib/graph/scene';

type Mode = 'glance' | 'org';

const C = {
  bg: '#0b0e14',
  panel: '#131826',
  border: '#242c3d',
  text: '#e8ecf4',
  muted: '#8b94a7',
  accent: '#7aa2ff',
};

export function GraphDemoScreen(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('glance');
  const [drill, setDrill] = useState<DrillStack>(EMPTY_DRILL);
  const [selected, setSelected] = useState<GraphSelection | null>(null);
  const canvasRef = useRef<GraphCanvasHandle>(null);

  const top = drillTop(drill);
  const scene: GraphScene = useMemo(() => {
    if (mode === 'glance') {
      return top?.domain === 'glance'
        ? buildFleetScene(SAMPLE_GLANCE, top.id)
        : buildGlanceScene(SAMPLE_GLANCE);
    }
    return top?.domain === 'org' ? buildPoolScene(SAMPLE_ORG, top.id) : buildOrgScene(SAMPLE_ORG);
  }, [mode, top]);

  const selectedNode = selected?.kind === 'node' ? scene.nodes.find((n) => n.id === selected.id) : undefined;
  const selectedEdge = selected?.kind === 'edge' ? scene.edges.find((e) => e.id === selected.id) : undefined;

  const popDrill = (): void => {
    setDrill((s) => drillPop(s));
    setSelected(null);
  };
  useDrillBack(canDrillPop(drill), popDrill);

  const switchMode = (m: Mode): void => {
    setMode(m);
    setDrill(EMPTY_DRILL);
    setSelected(null);
  };

  const drillIn = (): void => {
    if (!selectedNode?.drillId) return;
    setDrill((s) => drillPush(s, { domain: mode, id: selectedNode.drillId!, label: selectedNode.title }));
    setSelected(null);
  };

  const breadcrumb = ['root', ...drill.map((f) => f.label ?? f.id)].join(' › ');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.segmented}>
          {(['glance', 'org'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={[styles.segment, mode === m && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                {m === 'glance' ? 'Glance' : 'Org'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.btn} onPress={() => canvasRef.current?.fitToView()}>
          <Text style={styles.btnText}>Fit</Text>
        </Pressable>
        {canDrillPop(drill) ? (
          <Pressable style={styles.btn} onPress={popDrill}>
            <Text style={styles.btnText}>‹ Back</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.breadcrumb} numberOfLines={1}>
        {breadcrumb}
      </Text>

      <GraphCanvas
        ref={canvasRef}
        scene={scene}
        selected={selected}
        onSelect={setSelected}
        style={styles.canvas}
      />

      {selectedNode || selectedEdge ? (
        <View style={styles.inspector}>
          {selectedNode ? (
            <>
              <Text style={styles.inspectorTitle}>{selectedNode.title}</Text>
              {selectedNode.subtitle ? <Text style={styles.inspectorSub}>{selectedNode.subtitle}</Text> : null}
              {selectedNode.stackCount ? (
                <Text style={styles.inspectorSub}>
                  pool · {selectedNode.stackCount} members{selectedNode.homogeneous === false ? ' · mixed wiring' : ''}
                </Text>
              ) : null}
              {selectedNode.drillId ? (
                <Pressable style={[styles.btn, styles.drillBtn]} onPress={drillIn}>
                  <Text style={styles.btnText}>Drill in ›</Text>
                </Pressable>
              ) : null}
            </>
          ) : selectedEdge ? (
            <>
              <Text style={styles.inspectorTitle}>{selectedEdge.label ?? 'edge'}</Text>
              <Text style={styles.inspectorSub}>
                {selectedEdge.from} → {selectedEdge.to}
                {selectedEdge.isCycle ? ' · mutual dependency (cycle)' : ''}
              </Text>
            </>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>drag to pan · pinch to zoom · tap to select · double-tap to fit</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: C.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 2,
    marginRight: 'auto',
  },
  segment: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  segmentActive: { backgroundColor: C.border },
  segmentText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: C.text },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.panel,
  },
  btnText: { color: C.text, fontSize: 13, fontWeight: '600' },
  breadcrumb: { color: C.muted, fontSize: 11, paddingHorizontal: 14, paddingVertical: 6 },
  canvas: { flex: 1, backgroundColor: C.bg },
  inspector: {
    margin: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.panel,
    gap: 4,
  },
  inspectorTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  inspectorSub: { color: C.muted, fontSize: 12 },
  drillBtn: { alignSelf: 'flex-start', marginTop: 6, borderColor: C.accent },
  hint: { color: C.muted, fontSize: 11, textAlign: 'center', paddingVertical: 10 },
});

export default GraphDemoScreen;
