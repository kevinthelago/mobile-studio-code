import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../src/theme';
import { MirrorScaffold } from '../../src/components/shell/MirrorScaffold';
import { ComponentsMirror } from '../../src/components/design/ComponentsMirror';
import { ThemesMirror } from '../../src/components/design/ThemesMirror';

type Segment = 'components' | 'themes';

const SEGMENTS: ReadonlyArray<{ key: Segment; label: string }> = [
  { key: 'components', label: 'COMPONENTS' },
  { key: 'themes', label: 'THEMES' },
];

/**
 * UI (Design) tab (#221) — mirrors the desktop's Design Studio read-only over two store domains: the
 * component kits + summaries (`components`, rendered as a composition graph or a by-kit list) and the
 * theme registry (`themes`, active highlighted). Each segment reads its own mirror domain, so each
 * keeps its own MirrorScaffold awaiting/empty state.
 */
export default function UiTab() {
  const t = useTheme();
  const [segment, setSegment] = useState<Segment>('components');

  const toolbar = (
    <View style={[styles.segments, { borderBottomColor: t.borderColor }]}>
      {SEGMENTS.map(({ key, label }) => {
        const active = segment === key;
        return (
          <Pressable
            key={key}
            onPress={() => setSegment(key)}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[styles.segment, active && { borderBottomColor: t.accent }]}
          >
            <Text style={[styles.segmentText, { color: active ? t.fg : t.fgMuted, fontFamily: t.fontMono }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return segment === 'components' ? (
    <MirrorScaffold
      domain="components"
      title="UI"
      subtitle="Design Studio · component kits"
      blurb="UI mirrors the desktop's Design Studio — the component kits and how they compose."
      toolbar={toolbar}
    >
      {(data) => <ComponentsMirror data={data} />}
    </MirrorScaffold>
  ) : (
    <MirrorScaffold
      domain="themes"
      title="UI"
      subtitle="Design Studio · themes"
      blurb="UI mirrors the desktop's theme registry — the semantic-token themes each kit restyles under."
      toolbar={toolbar}
    >
      {(data) => <ThemesMirror data={data} />}
    </MirrorScaffold>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: 'transparent',
  },
  segmentText: { fontSize: 10.5, letterSpacing: 0.6, fontWeight: '600' },
});
