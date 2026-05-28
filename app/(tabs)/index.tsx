import React, { useMemo, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { FileEntry } from '../../src/lib/types';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { SectionLabel } from '../../src/components/ui/SectionLabel';
import { Card } from '../../src/components/ui/Card';

type TreeRow =
  | { type: 'folder'; path: string; name: string; depth: number; open: boolean }
  | { type: 'file'; path: string; name: string; depth: number; modified: boolean; current: boolean };

// Convert a #rrggbb token to rgba() at the given alpha. Mirrors the design's
// `color-mix(in oklch, <token>, transparent <n>%)` tints (RN has no color-mix).
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}

function buildTree(
  files: Record<string, FileEntry>,
  expanded: Set<string>,
  filter: string,
  currentPath: string | null,
): TreeRow[] {
  const allPaths = Object.keys(files).sort();
  const trimmedFilter = filter.trim().toLowerCase();

  if (trimmedFilter) {
    return allPaths
      .filter((p) => p.toLowerCase().includes(trimmedFilter))
      .slice(0, 200)
      .map((p) => {
        const parts = p.split('/');
        const name = parts[parts.length - 1];
        return {
          type: 'file' as const,
          path: p,
          name,
          depth: 0,
          modified: files[p].modified,
          current: p === currentPath,
        };
      });
  }

  const rows: TreeRow[] = [];
  const addedFolders = new Set<string>();

  for (const filePath of allPaths) {
    const parts = filePath.split('/');
    for (let d = 0; d < parts.length - 1; d++) {
      const folderPath = parts.slice(0, d + 1).join('/');
      if (!addedFolders.has(folderPath)) {
        addedFolders.add(folderPath);
        rows.push({
          type: 'folder',
          path: folderPath,
          name: parts[d],
          depth: d,
          open: expanded.has(folderPath),
        });
      }
    }
    const parentFolder = parts.slice(0, parts.length - 1).join('/');
    if (parts.length === 1 || expanded.has(parentFolder)) {
      rows.push({
        type: 'file',
        path: filePath,
        name: parts[parts.length - 1],
        depth: parts.length - 1,
        modified: files[filePath].modified,
        current: filePath === currentPath,
      });
    }
  }

  return rows.filter((row) => {
    if (row.type === 'folder') return true;
    if (row.depth === 0) return true;
    const parent = row.path.split('/').slice(0, -1).join('/');
    return expanded.has(parent);
  });
}

const TAB_BAR_HEIGHT = 60;

