// Find tab — search query, scope chips, results grouped by file
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from '../src/theme';

const FIND_RESULTS = [
  {
    file: 'app/llm/client.py', matches: [
      { line: 6, before: '    client = ', match: 'AsyncAnthropic', after: '()' },
      { line: 8, before: '        model="', match: 'claude', after: '-sonnet-4-5",' },
    ],
  },
  {
    file: 'app/llm/cli.py', matches: [
      { line: 12, before: 'from anthropic import ', match: 'AsyncAnthropic', after: '' },
      { line: 24, before: '    async with ', match: 'AsyncAnthropic', after: '() as c:' },
    ],
  },
  {
    file: 'tests/test_client.py', matches: [
      { line: 4, before: 'mock = mock.', match: 'AsyncAnthropic', after: '()' },
    ],
  },
];

const SCOPES = [
  { id: 'all', label: 'All files', count: 5 },
  { id: 'open', label: 'Open', count: 1 },
  { id: 'py', label: '*.py', count: 4 },
  { id: 'tests', label: 'Tests', count: 1 },
];

export default function FindScreen() {
  const [q, setQ] = useState('AsyncAnthropic');
  const [scope, setScope] = useState('all');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Search</Text>
          <Text style={styles.headerTitle}>Find in workspace</Text>
        </View>

        {/* Search input */}
        <View style={styles.searchPill}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Circle cx={6} cy={6} r={4} stroke={theme.fgMuted} strokeWidth={1.6} />
            <Path d="M9.5 9.5L13 13" stroke={theme.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search code…"
            placeholderTextColor={theme.fgDim}
            style={styles.searchInput}
          />
        </View>

        {/* Scope chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
          {SCOPES.map((c) => {
            const active = c.id === scope;
            return (
              <TouchableOpacity key={c.id} onPress={() => setScope(c.id)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{c.label}</Text>
                <Text style={[styles.chipCount, active && styles.chipCountActive]}>{c.count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>5 matches in 3 files</Text>
          <Text style={styles.metaText}>Aa · .* · ⁋</Text>
        </View>

        {/* Results */}
        <View style={styles.resultsCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {FIND_RESULTS.map((r, ri) => (
              <View key={ri}>
                {/* File header */}
                <View style={[styles.fileHeader, ri > 0 && styles.fileHeaderBorder]}>
                  <Svg width={9} height={9} viewBox="0 0 9 9" fill="none"
                    style={{ transform: [{ rotate: '90deg' }] }}>
                    <Path d="M2.5 1.5L6 4.5L2.5 7.5" stroke={theme.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
                  </Svg>
                  <Text style={styles.fileName}>{r.file}</Text>
                  <Text style={styles.fileCount}>{r.matches.length}</Text>
                </View>
                {/* Match rows */}
                {r.matches.map((m, mi) => (
                  <View key={mi} style={styles.matchRow}>
                    <Text style={styles.lineNum}>{m.line}</Text>
                    <Text style={styles.matchText} numberOfLines={1}>
                      <Text style={styles.matchContext}>{m.before}</Text>
                      <Text style={styles.matchHighlight}>{m.match}</Text>
                      <Text style={styles.matchContext}>{m.after}</Text>
                    </Text>
                  </View>
                ))}
              </View>
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
  headerTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: theme.fg, marginTop: 2 },
  searchPill: {
    marginHorizontal: 16, marginVertical: 10, height: 48,
    backgroundColor: theme.surface, borderRadius: 24,
    borderWidth: 0.5, borderColor: theme.borderColor,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  searchInput: { flex: 1, color: theme.fg, fontSize: 14, fontFamily: 'monospace' },
  chipsScroll: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 32, paddingHorizontal: 12, borderRadius: 16,
    borderWidth: 0.5, borderColor: theme.borderColor,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipLabel: { fontSize: 12.5, fontWeight: '500', color: theme.fg },
  chipLabelActive: { color: '#fff' },
  chipCount: { fontSize: 11, color: theme.fgDim },
  chipCountActive: { color: 'rgba(255,255,255,0.85)' },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 10, marginBottom: 4,
  },
  metaText: { fontSize: 11.5, color: theme.fgDim, fontFamily: 'monospace' },
  resultsCard: {
    flex: 1, marginHorizontal: 12, marginBottom: 96,
    backgroundColor: theme.surface, borderRadius: 20,
    borderWidth: 0.5, borderColor: theme.borderColor, overflow: 'hidden',
    paddingVertical: 4,
  },
  fileHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
  },
  fileHeaderBorder: { borderTopWidth: 0.5, borderTopColor: theme.borderColor },
  fileName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: theme.fg, fontFamily: 'monospace' },
  fileCount: { fontSize: 11, color: theme.fgDim },
  matchRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingLeft: 28, paddingVertical: 4, alignItems: 'center' },
  lineNum: { width: 28, color: theme.fgDim, fontFamily: 'monospace', fontSize: 11.5, textAlign: 'right' },
  matchText: { flex: 1, fontFamily: 'monospace', fontSize: 11.5 },
  matchContext: { color: theme.fgMuted },
  matchHighlight: {
    color: theme.fg,
    backgroundColor: 'rgba(255,174,207,0.25)',
  },
});
