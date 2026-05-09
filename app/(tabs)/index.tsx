import React, { useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { FileEntry } from '../../src/lib/types';
import { Surface } from '../../src/components/ui/Surface';

type TreeRow =
  | { type: 'folder'; path: string; name: string; depth: number; open: boolean }
  | { type: 'file'; path: string; name: string; depth: number; modified: boolean; current: boolean };

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
      .map((p) => ({
        type: 'file' as const,
        path: p,
        name: p,
        depth: 0,
        modified: files[p].modified,
        current: p === currentPath,
      }));
  }

  const folders = new Set<string>();
  for (const p of allPaths) {
    const parts = p.split('/');
    let acc = '';
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? acc + '/' + parts[i] : parts[i];
      folders.add(acc);
    }
  }

  const byParent: Record<string, { folders: string[]; files: string[] }> = {};
  function ensure(parent: string) {
    if (!byParent[parent]) byParent[parent] = { folders: [], files: [] };
  }
  ensure('');
  for (const f of folders) {
    const lastSlash = f.lastIndexOf('/');
    const parent = lastSlash === -1 ? '' : f.slice(0, lastSlash);
    ensure(parent);
    byParent[parent].folders.push(f);
  }
  for (const p of allPaths) {
    const lastSlash = p.lastIndexOf('/');
    const parent = lastSlash === -1 ? '' : p.slice(0, lastSlash);
    ensure(parent);
    byParent[parent].files.push(p);
  }
  for (const k of Object.keys(byParent)) {
    byParent[k].folders.sort();
    byParent[k].files.sort();
  }

  const out: TreeRow[] = [];
  function walk(parent: string, depth: number) {
    const node = byParent[parent];
    if (!node) return;
    for (const f of node.folders) {
      const name = parent ? f.slice(parent.length + 1) : f;
      const open = expanded.has(f);
      out.push({ type: 'folder', path: f, name, depth, open });
      if (open) walk(f, depth + 1);
    }
    for (const fp of node.files) {
      const name = parent ? fp.slice(parent.length + 1) : fp;
      out.push({
        type: 'file',
        path: fp,
        name,
        depth,
        modified: files[fp].modified,
        current: fp === currentPath,
      });
    }
  }
  walk('', 0);
  return out;
}

function FolderChevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={9} height={9} viewBox="0 0 9 9" fill="none"
      style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
      <Path d="M2.5 1.5L6 4.5L2.5 7.5"
        stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function FileGlyph({ color }: { color: string }) {
  return (
    <Svg width={11} height={14} viewBox="0 0 11 14" fill="none">
      <Path d="M1 1h6l3 3v9H1z" stroke={color} strokeWidth={1.2} />
      <Path d="M7 1v3h3" stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}

export default function FilesScreen() {
  const t = useTheme();
  const router = useRouter();
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
    await openFile(path);
    router.push('/(tabs)/edit');
  }

  if (!manifest) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: t.fgMuted }]}>No repo loaded</Text>
        </View>
      </SafeAreaView>
    );
  }

  const repoLeaf = manifest.repo.split('/').slice(-1)[0];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: t.fgDim }]}>Workspace</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: t.fg }]} numberOfLines={1}>{repoLeaf}</Text>
            <Text style={[styles.headerMeta, { color: t.fgMuted }]}>
              {' · '}{fileCount} files
              {modifiedCount > 0 ? ` · ${modifiedCount} modified` : ''}
            </Text>
          </View>
          <Text style={[styles.headerSub, { color: t.fgDim, fontFamily: t.fontMono }]}>
            {manifest.repo} · {manifest.branch}
          </Text>
        </View>

        <View style={styles.searchWrap}>
          <Surface style={styles.searchPill} radius={22}>
            <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <Path d="M6 10A4 4 0 106 2a4 4 0 000 8zM9.5 9.5L13 13"
                stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
            </Svg>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Filter files…"
              placeholderTextColor={t.fgDim}
              style={[styles.searchInput, { color: t.fg }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Surface>
        </View>

        {recents.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionPad, { color: t.fgDim }]}>
              Recent
            </Text>
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
                    <Surface style={styles.recentCard} radius={14}>
                      <View style={styles.recentHead}>
                        <Text style={[styles.recentName, { color: t.fg }]} numberOfLines={1}>
                          {name}
                        </Text>
                        {r.modified && (
                          <View style={[styles.dirtyDot, { backgroundColor: t.accent }]} />
                        )}
                      </View>
                      <Text
                        style={[styles.recentPath, { color: t.fgDim, fontFamily: t.fontMono }]}
                        numberOfLines={1}
                      >
                        {dir || './'}
                      </Text>
                    </Surface>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <View style={styles.treeLabelRow}>
          <Text style={[styles.sectionLabel, { color: t.fgDim }]}>
            {q ? 'Matches' : 'Files'}
          </Text>
          <Text style={[styles.treeAction, { color: t.fgDim }]}>
            {q ? `${tree.length} match${tree.length === 1 ? '' : 'es'}` : 'tap folder to expand'}
          </Text>
        </View>

        <View style={styles.treeWrap}>
          <Surface style={styles.treeCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {tree.length === 0 && (
                <Text style={[styles.emptyTreeText, { color: t.fgDim }]}>
                  {q ? 'No files match' : 'Empty repo'}
                </Text>
              )}
              {tree.map((row, i) => (
                <TouchableOpacity
                  key={`${row.type}:${row.path}:${i}`}
                  activeOpacity={0.7}
                  style={[
                    styles.treeRow,
                    {
                      paddingLeft: 14 + row.depth * 16,
                      backgroundColor: row.type === 'file' && row.current
                        ? (t.glass ? 'rgba(255,255,255,0.06)'
                          : t.light ? 'rgba(9,105,218,0.06)'
                          : 'rgba(217,119,87,0.10)')
                        : 'transparent',
                      borderBottomColor: t.borderColor,
                    },
                    i < tree.length - 1 && styles.treeRowBorder,
                  ]}
                  onPress={() => {
                    if (row.type === 'folder') toggleFolder(row.path);
                    else handleFileTap(row.path);
                  }}
                >
                  {row.type === 'file' && row.current && (
                    <View style={[styles.activeBar, { backgroundColor: t.accent }]} />
                  )}
                  {row.type === 'folder'
                    ? (
                      <View style={styles.chevron}>
                        <FolderChevron open={row.open} color={t.fgMuted} />
                      </View>
                    )
                    : <View style={styles.chevronPlaceholder} />
                  }
                  <FileGlyph color={t.fgMuted} />

                  <Text
                    style={[
                      styles.treeName,
                      { fontFamily: t.fontMono },
                      {
                        color: row.type === 'folder' || (row.type === 'file' && row.current) ? t.fg : t.fgMuted,
                        fontWeight: row.type === 'folder' || (row.type === 'file' && row.current) ? '600' : '400',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {row.type === 'folder' ? row.name + '/' : row.name}
                  </Text>

                  {row.type === 'file' && row.modified && (
                    <View style={[styles.dirtyDot, { backgroundColor: t.accent }]} />
                  )}
                </TouchableOpacity>
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
  container: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14 },

  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  eyebrow: {
    fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
    fontWeight: '600',
  },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  headerTitle: {
    fontSize: 28, fontWeight: '700', letterSpacing: -0.6, flexShrink: 1,
  },
  headerMeta: { fontSize: 13 },
  headerSub: { fontSize: 11, marginTop: 2 },

  searchWrap: { marginHorizontal: 16, marginVertical: 10 },
  searchPill: {
    height: 44, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 13.5 },

  sectionLabel: {
    fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600',
  },
  sectionPad: { paddingHorizontal: 24, marginTop: 6, marginBottom: 6 },

  recentsRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  recentCard: {
    minWidth: 150,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 2,
  },
  recentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentName: { fontSize: 13, fontWeight: '600', flex: 1 },
  recentPath: { fontSize: 11 },

  treeLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 10, marginBottom: 6,
  },
  treeAction: { fontSize: 11.5 },
  treeWrap: { flex: 1, marginHorizontal: 12, marginBottom: 110 },
  treeCard: { flex: 1, paddingVertical: 6 },
  emptyTreeText: { padding: 16, textAlign: 'center' },
  treeRow: {
    flexDirection: 'row', alignItems: 'center', paddingRight: 14,
    paddingVertical: 10, gap: 8, position: 'relative',
  },
  treeRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  activeBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
  },
  chevron: { width: 12, alignItems: 'center' },
  chevronPlaceholder: { width: 12 },
  treeName: { flex: 1, fontSize: 13.5 },
  dirtyDot: { width: 6, height: 6, borderRadius: 3 },
});
