// Files tab — file tree, recents, quick filter
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { theme } from '../src/theme';

const FILE_TREE = [
  { type: 'folder', name: 'app', open: true, depth: 0 },
  { type: 'folder', name: 'llm', open: true, depth: 1 },
  { type: 'file', name: 'client.py', depth: 2, dirty: true, current: true, size: '2.1 KB' },
  { type: 'file', name: 'cli.py', depth: 2, size: '4.7 KB' },
  { type: 'file', name: 'tools.py', depth: 2, size: '1.4 KB' },
  { type: 'folder', name: 'config', open: false, depth: 1 },
  { type: 'folder', name: 'tests', open: false, depth: 0 },
  { type: 'file', name: 'pyproject.toml', depth: 0, size: '0.9 KB' },
  { type: 'file', name: 'README.md', depth: 0, size: '3.2 KB' },
  { type: 'file', name: '.gitignore', depth: 0, size: '180 B' },
];

const RECENTS = [
  { name: 'client.py', path: 'app/llm', dirty: true },
  { name: 'cli.py', path: 'app/llm' },
  { name: 'tools.py', path: 'app/llm' },
];

function FolderIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M2 5a1.5 1.5 0 011.5-1.5h2.8L7.5 5H13a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0113 13H3.5A1.5 1.5 0 012 11.5V5z"
        stroke={theme.fgMuted} strokeWidth={1.4} />
    </Svg>
  );
}

function FileIcon() {
  return (
    <Svg width={11} height={14} viewBox="0 0 11 14" fill="none">
      <Path d="M1 1h6l3 3v9H1z" stroke={theme.fgMuted} strokeWidth={1.2} />
      <Path d="M7 1v3h3" stroke={theme.fgMuted} strokeWidth={1.2} />
    </Svg>
  );
}

export default function FilesScreen() {
  const [q, setQ] = useState('');

  const filtered = FILE_TREE.filter(row =>
    q === '' || row.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Workspace</Text>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>llm-cli</Text>
            <Text style={styles.headerMeta}> · 14 files</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchPill}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M6 10A4 4 0 106 2a4 4 0 000 8zM9.5 9.5L13 13"
              stroke={theme.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Filter files…"
            placeholderTextColor={theme.fgDim}
            style={styles.searchInput}
          />
          <Text style={styles.searchHint}>⌘P</Text>
        </View>

        {/* Recents */}
        <Text style={styles.sectionLabel}>Recent</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.recentsScroll} contentContainerStyle={styles.recentsContent}>
          {RECENTS.map((r) => (
            <View key={r.name} style={styles.recentCard}>
              <View style={styles.recentNameRow}>
                <Text style={styles.recentName}>{r.name}</Text>
                {r.dirty && <View style={styles.dirtyDot} />}
              </View>
              <Text style={styles.recentPath}>{r.path}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Tree header */}
        <View style={styles.treeLabelRow}>
          <Text style={styles.sectionLabel}>Files</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={styles.treeAction}>Sort</Text>
            <Text style={styles.treeAction}>+ New</Text>
          </View>
        </View>

        {/* Tree */}
        <View style={styles.treeCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {filtered.map((row, i) => (
              <TouchableOpacity key={i} activeOpacity={0.7}
                style={[
                  styles.treeRow,
                  { paddingLeft: 14 + row.depth * 16 },
                  row.current ? styles.treeRowActive : null,
                  i < filtered.length - 1 ? styles.treeRowBorder : null,
                ]}>
                {row.current && <View style={styles.activeBar} />}
                {row.type === 'folder' ? (
                  <View style={[styles.chevron, row.open && styles.chevronOpen]}>
                    <Svg width={9} height={9} viewBox="0 0 9 9" fill="none">
                      <Path d="M2.5 1.5L6 4.5L2.5 7.5" stroke={theme.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
                    </Svg>
                  </View>
                ) : <View style={styles.chevronPlaceholder} />}

                <View style={styles.treeIcon}>
                  {row.type === 'folder' ? <FolderIcon /> : <FileIcon />}
                </View>

                <Text style={[
                  styles.treeName,
                  row.current && styles.treeNameActive,
                  row.type === 'folder' && styles.treeNameFolder,
                ]}>{row.name}</Text>

                {row.dirty && <View style={styles.dirtyDot} />}
                {row.size && <Text style={styles.treeSize}>{row.size}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  container: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  headerLabel: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.fgDim, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  headerTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: theme.fg },
  headerMeta: { fontSize: 13, color: theme.fgMuted },
  searchPill: {
    marginHorizontal: 16, marginVertical: 10, height: 44,
    backgroundColor: theme.surface, borderRadius: 22,
    borderWidth: 0.5, borderColor: theme.borderColor,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  searchInput: { flex: 1, color: theme.fg, fontSize: 13.5 },
  searchHint: { fontSize: 11, color: theme.fgDim, fontFamily: 'monospace' },
  sectionLabel: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.fgDim, fontWeight: '600', paddingHorizontal: 24, marginBottom: 8 },
  recentsScroll: { flexGrow: 0 },
  recentsContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  recentCard: {
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 0.5, borderColor: theme.borderColor,
    padding: 12, minWidth: 140,
  },
  recentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentName: { fontSize: 13, fontWeight: '600', color: theme.fg },
  recentPath: { fontSize: 11, color: theme.fgDim, fontFamily: 'monospace', marginTop: 2 },
  dirtyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent },
  treeLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 14, marginBottom: 6,
  },
  treeAction: { fontSize: 12, color: theme.fgMuted },
  treeCard: {
    flex: 1, marginHorizontal: 12, marginBottom: 96,
    backgroundColor: theme.surface, borderRadius: 20,
    borderWidth: 0.5, borderColor: theme.borderColor, overflow: 'hidden',
    paddingVertical: 6,
  },
  treeRow: {
    flexDirection: 'row', alignItems: 'center', paddingRight: 14,
    paddingVertical: 10, gap: 8, position: 'relative',
  },
  treeRowActive: { backgroundColor: 'rgba(255,174,207,0.08)' },
  treeRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.borderColor },
  activeBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: theme.accent },
  chevron: { width: 12, alignItems: 'center' },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  chevronPlaceholder: { width: 12 },
  treeIcon: { width: 16, alignItems: 'center' },
  treeName: { flex: 1, fontSize: 13.5, color: theme.fgMuted, fontFamily: 'monospace' },
  treeNameActive: { color: theme.fg, fontWeight: '600' },
  treeNameFolder: { color: theme.fg, fontWeight: '600' },
  treeSize: { fontSize: 10.5, color: theme.fgDim, fontFamily: 'monospace' },
});
