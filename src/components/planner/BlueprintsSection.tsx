import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { GraphCanvas, type GraphCanvasHandle, type GraphSelection } from '../graph/GraphCanvas';
import { buildOrgScene, type GraphScene } from '../../lib/graph';
import {
  selectBlueprints, selectOrgPersonas, blueprintTeamToOrgInput,
} from '../../lib/pages/blueprintsPage';

type View2 = 'library' | 'team';

/**
 * Blueprints + Team mirror (#221) — read-only view of the `blueprints` store domain: the library
 * cards (hasTeam / uiKit badges) and the ACTIVE blueprint's team graph, rendered via the #220 org
 * adapter (pools collapse using persona refs from the mirrored `org` domain when present). No editing.
 */
export function BlueprintsSection({ data, orgData }: { data: unknown; orgData: unknown }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const model = useMemo(() => selectBlueprints(data), [data]);
  const personas = useMemo(() => selectOrgPersonas(orgData), [orgData]);
  const orgInput = useMemo(
    () => (model?.activeTeam ? blueprintTeamToOrgInput(model.activeTeam, personas) : null),
    [model, personas],
  );
  const [view, setView] = useState<View2>('library');
  const hasTeam = !!model?.activeTeam;
  const effective: View2 = hasTeam ? view : 'library';

  if (!model) {
    return (
      <View style={styles.fallback}>
        <Text style={[styles.fallbackText, { color: t.fgMuted }]}>No blueprints mirrored from the desktop yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {hasTeam && (
        <View style={styles.segmentRow}>
          {(['library', 'team'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[styles.seg, { borderColor: t.borderColor }, effective === v && { backgroundColor: t.surface }]}
            >
              <Text style={[styles.segText, { color: effective === v ? t.fg : t.fgMuted }]}>
                {v === 'library' ? 'Library' : 'Active team'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {effective === 'team' && orgInput ? (
        <TeamGraph input={orgInput} />
      ) : (
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.listInner, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {model.library.map((b) => {
            const active = b.id === model.active;
            return (
              <Surface key={b.id} style={[styles.card, active && { borderColor: t.accent, borderWidth: 1 }]} radius={8}>
                <View style={styles.cardTop}>
                  {b.icon ? <Text style={styles.icon}>{b.icon}</Text> : null}
                  <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{b.name}</Text>
                  {active ? <Tag color={t.accent} bg={`${t.accent}22`} border={false}>Active</Tag> : null}
                </View>
                {b.desc ? <Text style={[styles.desc, { color: t.fgMuted }]} numberOfLines={2}>{b.desc}</Text> : null}
                <View style={styles.badges}>
                  {b.category ? <Tag border={false} bg={t.surface}>{b.category}</Tag> : null}
                  <Tag border={false} bg={t.surface}>{b.stageCount} stage{b.stageCount === 1 ? '' : 's'}</Tag>
                  {b.hasTeam ? <Tag border={false} bg={t.surface}>team</Tag> : null}
                  {b.uiKit ? <Tag border={false} bg={t.surface}>kit {b.uiKit.id}</Tag> : null}
                  {typeof b.uses === 'number' ? <Text style={[styles.uses, { color: t.fgDim }]}>{b.uses} use{b.uses === 1 ? '' : 's'}</Text> : null}
                </View>
              </Surface>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function TeamGraph({ input }: { input: ReturnType<typeof blueprintTeamToOrgInput> }) {
  const t = useTheme();
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const [selected, setSelected] = useState<GraphSelection | null>(null);
  const scene: GraphScene = useMemo(() => buildOrgScene(input), [input]);
  const node = selected?.kind === 'node' ? scene.nodes.find((n) => n.id === selected.id) : undefined;

  const colors = {
    card: t.surfaceSolid, cardStack: t.bg, border: t.borderColor,
    text: t.fg, muted: t.fgMuted, selection: t.accent,
  };

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={[styles.crumb, { color: t.fgMuted }]}>Active blueprint team</Text>
        <Pressable style={[styles.chip, { borderColor: t.borderColor }]} onPress={() => canvasRef.current?.fitToView()} hitSlop={6}>
          <Text style={[styles.chipText, { color: t.fg }]}>Fit</Text>
        </Pressable>
      </View>
      <GraphCanvas ref={canvasRef} scene={scene} selected={selected} onSelect={setSelected} colors={colors} style={styles.canvas} />
      {node ? (
        <Surface style={styles.inspector} radius={12}>
          <Text style={[styles.inspTitle, { color: t.fg }]}>{node.title}</Text>
          {node.subtitle ? <Text style={[styles.inspSub, { color: t.fgMuted }]}>{node.subtitle}</Text> : null}
          {node.stackCount ? (
            <Text style={[styles.inspSub, { color: t.fgDim }]}>
              pool · {node.stackCount} members{node.homogeneous === false ? ' · mixed wiring' : ''}
            </Text>
          ) : null}
        </Surface>
      ) : (
        <Text style={[styles.hint, { color: t.fgDim }]}>drag to pan · pinch to zoom · tap a position</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  segmentRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  segText: { fontSize: 12.5, fontWeight: '600' },
  listInner: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  card: { padding: 12, gap: 7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16 },
  name: { flex: 1, fontSize: 14, fontWeight: '700' },
  desc: { fontSize: 12, lineHeight: 17 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  uses: { fontSize: 11 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  crumb: { flex: 1, fontSize: 11.5 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  canvas: { flex: 1 },
  inspector: { margin: 12, padding: 13, gap: 4 },
  inspTitle: { fontSize: 15, fontWeight: '700' },
  inspSub: { fontSize: 12 },
  hint: { fontSize: 11, textAlign: 'center', paddingVertical: 12 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});
