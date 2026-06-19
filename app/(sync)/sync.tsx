import React, { useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { Surface } from '../../src/components/ui/Surface';
import { IconBtn } from '../../src/components/ui/IconBtn';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { Tag } from '../../src/components/ui/Tag';
import { PLAN_COLORS } from '../../src/lib/planner/colors';
import { usePlannerSync } from '../../src/lib/planner/PlannerSyncContext';
import type { ReconcileAction } from '../../src/lib/planner/sync/reconcile';
import {
  assembleText, assembleJson, conflictingFields, mergeElementFields,
  type TextChoice,
} from '../../src/lib/planner/sync/resolve';

type ConflictAction = Extract<ReconcileAction, { type: 'conflict' }>;
type Side = 'local' | 'remote';
type Obj = Record<string, unknown>;

const REMOTE_COLOR = PLAN_COLORS.info;

function useSides() {
  const t = useTheme();
  return {
    local: { color: t.accent, soft: `${t.accent}22`, line: t.accent, label: 'This device' },
    remote: { color: REMOTE_COLOR, soft: 'rgba(125,211,252,0.14)', line: REMOTE_COLOR, label: 'base-studio-code' },
  };
}

// ── Shared header ──────────────────────────────────────────────────────────────
function Header({ title, sub, onBack, right }: {
  title: string; sub?: string; onBack: () => void; right?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
      <IconBtn onPress={onBack}>
        <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
          <Path d="M9 3L5 7l4 4" stroke={t.fg} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </IconBtn>
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: t.fg }]} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[styles.headerSub, { color: t.fgDim, fontFamily: t.fontMono }]} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

