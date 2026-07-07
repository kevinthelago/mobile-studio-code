import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, type Theme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { SectionLabel } from '../ui/SectionLabel';
import { EmptyRow } from '../ui/EmptyRow';
import {
  selectAutomationsView,
  type AutomationVM, type HookVM, type RunStatus,
} from '../../lib/mirror/automationsView';
import { relativeTime } from '../../lib/mirror/payload';

const GOOD = '#4ade80';
const BAD = '#f87171';

function statusGlyph(status: RunStatus, t: Theme): { glyph: string; color: string } {
  switch (status) {
    case 'ok': return { glyph: '✓', color: GOOD };       // ✓
    case 'fail': return { glyph: '✕', color: BAD };      // ✕
    case 'skipped': return { glyph: '○', color: t.fgMuted }; // ○
    default: return { glyph: '·', color: t.fgDim };      // ·
  }
}

/**
 * The Automations segment (#223): schedule cards with their recent run
 * history, plus the hooks list. Display-only — arming, editing, and firing
 * all happen on the desktop (or via chat).
 */
export function AutomationsSegment({ data }: { data: unknown }) {
  const t = useTheme();
  const view = useMemo(() => selectAutomationsView(data), [data]);

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      <SectionLabel>Schedules</SectionLabel>
      {view.automations.length === 0 ? (
        <EmptyRow>No automations defined on the desktop yet.</EmptyRow>
      ) : (
        view.automations.map((a) => <AutomationCard key={a.id} automation={a} />)
      )}

      <SectionLabel style={styles.sectionGap}>Hooks</SectionLabel>
      {view.hasSystemFloor && (
        <Text style={[styles.floorNote, { color: t.fgMuted }]}>
          Built-in hooks are the desktop&apos;s system floor — always on, under every
          permission posture.
        </Text>
      )}
      {view.hooks.length === 0 ? (
        <EmptyRow>No hooks configured on the desktop yet.</EmptyRow>
      ) : (
        view.hooks.map((h) => <HookRow key={h.id} hook={h} />)
      )}
    </ScrollView>
  );
}

function AutomationCard({ automation: a }: { automation: AutomationVM }) {
  const t = useTheme();
  return (
    <Surface style={styles.card} radius={8}>
      <View style={styles.titleLine}>
        <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{a.name}</Text>
        {/* Read-only armed pill — deliberately NOT a toggle (mutations via chat). */}
        <Tag dot={a.armed ? GOOD : undefined} color={a.armed ? t.fg : t.fgDim}>
          {a.armed ? 'armed' : 'off'}
        </Tag>
      </View>

      <Text style={[styles.when, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
        {a.whenLabel}
        {a.targetLabel ? `  → ${a.targetLabel}` : ''}
      </Text>

      <Text style={[styles.timing, { color: t.fgDim }]} numberOfLines={1}>
        {a.nextRunAt !== null ? `next ${relativeTime(a.nextRunAt)}` : 'no next run'}
        {a.lastRunAt !== null ? `  ·  last ${relativeTime(a.lastRunAt)}` : ''}
      </Text>

      {a.runs.length > 0 && (
        <View style={[styles.runs, { borderTopColor: t.borderColor }]}>
          {a.runs.map((run, i) => {
            const s = statusGlyph(run.status, t);
            return (
              <View key={`${run.at ?? 'x'}-${i}`} style={styles.runLine}>
                <Text style={[styles.runGlyph, { color: s.color, fontFamily: t.fontMono }]}>
                  {s.glyph}
                </Text>
                <Text style={[styles.runWhen, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                  {relativeTime(run.at)}
                </Text>
                <Text style={[styles.runNote, { color: t.fgDim }]} numberOfLines={1}>
                  {run.note}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Surface>
  );
}

function HookRow({ hook: h }: { hook: HookVM }) {
  const t = useTheme();
  return (
    <Surface style={styles.hookRow} radius={8}>
      <View style={styles.hookText}>
        <View style={styles.titleLine}>
          <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{h.name}</Text>
          {h.builtin && <Tag color={t.accent}>built-in</Tag>}
        </View>
        <Text style={[styles.hookMeta, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
          {h.event}
          {h.matcher ? ` · ${h.matcher}` : ''}
          {` · ${h.scopeLabel}`}
        </Text>
      </View>
      <Tag dot={h.enabled ? GOOD : undefined} color={h.enabled ? t.fg : t.fgDim}>
        {h.enabled ? 'on' : 'off'}
      </Tag>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 28 },
  sectionGap: { marginTop: 14 },
  floorNote: { fontSize: 11.5, lineHeight: 16 },

  card: { padding: 14, gap: 6 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
  when: { fontSize: 11.5 },
  timing: { fontSize: 11 },

  runs: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  runLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runGlyph: { width: 14, fontSize: 11, textAlign: 'center' },
  runWhen: { fontSize: 10.5, minWidth: 64 },
  runNote: { flex: 1, fontSize: 11 },

  hookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  hookText: { flex: 1, gap: 4 },
  hookMeta: { fontSize: 10.5 },
});
