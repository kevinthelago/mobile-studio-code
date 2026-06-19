// Language composition bar — proportional bar chart for repo language bytes.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { PulseColors } from '../../lib/githubPulse';

interface LanguageBarProps {
  languages: Record<string, number>;
  colors: PulseColors;
  maxItems?: number;
}

// Stable deterministic hue from a language name — same algorithm as loginColor.
function langHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  return `hsl(${h % 360}, 60%, 58%)`;
}

export function LanguageBar({ languages, colors, maxItems = 8 }: LanguageBarProps) {
  const t = useTheme();

  const sorted = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxItems);

  if (sorted.length === 0) {
    return (
      <Text style={[styles.empty, { color: t.fgDim, fontFamily: t.fontMono }]}>
        No language data.
      </Text>
    );
  }

  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const langColors = sorted.map(([name]) => langHue(name));

  return (
    <View style={styles.container}>
      {/* Stacked bar */}
      <View style={styles.bar}>
        {sorted.map(([name, bytes], i) => (
          <View key={name}
            style={[
              styles.segment,
              {
                flex: bytes,
                backgroundColor: langColors[i],
                borderRadius: i === 0 ? 3 : i === sorted.length - 1 ? 3 : 0,
                marginLeft: i === 0 ? 0 : 1,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend rows */}
      <View style={styles.legend}>
        {sorted.map(([name, bytes], i) => {
          const pct = ((bytes / total) * 100).toFixed(1);
          return (
            <View key={name} style={styles.langRow}>
              <View style={[styles.dot, { backgroundColor: langColors[i] }]} />
              <Text style={[styles.langName, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                {name}
              </Text>
              <Text style={[styles.langPct, { color: t.fgDim, fontFamily: t.fontMono }]}>
                {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  segment: { height: '100%' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  langName: { fontSize: 11 },
  langPct: { fontSize: 10 },
  empty: { fontSize: 11, paddingVertical: 8 },
});