// ── A pick-a-side option card ────────────────────────────────────────────────
function SideCard({ side, selected, onPress, children }: {
  side: Side; selected: boolean; onPress: () => void; children: React.ReactNode;
}) {
  const t = useTheme();
  const s = useSides()[side];
  return (
    <Pressable
      onPress={onPress}
      style={[styles.sideCard, {
        backgroundColor: selected ? s.soft : t.surface,
        borderColor: selected ? s.line : t.borderColor,
      }]}
    >
      <View style={styles.sideHead}>
        <Text style={[styles.sideLabel, { color: s.color, fontFamily: t.fontMono }]}>{s.label}</Text>
        <View style={[styles.radio, { borderColor: selected ? s.color : t.borderColor, backgroundColor: selected ? s.color : 'transparent' }]}>
          {selected && (
            <Svg width={9} height={9} viewBox="0 0 10 10" fill="none">
              <Path d="M2 5l2 2 4-5" stroke="#16121d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </View>
      </View>
      <Text style={[styles.sideBody, { color: t.fg, fontFamily: t.fontMono }]}>{children}</Text>
    </Pressable>
  );
}

// ── diff3 (markdown) resolver ──────────────────────────────────────────────────
function Diff3Resolver({ action, onResolve }: { action: ConflictAction; onResolve: (content: string) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const merge = action.result.kind === 'text' ? action.result.merge : null;
  const hunks = useMemo(
    () => (merge ? merge.regions.filter((r): r is { type: 'conflict'; mine: string[]; theirs: string[] } => r.type === 'conflict') : []),
    [merge],
  );
  const [choices, setChoices] = useState<Record<number, TextChoice>>({});
  const allChosen = hunks.every((_, i) => choices[i] !== undefined);

  function done() {
    if (!merge) return;
    onResolve(assembleText(merge, hunks.map((_, i) => choices[i] ?? 'mine')));
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lead, { color: t.fgMuted }]}>
          {hunks.length} overlapping {hunks.length === 1 ? 'section' : 'sections'} — pick a side (or keep both) for each.
        </Text>
        {hunks.map((h, i) => (
          <View key={i} style={styles.hunk}>
            <Text style={[styles.hunkLabel, { color: PLAN_COLORS.warn, fontFamily: t.fontMono }]}>HUNK {i + 1}</Text>
            <SideCard side="local" selected={choices[i] === 'mine'} onPress={() => setChoices((c) => ({ ...c, [i]: 'mine' }))}>
              {h.mine.join('\n') || '(empty)'}
            </SideCard>
            <SideCard side="remote" selected={choices[i] === 'theirs'} onPress={() => setChoices((c) => ({ ...c, [i]: 'theirs' }))}>
              {h.theirs.join('\n') || '(empty)'}
            </SideCard>
            <Pressable
              onPress={() => setChoices((c) => ({ ...c, [i]: 'both' }))}
              style={[styles.bothBtn, { borderColor: choices[i] === 'both' ? t.accent : t.borderColor, backgroundColor: choices[i] === 'both' ? `${t.accent}1f` : 'transparent' }]}
            >
              <Text style={[styles.bothText, { color: t.fg }]}>Keep both</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Footer>
        <PrimaryButton label="Resolve file" onPress={done} disabled={!allChosen} style={{ opacity: allChosen ? 1 : 0.5 }} />
      </Footer>
    </View>
  );
}

// ── by-id (structured JSON) resolver ───────────────────────────────────────────
function ByIdResolver({ action, onResolve }: { action: ConflictAction; onResolve: (content: string) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const merge = action.result.kind === 'json' ? action.result.merge : null;
  const conflicts = useMemo(
    () => (merge ? merge.entries.filter((e): e is { id: string; type: 'conflict'; mine: Obj | null; theirs: Obj | null } => e.type === 'conflict') : []),
    [merge],
  );
  // field choices per id; for delete-vs-edit, a 'keep'/'drop' decision per id.
  const [fieldPicks, setFieldPicks] = useState<Record<string, Record<string, 'mine' | 'theirs'>>>({});
  const [keepDrop, setKeepDrop] = useState<Record<string, 'keep' | 'drop'>>({});

  function isResolved(c: typeof conflicts[number]): boolean {
    if (!c.mine || !c.theirs) return keepDrop[c.id] !== undefined;
    return conflictingFields(c.mine, c.theirs).every((f) => fieldPicks[c.id]?.[f] !== undefined);
  }
  const allResolved = conflicts.every(isResolved);

  function done() {
    if (!merge) return;
    const resolved: Record<string, Obj | null> = {};
    for (const c of conflicts) {
      if (!c.mine || !c.theirs) {
        resolved[c.id] = keepDrop[c.id] === 'drop' ? null : (c.mine ?? c.theirs);
      } else {
        resolved[c.id] = mergeElementFields(c.mine, c.theirs, fieldPicks[c.id] ?? {});
      }
    }
    onResolve(assembleJson(merge, resolved));
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lead, { color: t.fgMuted }]}>
          {conflicts.length} item{conflicts.length === 1 ? '' : 's'} changed differently on both devices — resolve each by id.
        </Text>
        {conflicts.map((c) => (
          <Surface key={c.id} style={styles.idCard} radius={6}>
            <View style={styles.idHead}>
              <Text style={[styles.idText, { color: t.fg, fontFamily: t.fontMono }]}>id: {c.id}</Text>
              <Tag color={PLAN_COLORS.warn} bg={`${PLAN_COLORS.warn}22`} border={false}>same id</Tag>
            </View>
            {!c.mine || !c.theirs ? (
              // delete-vs-edit
              <View style={{ gap: 8 }}>
                <Text style={[styles.fieldLabel, { color: t.fgMuted }]}>
                  {c.mine ? 'Deleted on base-studio-code, edited here' : 'Deleted here, edited on base-studio-code'}
                </Text>
                <View style={styles.row}>
                  <Pressable onPress={() => setKeepDrop((k) => ({ ...k, [c.id]: 'keep' }))} style={[styles.choice, { borderColor: keepDrop[c.id] === 'keep' ? t.accent : t.borderColor }]}>
                    <Text style={[styles.choiceText, { color: keepDrop[c.id] === 'keep' ? t.accent : t.fgMuted }]}>Keep it</Text>
                  </Pressable>
                  <Pressable onPress={() => setKeepDrop((k) => ({ ...k, [c.id]: 'drop' }))} style={[styles.choice, { borderColor: keepDrop[c.id] === 'drop' ? PLAN_COLORS.bad : t.borderColor }]}>
                    <Text style={[styles.choiceText, { color: keepDrop[c.id] === 'drop' ? PLAN_COLORS.bad : t.fgMuted }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              conflictingFields(c.mine, c.theirs).map((f) => (
                <View key={f} style={{ gap: 7, marginTop: 4 }}>
                  <Text style={[styles.fieldLabel, { color: PLAN_COLORS.warn, fontFamily: t.fontMono }]}>{f}</Text>
                  <SideCard side="local" selected={fieldPicks[c.id]?.[f] === 'mine'} onPress={() => setFieldPicks((p) => ({ ...p, [c.id]: { ...p[c.id], [f]: 'mine' } }))}>
                    {JSON.stringify(c.mine![f])}
                  </SideCard>
                  <SideCard side="remote" selected={fieldPicks[c.id]?.[f] === 'theirs'} onPress={() => setFieldPicks((p) => ({ ...p, [c.id]: { ...p[c.id], [f]: 'theirs' } }))}>
                    {JSON.stringify(c.theirs![f])}
                  </SideCard>
                </View>
              ))
            )}
          </Surface>
        ))}
      </ScrollView>
      <Footer>
        <PrimaryButton label="Resolve file" onPress={done} disabled={!allResolved} style={{ opacity: allResolved ? 1 : 0.5 }} />
      </Footer>
    </View>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{children}</View>;
}

// ── The flow ───────────────────────────────────────────────────────────────────
export default function SyncScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { conflicts, resolveProject } = usePlannerSync();

  const pending = conflicts.find((c) => c.projectId === projectId);
  const [view, setView] = useState<'summary' | 'list' | 'resolve' | 'push' | 'insync'>('summary');
  const [activePath, setActivePath] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [pushing, setPushing] = useState(false);

  const actions = pending?.outcome.reconciliation.actions ?? [];
  const conflictActions = actions.filter((a): a is ConflictAction => a.type === 'conflict');
  const merged = actions.filter((a) => a.type === 'merged');
  const allResolved = conflictActions.every((a) => a.path in resolutions);
  const activeAction = conflictActions.find((a) => a.path === activePath);

  function exit() { router.back(); }

  async function doPush() {
    if (!pending) return;
    setPushing(true);
    try {
      await resolveProject(pending.projectId, resolutions);
      setView('insync');
    } catch (e) {
      console.warn('push failed:', (e as Error)?.message ?? e);
    } finally {
      setPushing(false);
    }
  }

  // In-sync renders without `pending` (it's been cleared by resolveProject).
  if (view === 'insync') {
    return (
      <View style={styles.flex}>
        <Header title="Sync" sub="base-studio-code" onBack={exit} />
        <View style={styles.center}>
          <View style={[styles.bigCheck, { borderColor: 'rgba(126,226,196,0.3)', backgroundColor: 'rgba(126,226,196,0.14)' }]}>
            <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
              <Path d="M11 20.5l6 6L30 12" stroke={PLAN_COLORS.good} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={[styles.bigTitle, { color: t.fg }]}>In sync</Text>
          <Text style={[styles.bigBody, { color: t.fgMuted }]}>
            Both devices now hold identical files and the same base. Re-running sync is a no-op.
          </Text>
        </View>
        <Footer><PrimaryButton label="Back to planner" onPress={exit} /></Footer>
      </View>
    );
  }

  if (!pending) {
    return (
      <View style={styles.flex}>
        <Header title="Sync" onBack={exit} />
        <View style={styles.center}>
          <Text style={[styles.bigBody, { color: t.fgDim }]}>Nothing to resolve.</Text>
        </View>
      </View>
    );
  }

  // ── Resolver view ──
  if (view === 'resolve' && activeAction) {
    const onResolve = (content: string) => {
      setResolutions((r) => ({ ...r, [activeAction.path]: content }));
      setView('list');
    };
    return (
      <View style={styles.flex}>
        <Header
          title={activeAction.path}
          sub={activeAction.result.kind === 'json' ? 'MERGE BY ID' : 'LINE DIFF3'}
          onBack={() => setView('list')}
        />
        {activeAction.result.kind === 'json'
          ? <ByIdResolver action={activeAction} onResolve={onResolve} />
          : <Diff3Resolver action={activeAction} onResolve={onResolve} />}
      </View>
    );
  }

  // ── Conflict list ──
  if (view === 'list') {
    const doneCount = conflictActions.filter((a) => a.path in resolutions).length;
    return (
      <View style={styles.flex}>
        <Header title="Resolve conflicts" sub={`${doneCount}/${conflictActions.length}`} onBack={() => setView('summary')} />
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.lead, { color: t.fgMuted }]}>
            Pick a side (or merge) for each overlapping edit. Only the merged result is pushed.
          </Text>
          {conflictActions.map((a) => {
            const resolved = a.path in resolutions;
            return (
              <Pressable key={a.path} onPress={() => { setActivePath(a.path); setView('resolve'); }}>
                <Surface style={[styles.fileRow, resolved && { borderColor: 'rgba(126,226,196,0.4)' }]} radius={6}>
                  <View style={[styles.fileIcon, { backgroundColor: resolved ? 'rgba(126,226,196,0.16)' : `${PLAN_COLORS.warn}22` }]}>
                    {resolved
                      ? <Svg width={15} height={15} viewBox="0 0 15 15" fill="none"><Path d="M3 7.5l3 3 6-7" stroke={PLAN_COLORS.good} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                      : <Svg width={14} height={14} viewBox="0 0 14 14" fill="none"><Path d="M7 4v3.5M7 10h.01M7 1.5l5.5 9.5h-11z" stroke={PLAN_COLORS.warn} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
                  </View>
                  <View style={styles.fileMain}>
                    <Text style={[styles.fileName, { color: t.fg, fontFamily: t.fontMono }]}>{a.path}</Text>
                    <Text style={[styles.fileMeta, { color: resolved ? PLAN_COLORS.good : t.fgMuted }]}>
                      {resolved ? 'Resolved' : a.result.kind === 'json' ? 'merge by id' : 'line diff3'}
                    </Text>
                  </View>
                  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none"><Path d="M6 4l4 4-4 4" stroke={t.fgDim} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                </Surface>
              </Pressable>
            );
          })}
        </ScrollView>
        <Footer>
          <PrimaryButton
            label={allResolved ? 'Review & push' : `Resolve ${conflictActions.length - doneCount} more`}
            onPress={() => allResolved && setView('push')}
            disabled={!allResolved}
            style={{ opacity: allResolved ? 1 : 0.5 }}
          />
        </Footer>
      </View>
    );
  }

  // ── Push review ──
  if (view === 'push') {
    return (
      <View style={styles.flex}>
        <Header title="Push merged plan" sub="base-studio-code" onBack={() => setView('list')} />
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
          <Surface style={styles.banner} radius={6}>
            <Text style={[styles.bannerTitle, { color: PLAN_COLORS.good }]}>All {conflictActions.length} conflicts resolved</Text>
            <Text style={[styles.bannerBody, { color: t.fgMuted }]}>Pushing the full canonical map for this project.</Text>
          </Surface>
          <Text style={[styles.section, { color: t.fgDim }]}>WHAT PUSH DOES</Text>
          <Surface style={styles.infoCard} radius={6}>
            {[
              'Replaces synced files on base-studio-code',
              'Sets the new base on both devices (idempotent)',
              'Keeps conversation & run state on each device',
            ].map((line) => (
              <View key={line} style={styles.infoRow}>
                <View style={[styles.dot, { backgroundColor: t.accent }]} />
                <Text style={[styles.infoText, { color: t.fgMuted }]}>{line}</Text>
              </View>
            ))}
          </Surface>
        </ScrollView>
        <Footer>
          <PrimaryButton label={pushing ? 'Pushing…' : 'Push to base-studio-code'} onPress={doPush} disabled={pushing} style={{ opacity: pushing ? 0.6 : 1 }} />
        </Footer>
      </View>
    );
  }

  // ── Reconcile summary (default) ──
  return (
    <View style={styles.flex}>
      <Header
        title={pending.local.title}
        sub="SYNC · base-studio-code"
        onBack={exit}
        right={<Text style={[styles.linked, { color: PLAN_COLORS.good, fontFamily: t.fontMono }]}>linked</Text>}
      />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.statRow}>
          {([[actions.length, 'compared', t.fgMuted], [merged.length, 'auto-merged', PLAN_COLORS.good], [conflictActions.length, 'to resolve', PLAN_COLORS.warn]] as const).map((s, i) => (
            <Surface key={i} style={styles.statCard} radius={6}>
              <Text style={[styles.statNum, { color: s[2], fontFamily: t.fontMono }]}>{s[0]}</Text>
              <Text style={[styles.statLabel, { color: t.fgMuted }]}>{s[1]}</Text>
            </Surface>
          ))}
        </View>

        {conflictActions.length > 0 && (
          <>
            <Text style={[styles.section, { color: PLAN_COLORS.warn }]}>NEEDS YOUR DECISION</Text>
            <Surface style={[styles.listCard, { borderColor: `${PLAN_COLORS.warn}4d` }]} radius={6}>
              {conflictActions.map((a, i) => (
                <View key={a.path} style={[styles.miniRow, i > 0 && { borderTopColor: t.borderColor, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[styles.miniName, { color: t.fg, fontFamily: t.fontMono }]}>{a.path}</Text>
                  <Text style={[styles.miniMeta, { color: t.fgDim }]}>{a.result.kind === 'json' ? 'merge by id' : 'line diff3'}</Text>
                </View>
              ))}
            </Surface>
          </>
        )}

        {merged.length > 0 && (
          <>
            <Text style={[styles.section, { color: PLAN_COLORS.good }]}>AUTO-MERGED · NO ACTION</Text>
            <Surface style={styles.listCard} radius={6}>
              {merged.map((a, i) => (
                <View key={a.path} style={[styles.miniRow, i > 0 && { borderTopColor: t.borderColor, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Svg width={13} height={13} viewBox="0 0 14 14" fill="none"><Path d="M2.5 7.5l3 3 6-7" stroke={PLAN_COLORS.good} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                  <Text style={[styles.miniName, { color: t.fgMuted, fontFamily: t.fontMono, flex: 1, marginLeft: 8 }]}>{a.path}</Text>
                </View>
              ))}
            </Surface>
          </>
        )}

        <Text style={[styles.note, { color: t.fgDim }]}>
          Your conversation and pipeline run states stay on this device — only plan files and structure sync.
        </Text>
      </ScrollView>
      <Footer>
        {conflictActions.length > 0
          ? <PrimaryButton label={`Resolve ${conflictActions.length} conflicts`} onPress={() => setView('list')} />
          : <PrimaryButton label="Done — in sync" onPress={exit} />}
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSub: { fontSize: 9.5, letterSpacing: 0.3, marginTop: 1 },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },
  linked: { fontSize: 10.5 },

  body: { paddingHorizontal: 14, paddingTop: 14, gap: 12 },
  lead: { fontSize: 13, lineHeight: 19 },
  footer: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },

  statRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statNum: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },

  section: { fontSize: 10.5, letterSpacing: 1, fontWeight: '700', marginTop: 4 },
  listCard: { padding: 0, overflow: 'hidden' },
  miniRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  miniName: { fontSize: 13, fontWeight: '500' },
  miniMeta: { fontSize: 11, marginLeft: 'auto' },
  note: { fontSize: 11.5, lineHeight: 16, marginTop: 4 },

  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  fileIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fileMain: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileMeta: { fontSize: 11.5, marginTop: 2 },

  sideCard: { borderWidth: 1.5, borderRadius: 6, padding: 11 },
  sideHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sideLabel: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3, flex: 1 },
  radio: { width: 16, height: 16, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sideBody: { fontSize: 11.5, lineHeight: 18 },

  hunk: { gap: 8 },
  hunkLabel: { fontSize: 10, letterSpacing: 0.6, fontWeight: '700' },
  bothBtn: { height: 36, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bothText: { fontSize: 12.5, fontWeight: '500' },

  idCard: { padding: 13, gap: 8 },
  idHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idText: { fontSize: 13, fontWeight: '600', flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, height: 36, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 12.5, fontWeight: '600' },

  banner: { padding: 14, gap: 4 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerBody: { fontSize: 12.5, lineHeight: 18 },
  infoCard: { padding: 13, gap: 9 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  infoText: { fontSize: 12.5, lineHeight: 17, flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
  bigCheck: { width: 88, height: 88, borderRadius: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  bigTitle: { fontSize: 22, fontWeight: '700' },
  bigBody: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
});
