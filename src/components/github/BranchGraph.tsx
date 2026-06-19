// SVG commit DAG for the branch graph panel.
// Adapted from the desktop BranchGraph component — same layout algorithm,
// phone-sized coordinates with lane spacing that fits a 320–430pt screen.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme';
import {
  buildBranchGraphLayout,
  type GhCommitItem,
  type BranchGraphLayout,
  type PulseColors,
} from '../../lib/githubPulse';

interface BranchComp {
  name: string;
  mergeBaseSha: string;
  commits: GhCommitItem[];
}

interface BranchGraphProps {
  mainCommits: GhCommitItem[];
  defaultBranch: string;
  branchComps: BranchComp[];
  width: number;
  colors: PulseColors;
}

const LANE_Y = [18, 48, 78, 108];
const DOT_R_NORMAL = 4;
const DOT_R_HEAD = 6;

export function BranchGraph({
  mainCommits, defaultBranch, branchComps, width, colors,
}: BranchGraphProps) {
  const t = useTheme();
  const layout: BranchGraphLayout = buildBranchGraphLayout(
    mainCommits, defaultBranch, branchComps, width, colors,
  );

  const laneColors = layout.laneNames.map((_, i) => {
    const palette = [colors.accent, colors.info, colors.success, colors.extra1];
    return palette[i % palette.length];
  });

  return (
    <View>
      {layout.points.length === 0 ? (
        <Text style={[styles.empty, { color: t.fgDim, fontFamily: t.fontMono }]}>
          No commit history found.
        </Text>
      ) : (
        <Svg width={width} height={layout.height + 4}>
          {/* Lane guide lines */}
          {layout.laneNames.map((_, i) => (
            <Line key={`guide-${i}`}
              x1={8} y1={LANE_Y[i]} x2={width - 8} y2={LANE_Y[i]}
              stroke={t.borderColor} strokeWidth={0.5} strokeDasharray="3,4" />
          ))}

          {/* Edges */}
          {layout.edges.map((e, idx) =>
            e.curved ? (
              <Path key={`edge-${idx}`}
                d={`M${e.x1.toFixed(1)},${e.y1.toFixed(1)} C${((e.x1 + e.x2) / 2).toFixed(1)},${e.y1.toFixed(1)} ${((e.x1 + e.x2) / 2).toFixed(1)},${e.y2.toFixed(1)} ${e.x2.toFixed(1)},${e.y2.toFixed(1)}`}
                fill="none" stroke={e.color} strokeWidth={1.5} opacity={0.85} />
            ) : (
              <Line key={`edge-${idx}`}
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={e.color} strokeWidth={1.5} />
            ),
          )}

          {/* Commit dots */}
          {layout.points.map((p) => {
            const y = LANE_Y[p.lane];
            const color = laneColors[p.lane];
            const r = p.isHead ? DOT_R_HEAD : DOT_R_NORMAL;
            return (
              <Circle key={p.sha}
                cx={p.x} cy={y} r={r}
                fill={p.isHead ? color : t.bg}
                stroke={color}
                strokeWidth={p.isHead ? 0 : 1.5} />
            );
          })}
        </Svg>
      )}

      {/* Lane legend */}
      {layout.laneNames.length > 0 && (
        <View style={styles.legend}>
          {layout.laneNames.map((name, i) => (
            <View key={name} style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: laneColors[i] }]} />
              <Text style={[styles.legendName, { color: t.fgDim, fontFamily: t.fontMono }]}
                numberOfLines={1}>
                {name.length > 18 ? name.slice(0, 16) + '…' : name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 11, paddingVertical: 16, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  legendName: { fontSize: 10 },
});
