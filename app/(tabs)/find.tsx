import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { repoDir, readText } from '../../src/lib/fs';
import { grepInText, GrepMatch } from '../../src/lib/syntax';
import { hexAlpha } from '../../src/lib/color';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { Tag } from '../../src/components/ui/Tag';
import { Card } from '../../src/components/ui/Card';

type FileResult = { file: string; matches: GrepMatch[] };

const MAX_FILES_SCANNED = 400;
const MAX_TOTAL_MATCHES = 200;
const MAX_MATCHES_PER_FILE = 12;
const TAB_BAR_HEIGHT = 60;

function getExtension(path: string): string {
  const idx = path.lastIndexOf('.');
  if (idx === -1) return '';
  return path.slice(idx).toLowerCase();
}

export default function FindScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      { id: 'all', label: 'all', count: allCount },
      { id: 'modified', label: 'modified', count: modCount },
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
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: t.fgMuted }]}>No repo loaded</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeScope = scopes.find((s) => s.id === scope);
  const matchHi = hexAlpha(t.accent, 0.30);

  async function handleOpen(file: string) {
    await openFile(file);
    router.push('/(tabs)/edit');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <PageHeader
        crumbs={[manifest.repo, manifest.branch, 'search']}
        title={q.trim() || 'Find'}
        meta={
          q.trim()
            ? `${totalMatches} match${totalMatches === 1 ? '' : 'es'} · ${results.length} file${results.length === 1 ? '' : 's'}`
            : undefined
        }
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search input */}
        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search code…"
            placeholderTextColor={t.fgDim}
            style={[styles.searchInput, {
              color: t.fg,
              backgroundColor: t.elev,
              borderColor: t.borderColor,
              fontFamily: t.fontMono,
            }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {scanning && (
            <ActivityIndicator size="small" color={t.fgMuted} style={styles.spinner} />
          )}
        </View>

        {/* Scoping tags: case toggle + scope chips + active-scope indicator */}
        <View style={styles.tagsRow}>
          <Pressable onPress={() => setCaseSensitive((v) => !v)}>
            <Tag variant={caseSensitive ? 'amber' : 'default'}>case-sensitive</Tag>
          </Pressable>
          {scopes.map((s) => {
            const active = s.id === scope;
            return (
              <Pressable key={s.id} onPress={() => setScope(s.id)}>
                <Tag variant={active ? 'amber' : 'default'}>{`${s.label} · ${s.count}`}</Tag>
              </Pressable>
            );
          })}
          <View style={styles.tagsSpacer} />
          {activeScope && activeScope.id !== 'all' && (
            <Tag variant="info">{`in: ${activeScope.label}`}</Tag>
          )}
        </View>

        {/* Results */}
        {!q.trim() && (
          <Text style={[styles.helper, { color: t.fgDim }]}>
            Search runs locally across the files you&apos;ve downloaded.
            {caseSensitive ? ' Case-sensitive.' : ' Case-insensitive.'}
          </Text>
        )}
        {!!q.trim() && results.length === 0 && !scanning && (
          <Text style={[styles.helper, { color: t.fgDim }]}>No matches.</Text>
        )}

        {results.map((r) => (
          <View key={r.file}>
            {/* File group header (mono, normal-case — not a SectionLabel) */}
            <View style={styles.fileHeader}>
              <Text
                style={[styles.fileName, { color: t.fgMuted, fontFamily: t.fontMono }]}
                numberOfLines={1}
              >
                {r.file}
              </Text>
              <Text style={[styles.fileCount, { color: t.fgDim, fontFamily: t.fontMono }]}>
                · {r.matches.length}
              </Text>
              <View style={styles.tagsSpacer} />
              <Pressable onPress={() => handleOpen(r.file)} hitSlop={6}>
                <Text style={[styles.openAction, { color: t.accent, fontFamily: t.fontMono }]}>
                  open ›
                </Text>
              </Pressable>
            </View>

            <View style={styles.matchList}>
              {r.matches.slice(0, MAX_MATCHES_PER_FILE).map((m, mi) => (
                <TouchableOpacity key={mi} activeOpacity={0.7} onPress={() => handleOpen(r.file)}>
                  <Card style={styles.matchCard}>
                    <Text style={[styles.lineNum, { color: t.fgDim, fontFamily: t.fontMono }]}>
                      {m.line}
                    </Text>
                    <Text style={[styles.matchText, { fontFamily: t.fontMono }]} numberOfLines={1}>
                      <Text style={{ color: t.fgMuted }}>{m.before}</Text>
                      <Text style={{ color: t.fg, backgroundColor: matchHi }}>{m.match}</Text>
                      <Text style={{ color: t.fgMuted }}>{m.after}</Text>
                    </Text>
                  </Card>
                </TouchableOpacity>
              ))}
              {r.matches.length > MAX_MATCHES_PER_FILE && (
                <Text style={[styles.matchMore, { color: t.fgDim, fontFamily: t.fontMono }]}>
                  …{r.matches.length - MAX_MATCHES_PER_FILE} more in this file
                </Text>
              )}
            </View>
          </View>
        ))}

        {/* Scan progress footer */}
        {scanning && (
          <Text style={[styles.scanMeta, { color: t.fgDim, fontFamily: t.fontMono }]}>
            scanning {scanned}/{filteredFiles.length}…
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14 },

  body: { flex: 1 },

  searchWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, justifyContent: 'center' },
  searchInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 12.5,
  },
  spinner: { position: 'absolute', right: 26, top: 18 },

  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tagsSpacer: { flex: 1 },

  helper: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 16, paddingVertical: 12 },

  fileHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  fileName: { fontSize: 11, fontWeight: '500', flexShrink: 1 },
  fileCount: { fontSize: 10 },
  openAction: { fontSize: 10.5 },

  matchList: { paddingHorizontal: 12, gap: 6 },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  lineNum: { width: 30, fontSize: 10, textAlign: 'right' },
  matchText: { flex: 1, fontSize: 11 },
  matchMore: { fontSize: 10.5, paddingHorizontal: 12, paddingTop: 4, fontStyle: 'italic' },

  scanMeta: { fontSize: 10.5, paddingHorizontal: 16, paddingVertical: 10 },
});