export default function FilesScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { manifest, openFile, currentPath } = useSession();
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const fileCount = manifest ? Object.keys(manifest.files).length : 0;
  const modifiedCount = manifest
    ? Object.values(manifest.files).filter((f) => f.modified).length
    : 0;

  const tree = useMemo(
    () => (manifest ? buildTree(manifest.files, expanded, q, currentPath) : []),
    [manifest, expanded, q, currentPath],
  );

  const recents = useMemo(() => {
    if (!manifest) return [];
    const out: { path: string; modified: boolean; current: boolean }[] = [];
    if (currentPath && manifest.files[currentPath]) {
      out.push({ path: currentPath, modified: manifest.files[currentPath].modified, current: true });
    }
    for (const [path, entry] of Object.entries(manifest.files)) {
      if (path === currentPath) continue;
      if (entry.modified) out.push({ path, modified: true, current: false });
      if (out.length >= 5) break;
    }
    return out;
  }, [manifest, currentPath]);

  function toggleFolder(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleFileTap(path: string) {
    try {
      await openFile(path);
      router.navigate('/(tabs)/edit');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not open file', msg);
    }
  }

  if (!manifest) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: t.fgMuted }]}>No repo loaded</Text>
        </View>
      </SafeAreaView>
    );
  }

  const repoLeaf = manifest.repo.split('/').slice(-1)[0];
  const currentTint = hexAlpha(t.accent, 0.10);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <PageHeader
        crumbs={[manifest.repo, manifest.branch]}
        title={repoLeaf}
        meta={
          <>
            {fileCount} files
            {modifiedCount > 0 && (
              <Text style={{ color: t.accent }}>{` · ${modifiedCount} modified`}</Text>
            )}
          </>
        }
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Filter input */}
        <View style={styles.filterWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Filter files…"
            placeholderTextColor={t.fgDim}
            style={[styles.filterInput, {
              color: t.fg,
              backgroundColor: t.elev,
              borderColor: t.borderColor,
              fontFamily: t.fontMono,
            }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Recents */}
        {recents.length > 0 && !q && (
          <>
            <SectionLabel>Recent</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentsRow}
            >
              {recents.map((r) => {
                const name = r.path.split('/').slice(-1)[0];
                const dir = r.path.split('/').slice(0, -1).join('/');
                return (
                  <Pressable key={r.path} onPress={() => handleFileTap(r.path)}>
                    <Card
                      style={styles.recentCard}
                      background={r.current ? hexAlpha(t.accent, 0.10) : t.surface}
                      borderColor={r.current ? t.accentDim : t.borderColor}
                    >
                      <View style={styles.recentHead}>
                        <Text
                          style={[styles.recentName, {
                            color: r.current ? t.accent : t.fg, fontFamily: t.fontMono,
                          }]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        {r.modified && <View style={[styles.dirtyDot, { backgroundColor: t.accent }]} />}
                      </View>
                      <Text
                        style={[styles.recentPath, { color: t.fgDim, fontFamily: t.fontMono }]}
                        numberOfLines={1}
                      >
                        {dir || './'}
                      </Text>
                    </Card>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Files / Matches */}
        <SectionLabel
          count={q ? undefined : fileCount}
          hint={
            q
              ? `${tree.length} match${tree.length === 1 ? '' : 'es'}`
              : 'tap folder to expand'
          }
        >
          {q ? 'Matches' : 'Files'}
        </SectionLabel>

        <View style={styles.tree}>
          {tree.length === 0 && (
            <Text style={[styles.emptyTreeText, { color: t.fgDim }]}>
              {q ? 'No files match' : 'Empty repo'}
            </Text>
          )}
          {tree.map((row, i) => {
            const isCurrent = row.type === 'file' && row.current;
            const emphasised = row.type === 'folder' || isCurrent;
            return (
              <TouchableOpacity
                key={`${row.type}:${row.path}:${i}`}
                activeOpacity={0.7}
                style={[
                  styles.row,
                  {
                    paddingLeft: (isCurrent ? 14 : 16) + row.depth * 14,
                    borderBottomColor: t.borderColor,
                    backgroundColor: isCurrent ? currentTint : 'transparent',
                    borderLeftWidth: isCurrent ? 2 : 0,
                    borderLeftColor: t.accent,
                  },
                ]}
                onPress={() => {
                  if (row.type === 'folder') toggleFolder(row.path);
                  else handleFileTap(row.path);
                }}
              >
                <Text style={[styles.glyph, {
                  color: row.type === 'folder' ? t.fgMuted : t.fgDim, fontFamily: t.fontMono,
                }]}>
                  {row.type === 'folder' ? (row.open ? '▾' : '▸') : '·'}
                </Text>
                <Text
                  style={[styles.name, {
                    color: emphasised ? t.fg : t.fgMuted,
                    fontFamily: t.fontMono,
                    fontWeight: emphasised ? '500' : '400',
                  }]}
                  numberOfLines={1}
                >
                  {row.type === 'folder' ? row.name + '/' : row.name}
                </Text>
                {row.type === 'file' && row.modified && (
                  <View style={[styles.dirtyDot, { backgroundColor: t.accent }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14 },

  body: { flex: 1 },

  filterWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  filterInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 12.5,
  },

  recentsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  recentCard: { minWidth: 140, paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  recentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentName: { fontSize: 12, fontWeight: '500', flex: 1 },
  recentPath: { fontSize: 10 },

  tree: { paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 16,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  glyph: { width: 16, textAlign: 'center', fontSize: 11 },
  name: { flex: 1, fontSize: 12.5 },
  dirtyDot: { width: 6, height: 6, borderRadius: 3 },
  emptyTreeText: { padding: 16, textAlign: 'center' },
});
