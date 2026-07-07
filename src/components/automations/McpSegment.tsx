import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, type Theme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { SectionLabel } from '../ui/SectionLabel';
import { EmptyRow } from '../ui/EmptyRow';
import { selectMcpView, type McpServerVM } from '../../lib/mirror/mcpView';

const GOOD = '#4ade80';

function installTag(s: McpServerVM, t: Theme): { label: string; color: string; dot?: string } {
  switch (s.installState) {
    case 'installed':
      return { label: s.version ? `v${s.version}` : 'installed', color: t.fg, dot: GOOD };
    case 'available':
      return { label: 'not installed', color: t.fgMuted };
    default:
      return { label: 'unknown', color: t.fgDim };
  }
}

/**
 * The MCP Servers segment (#223): the desktop's configured MCP servers and —
 * when the payload distinguishes them — its bundled built-in tools. Display
 * only: no install/edit affordances (mutations via chat).
 */
export function McpSegment({ data }: { data: unknown }) {
  const view = useMemo(() => selectMcpView(data), [data]);

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      <SectionLabel>Servers</SectionLabel>
      {view.servers.length === 0 ? (
        <EmptyRow>No MCP servers configured on the desktop yet.</EmptyRow>
      ) : (
        view.servers.map((s) => <ServerRow key={s.id} server={s} />)
      )}

      {view.builtins.length > 0 && (
        <>
          <SectionLabel style={styles.sectionGap}>Built-in tools</SectionLabel>
          {view.builtins.map((s) => <ServerRow key={s.id} server={s} />)}
        </>
      )}
    </ScrollView>
  );
}

function ServerRow({ server: s }: { server: McpServerVM }) {
  const t = useTheme();
  const install = installTag(s, t);
  return (
    <Surface style={styles.row} radius={8}>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={[styles.name, { color: s.enabled ? t.fg : t.fgMuted }]} numberOfLines={1}>
            {s.name}
          </Text>
          {!s.enabled && <Tag color={t.fgDim}>off</Tag>}
        </View>
        <Text style={[styles.meta, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
          {s.transport}
          {` · ${s.scopeLabel}`}
          {s.url ? ` · ${s.url}` : ''}
        </Text>
      </View>
      <Tag dot={install.dot} color={install.color}>{install.label}</Tag>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 28 },
  sectionGap: { marginTop: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: { flex: 1, gap: 4 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 10.5 },
});
