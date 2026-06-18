import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { useTunnel } from '../../lib/TunnelContext';
import { McpServerInfo, McpToolInfo } from '../../lib/types';
import { useTheme } from '../../theme';

// ── M1: Read-only mobile MCP server + tool viewer ─────────────────────────────
// The mobile side is a read-only observer of the desktop's MCP servers. It can
// view which servers are connected and what tools are available, but cannot
// invoke tools directly (that happens on the desktop via the agent).

const STATUS_OK = '#34c759';
const STATUS_ERR = '#ff3b30';

type ServerStatusBadgeProps = { status: McpServerInfo['status'] };

function ServerStatusBadge({ status }: ServerStatusBadgeProps) {
  const t = useTheme();
  const color = status === 'connected' ? STATUS_OK : status === 'error' ? STATUS_ERR : t.fgDim;
  const label = status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Disconnected';
  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

type McpToolRowProps = { tool: McpToolInfo };

function McpToolRow({ tool }: McpToolRowProps) {
  const t = useTheme();
  return (
    <View style={[styles.toolRow, { borderTopColor: t.borderColor }]}>
      <Text style={[styles.toolName, { color: t.fg, fontFamily: t.fontMono }]}>{tool.name}</Text>
      {tool.description ? (
        <Text style={[styles.toolDesc, { color: t.fgMuted }]} numberOfLines={2}>
          {tool.description}
        </Text>
      ) : null}
    </View>
  );
}

type McpServerCardProps = {
  server: McpServerInfo;
  tools: McpToolInfo[];
  expanded: boolean;
  onToggle: () => void;
};

function McpServerCard({ server, tools, expanded, onToggle }: McpServerCardProps) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Pressable style={styles.cardHeader} onPress={onToggle}>
        <View style={styles.serverInfo}>
          <Text style={[styles.serverName, { color: t.fg }]}>{server.name}</Text>
          <Text style={[styles.serverMeta, { color: t.fgMuted }]}>
            {server.transport} · {server.toolCount} tool{server.toolCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <ServerStatusBadge status={server.status} />
          <Text style={[styles.chevron, { color: t.fgDim }]}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {expanded && tools.length > 0 && (
        <View style={styles.toolList}>
          {tools.map((tool) => (
            <McpToolRow key={tool.name} tool={tool} />
          ))}
        </View>
      )}

      {expanded && tools.length === 0 && (
        <View style={[styles.noTools, { borderTopColor: t.borderColor }]}>
          <Text style={[styles.noToolsText, { color: t.fgMuted }]}>No tools loaded yet</Text>
        </View>
      )}
    </View>
  );
}

export function McpServerList() {
  const { mcpServers, mcpTools, requestMcpList, connectionState } = useTunnel();
  const t = useTheme();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Request a fresh snapshot when we mount and are connected.
  useEffect(() => {
    if (connectionState === 'connected') {
      requestMcpList();
    }
  }, [connectionState, requestMcpList]);

  if (connectionState !== 'connected') {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: t.fgMuted }]}>
          Connect to a desktop session to see MCP servers.
        </Text>
      </View>
    );
  }

  if (mcpServers.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: t.fgMuted }]}>
          No MCP servers found on the desktop.
        </Text>
        <Pressable style={[styles.refreshBtn, { borderColor: t.borderColor }]} onPress={requestMcpList}>
          <Text style={[styles.refreshText, { color: t.accent }]}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: t.fg }]}>MCP Servers</Text>
        <Pressable onPress={requestMcpList}>
          <Text style={[styles.refreshInline, { color: t.accent }]}>Refresh</Text>
        </Pressable>
      </View>
      {mcpServers.map((server) => (
        <McpServerCard
          key={server.id}
          server={server}
          tools={mcpTools[server.id] ?? []}
          expanded={expandedId === server.id}
          onToggle={() => setExpandedId((prev) => (prev === server.id ? null : server.id))}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  refreshInline: { fontSize: 14 },
  card: { borderRadius: 12, overflow: 'hidden' },
  cardHeader: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serverInfo: { flex: 1, gap: 2 },
  serverName: { fontSize: 15, fontWeight: '600' },
  serverMeta: { fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  chevron: { fontSize: 10 },
  toolList: {},
  toolRow: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  toolName: { fontSize: 13, fontWeight: '600' },
  toolDesc: { fontSize: 12 },
  noTools: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  noToolsText: { fontSize: 13, fontStyle: 'italic' },
  emptyState: { padding: 24, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  refreshBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  refreshText: { fontSize: 14, fontWeight: '500' },
});
