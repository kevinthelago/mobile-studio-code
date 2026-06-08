import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { repoDir, readText } from '../../src/lib/fs';
import { grepInText, GrepMatch } from '../../src/lib/syntax';
import { Surface } from '../../src/components/ui/Surface';
import { IconBtn } from '../../src/components/ui/IconBtn';
import { SectionLabel } from '../../src/components/ui/SectionLabel';

type FileResult = { file: string; matches: GrepMatch[] };

const MAX_FILES_SCANNED = 400;
const MAX_TOTAL_MATCHES = 200;

function getExtension(path: string): string {
  const idx = path.lastIndexOf('.');
  if (idx === -1) return '';
  return path.slice(idx).toLowerCase();
}

export default function FindScreen() {
  const t = useTheme();
  const router = useRouter();
  const { manifest, openFile } = useSession();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const [scanned, setScanned] = useState(0);

  const scopes = useMemo(() => {
    if (!manifest) return [];
    const allCount = Object.keys(manifest.files).length;
    const modCount = Object.values(manifest.files).filter((f) => f.modified).length;
    const exts: Record<string, number> = {};
    for (const p of Object.keys(manifest.files)) {
      const e = getExtension(p);
      if (!e) continue;
      exts[e] = (exts[e] ?? 0) + 1;
    }
    const topExts = Object.entries(exts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return [
      { id: 'all', label: 'All', count: allCount },
      { id: 'modified', label: 'Modified', count: modCount },
      ...topExts.map(([ext, n]) => ({ id: `ext:${ext}`, label: `*${ext}`, count: n })),
    ];
  }, [manifest]);

  const filteredFiles = useMemo(() => {
    if (!manifest) return [];
    const all = Object.keys(manifest.files);
    if (scope === 'all') return all;
    if (scope === 'modified') return all.filter((p) => manifest.files[p].modified);
    if (scope.startsWith('ext:')) {
      const ext = scope.slice(4);
      return all.filter((p) => getExtension(p) === ext);
    }
    return all;
  }, [manifest, scope]);

  useEffect(() => {
    if (!manifest) return;
    const needle = q.trim();
    if (!needle) {
      setResults([]);
      setTotalMatches(0);
      setScanned(0);
      setScanning(false);
      return;
    }
    let cancelled = false;
    setScanning(true);
    setResults([]);
    setTotalMatches(0);
    setScanned(0);

    const timer = setTimeout(async () => {
      const target = filteredFiles.slice(0, MAX_FILES_SCANNED);
      const out: FileResult[] = [];
      let total = 0;
      let i = 0;
      for (const path of target) {
        if (cancelled) return;
        try {
          const content = await readText(repoDir(manifest.repo) + path);
          const matches = grepInText(content, needle, caseSensitive);
          if (matches.length > 0) {
            out.push({ file: path, matches });
            total += matches.length;
            if (out.length % 5 === 0 && !cancelled) {
              setResults([...out]);
              setTotalMatches(total);
            }
          }
        } catch {
          // skip unreadable files (binary, missing, etc.)
        }
        i++;
        if (i % 20 === 0 && !cancelled) setScanned(i);
        if (total >= MAX_TOTAL_MATCHES) break;
      }
      if (cancelled) return;
      setResults(out);
      setTotalMatches(total);
      setScanned(target.length);
      setScanning(false);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, manifest, filteredFiles, caseSensitive]);

  if (!manifest) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: t.fgMuted }]}>No repo loaded</Text>
        </View>
      </SafeAreaView>
    );
  }

  const matchHi = t.glass
    ? 'rgba(255, 174, 207, 0.25)'
    : t.light
      ? 'rgba(247,196,38,0.45)'
      : 'rgba(255,174,207,0.18)';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <SectionLabel>Search</SectionLabel>
          <Text style={[styles.headerTitle, { color: t.fg }]}>Find in workspace</Text>
        </View>

        <View style={styles.searchWrap}>
          <Surface style={styles.searchPill} radius={24}>
            <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <Circle cx={6} cy={6} r={4} stroke={t.fgMuted} strokeWidth={1.6} />
              <Path d="M9.5 9.5L13 13"
                stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
            </Svg>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search code…"
              placeholderTextColor={t.fgDim}
              style={[styles.searchInput, { color: t.fg, fontFamily: t.fontMono }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {scanning ? (
              <ActivityIndicator size="small" color={t.fgMuted} />
            ) : (
              <IconBtn
                size={28}
                onPress={() => setCaseSensitive((v) => !v)}
                style={caseSensitive ? { backgroundColor: t.accent } : undefined}
              >
                <Text style={[styles.toggleText, {
                  color: caseSensitive ? '#fff' : t.fgMuted,
                  fontFamily: t.fontMono,
                }]}>Aa</Text>
              </IconBtn>
            )}
          </Surface>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
          {scopes.map((c) => {
            const active = c.id === scope;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setScope(c.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active
                      ? t.accent
                      : t.glass ? 'rgba(255,255,255,0.06)' : t.surface,
                    borderColor: t.borderColor,
                    borderRadius: t.sharp ? 4 : 16,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: active ? '#fff' : t.fg }]}>
                  {c.label}
                </Text>
                <Text style={[styles.chipCount, {
                  color: active ? 'rgba(255,255,255,0.85)' : t.fgDim,
                  fontFamily: t.fontMono,
                }]}>
                  {c.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: t.fgDim, fontFamily: t.fontMono }]}>
            {q
              ? `${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${results.length} file${results.length === 1 ? '' : 's'}`
              : 'Type to search'}
          </Text>
          <Text style={[styles.metaText, { color: t.fgDim, fontFamily: t.fontMono }]}>
            {scanning ? `scanning ${scanned}/${filteredFiles.length}` : `${filteredFiles.length} files`}
          </Text>
        </View>

        <View style={styles.resultsWrap}>
          <Surface style={styles.resultsCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {!q && (
                <Text style={[styles.emptyText, { color: t.fgDim }]}>
                  Search runs locally across the files you've downloaded.
                  {caseSensitive ? ' Case-sensitive.' : ' Case-insensitive.'}
                </Text>
              )}
              {q && results.length === 0 && !scanning && (
                <Text style={[styles.emptyText, { color: t.fgDim }]}>No matches.</Text>
              )}
              {results.map((r, ri) => (
                <View key={ri}>
                  <View style={[
                    styles.fileHeader,
                    ri > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: t.borderColor,
                    },
                  ]}>
                    <Svg width={9} height={9} viewBox="0 0 9 9" fill="none"
                      style={{ transform: [{ rotate: '90deg' }] }}>
                      <Path d="M2.5 1.5L6 4.5L2.5 7.5"
                        stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
                    </Svg>
                    <Text style={[styles.fileName, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={1}>
                      {r.file}
                    </Text>
                    <Text style={[styles.fileCount, { color: t.fgDim }]}>{r.matches.length}</Text>
                  </View>
                  {r.matches.slice(0, 12).map((m, mi) => (
                    <TouchableOpacity
                      key={mi} style={styles.matchRow} activeOpacity={0.7}
                      onPress={async () => {
                        await openFile(r.file);
                        router.push('/(tabs)/edit');
                      }}
                    >
                      <Text style={[styles.lineNum, { color: t.fgDim, fontFamily: t.fontMono }]}>{m.line}</Text>
                      <Text style={[styles.matchText, { fontFamily: t.fontMono }]} numberOfLines={1}>
                        <Text style={{ color: t.fgMuted }}>{m.before}</Text>
                        <Text style={{ color: t.fg, backgroundColor: matchHi }}>{m.match}</Text>
                        <Text style={{ color: t.fgMuted }}>{m.after}</Text>
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {r.matches.length > 12 && (
                    <Text style={[styles.matchMore, { color: t.fgDim, fontFamily: t.fontMono }]}>
                      …{r.matches.length - 12} more in this file
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </Surface>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, paddingBottom: 110 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14 },

  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  headerTitle: {
    fontSize: 28, fontWeight: '700', letterSpacing: -0.6, marginTop: 2,
  },

  searchWrap: { marginHorizontal: 16, marginVertical: 10 },
  searchPill: {
    height: 48,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingRight: 6, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  toggleText: { fontSize: 11, fontWeight: '700' },

  chipsScroll: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 32, paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  chipLabel: { fontSize: 12.5, fontWeight: '500' },
  chipCount: { fontSize: 11 },

  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 10, marginBottom: 4,
  },
  metaText: { fontSize: 11.5 },

  resultsWrap: { flex: 1, marginHorizontal: 12, marginBottom: 110 },
  resultsCard: { flex: 1, paddingVertical: 4 },
  emptyText: { fontSize: 13, lineHeight: 18, padding: 16 },
  fileHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
  },
  fileName: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  fileCount: { fontSize: 11 },
  matchRow: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingLeft: 28,
    paddingVertical: 5, alignItems: 'center',
  },
  lineNum: { width: 32, fontSize: 11.5, textAlign: 'right' },
  matchText: { flex: 1, fontSize: 11.5 },
  matchMore: {
    fontSize: 11, paddingHorizontal: 28, paddingVertical: 4, fontStyle: 'italic',
  },
});
