import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../src/theme';
import { MirrorScaffold } from '../../src/components/shell/MirrorScaffold';

type Segment = 'automations' | 'mcp';

const SEGMENTS: ReadonlyArray<{ key: Segment; label: string }> = [
  { key: 'automations', label: 'AUTOMATIONS' },
  { key: 'mcp', label: 'MCP SERVERS' },
];

/**
 * Automations tab (#218 scaffold) — a segmented read-only page hosting both
 * the desktop's automations and its MCP servers (folded in per the epic's tab
 * plan). Each segment reads its own mirror domain.
 */
export default function AutomationsTab() {
  const t = useTheme();
  const [segment, setSegment] = useState<Segment>('automations');

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
            <Text
              style={[
                styles.segmentText,
                { color: active ? t.fg : t.fgMuted, fontFamily: t.fontMono },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return segment === 'automations' ? (
    <MirrorScaffold
      domain="automations"
      title="Automations"
      subtitle="Scheduled rules · read-only mirror"
      blurb="Automations mirrors the desktop's cron-triggered rules and their run history."
      toolbar={toolbar}
    />
  ) : (
    <MirrorScaffold
      domain="mcp"
      title="Automations"
      subtitle="MCP servers · read-only mirror"
      blurb="MCP mirrors the desktop's configured MCP servers and their status."
      toolbar={toolbar}
    />
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
