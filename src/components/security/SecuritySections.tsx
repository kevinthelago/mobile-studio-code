import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type Theme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { SectionLabel } from '../ui/SectionLabel';
import { EmptyRow } from '../ui/EmptyRow';
import {
  selectSecurityView,
  type AuditEntryVM, type AuditKind,
  type SecurityAssignmentVM, type SecurityProfileVM,
} from '../../lib/mirror/securityView';
import { clockTime, relativeTime } from '../../lib/mirror/payload';

/**
 * The Security page body (#223, rewired #237): Profiles · Assignments · Audit
 * activity, read-only, fed by the `security` mirror domain.
 *
 * Profiles lead because they are the permission MODEL — the base policy, the
 * command allowlist, the per-tool tri-states, and the filesystem/network scope
 * a pane runs under. Each row drills in to the full picture; the summary line
 * alone cannot answer "what can this agent actually do".
 *
 * What is deliberately NOT here: the desktop Activity table's allow/ask/block
 * decision column. That verdict is derived from desktop-only policy resolution,
 * and re-deriving it on the phone would create a second source of truth for a
 * security decision. It arrives when the desktop sends it (see #237).
 */
export function SecuritySections({ data, synced }: { data: unknown; synced: boolean }) {
  const view = useMemo(() => selectSecurityView(synced ? data : undefined), [synced, data]);

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {!synced && <AwaitingSyncCard />}

      <SectionLabel>Profiles</SectionLabel>
      {view.profiles.length === 0 ? (
        <EmptyRow>No agent profiles mirrored yet.</EmptyRow>
      ) : (
        view.profiles.map((p) => <ProfileRow key={p.id} profile={p} />)
      )}

      <SectionLabel style={styles.sectionGap}>Assignments</SectionLabel>
      {view.assignments.length === 0 ? (
        <EmptyRow>No panes running — assignments appear when a fleet launches.</EmptyRow>
      ) : (
        view.assignments.map((a) => <AssignmentRow key={a.id} assignment={a} />)
      )}

      <SectionLabel style={styles.sectionGap}>Audit activity</SectionLabel>
      {view.audit.length === 0 ? (
        <EmptyRow>No audit activity mirrored yet.</EmptyRow>
      ) : (
        view.audit.map((e) => <AuditRow key={e.id} entry={e} />)
      )}
    </ScrollView>
  );
}

/**
 * Shown until the first `security` frame lands. The desktop has published this
 * domain since base-studio-code#2530, so the honest reading of an empty view is
 * "not received yet" (unpaired, or the desktop has not pushed since connect) —
 * NOT "the desktop doesn't support it", which is what this card used to claim.
 */
function AwaitingSyncCard() {
  const t = useTheme();
  return (
    <Surface style={styles.notice} radius={10}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6l7-3z"
          stroke={t.accent} strokeWidth={1.5} strokeLinejoin="round"
        />
        <Path d="M9 12l2 2 4-4" stroke={t.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={[styles.noticeTitle, { color: t.fg }]}>Awaiting sync</Text>
      <Text style={[styles.noticeDetail, { color: t.fgMuted }]}>
        Waiting for the desktop to push its security state — profiles, pane
        assignments, and recent audit activity. Read-only, like everything here.
      </Text>
    </Surface>
  );
}

// ── profiles ─────────────────────────────────────────────────────────────────

/** deny < ask < allow, coloured on the shared tone convention. */
function tierColor(t: Theme, tier: string): string {
  if (tier === 'allow') return t.code.ty;
  if (tier === 'ask') return t.code.nm;
  if (tier === 'deny') return '#ff6b6b';
  return t.fgMuted;
}

function ProfileRow({ profile: p }: { profile: SecurityProfileVM }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Surface style={styles.row} radius={8}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button">
        <View style={styles.text}>
          <View style={styles.titleLine}>
            <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{p.name}</Text>
            {p.mode && <Tag color={tierColor(t, p.mode)} dot={tierColor(t, p.mode)}>{p.mode}</Tag>}
            <Text style={[styles.chevron, { color: t.fgDim }]}>{open ? '▾' : '▸'}</Text>
          </View>
          {p.desc && (
            <Text style={[styles.desc, { color: t.fgMuted }]} numberOfLines={open ? undefined : 2}>
              {p.desc}
            </Text>
          )}
          <View style={styles.titleLine}>
            <Text style={[styles.meta, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
              {p.summary ?? 'no capabilities listed'}
            </Text>
            <Text style={[styles.origin, { color: t.fgDim, fontFamily: t.fontMono }]}>
              {[p.category, p.builtin ? 'built-in' : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      </Pressable>

      {open && <ProfileDetail profile={p} />}
    </Surface>
  );
}

/**
 * The permission model in full. Tools are rendered in wire order rather than
 * against a hardcoded key list — the desktop's `TOOL_DEFS` order already ships
 * that way, and iterating the record means a new tool key appears here on the
 * day it appears on the wire instead of being silently dropped.
 */
function ProfileDetail({ profile: p }: { profile: SecurityProfileVM }) {
  const t = useTheme();
  const tools = Object.entries(p.tools);

  return (
    <View style={[styles.detail, { borderTopColor: t.borderColor }]}>
      <DetailLabel>Base policy</DetailLabel>
      <Text style={[styles.detailBody, { color: t.fgMuted }]}>
        Anything not listed below is{' '}
        <Text style={{ color: tierColor(t, p.mode ?? ''), fontFamily: t.fontMono }}>
          {p.mode ?? 'unspecified'}
        </Text>
        .
      </Text>

      <DetailLabel>Shell commands</DetailLabel>
      {p.commands.length === 0 ? (
        <Text style={[styles.detailBody, { color: t.fgDim }]}>None — no profile-scoped commands.</Text>
      ) : (
        <View style={styles.chips}>
          {p.commands.map((c) => <Tag key={c}>{c}</Tag>)}
        </View>
      )}

      <DetailLabel>Tools</DetailLabel>
      {tools.length === 0 ? (
        <Text style={[styles.detailBody, { color: t.fgDim }]}>None mirrored.</Text>
      ) : (
        <View style={styles.toolTable}>
          {tools.map(([key, tier]) => (
            <View key={key} style={styles.toolRow}>
              <Text style={[styles.toolKey, { color: t.fg, fontFamily: t.fontMono }]}>{key}</Text>
              <Text style={[styles.toolTier, { color: tierColor(t, tier), fontFamily: t.fontMono }]}>
                {tier}
              </Text>
            </View>
          ))}
        </View>
      )}

      <DetailLabel>Filesystem</DetailLabel>
      <GlobList label="allow" globs={p.paths.allow} empty="none — read-only" color={t.code.ty} />
      <GlobList label="deny" globs={p.paths.deny} empty="none" color="#ff6b6b" />

      <DetailLabel>Network</DetailLabel>
      <Text style={[styles.detailBody, { color: t.fgMuted, fontFamily: t.fontMono }]}>
        {p.net.length === 0
          ? 'none — no outbound hosts'
          : p.net.includes('*') ? '* — all hosts' : p.net.join(', ')}
      </Text>
    </View>
  );
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.detailLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>{children}</Text>;
}

function GlobList({
  label, globs, empty, color,
}: { label: string; globs: string[]; empty: string; color: string }) {
  const t = useTheme();
  return (
    <View style={styles.globLine}>
      <Text style={[styles.globLabel, { color, fontFamily: t.fontMono }]}>{label}</Text>
      <Text style={[styles.detailBody, styles.globValue, { color: globs.length === 0 ? t.fgDim : t.fgMuted, fontFamily: t.fontMono }]}>
        {globs.length === 0 ? empty : globs.join('  ')}
      </Text>
    </View>
  );
}

// ── assignments ──────────────────────────────────────────────────────────────

function AssignmentRow({ assignment: a }: { assignment: SecurityAssignmentVM }) {
  const t = useTheme();
  return (
    <Surface style={styles.row} radius={8}>
      <View style={styles.assignmentLine}>
        <Text style={[styles.pane, { color: t.fg, fontFamily: t.fontMono }]}>{a.pane}</Text>
        {a.role && <Tag color={t.accent}>{a.role}</Tag>}
        <Text style={[styles.meta, { color: t.fgDim }]}>→</Text>
        <Text
          style={[styles.meta, styles.assignmentProfile, {
            color: a.profile ? t.fgMuted : t.fgDim, fontFamily: t.fontMono,
          }]}
          numberOfLines={1}
        >
          {a.profile ?? 'no profile'}
        </Text>
      </View>
    </Surface>
  );
}

// ── audit ────────────────────────────────────────────────────────────────────

const KIND_GLYPH: Record<AuditKind, string> = { cmd: '$', net: '↗', tool: '⌘' };

function kindColor(t: Theme, kind: AuditKind): string {
  if (kind === 'cmd') return t.code.nm;
  if (kind === 'net') return t.code.fn;
  return t.fgMuted;
}

function AuditRow({ entry: e }: { entry: AuditEntryVM }) {
  const t = useTheme();
  return (
    <Surface style={styles.row} radius={8}>
      <View style={styles.auditLine}>
        <Text style={[styles.glyph, { color: kindColor(t, e.kind), fontFamily: t.fontMono }]}>
          {KIND_GLYPH[e.kind]}
        </Text>
        <View style={[styles.text, styles.auditText]}>
          <View style={styles.titleLine}>
            {/* `target` is redacted desktop-side and may legitimately be empty —
                the tool name is always present, so the row is never blank. */}
            <Text style={[styles.name, { color: t.fg, fontFamily: t.fontMono }]} numberOfLines={2}>
              {e.target || e.toolName}
            </Text>
            <Text style={[styles.when, { color: t.fgDim, fontFamily: t.fontMono }]}>
              {/* An unparseable `ts` still shows its raw wire value. */}
              {e.at === null ? e.ts : clockTime(e.at)}
            </Text>
          </View>
          <Text style={[styles.meta, { color: t.fgMuted }]} numberOfLines={1}>
            {e.pane} · {e.toolName}
            {e.at === null ? '' : ` · ${relativeTime(e.at)}`}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 28 },
  sectionGap: { marginTop: 14 },

  notice: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  noticeTitle: { fontSize: 14.5, fontWeight: '600' },
  noticeDetail: { fontSize: 12, lineHeight: 17, textAlign: 'center' },

  row: { paddingVertical: 12, paddingHorizontal: 14 },
  text: { gap: 4 },
  /** Only the audit row needs the text column to share width with the glyph. */
  auditText: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  desc: { fontSize: 11.5, lineHeight: 16 },
  when: { fontSize: 10.5 },
  meta: { fontSize: 11.5, lineHeight: 16 },
  origin: { fontSize: 10, letterSpacing: 0.3 },
  chevron: { fontSize: 11 },

  detail: {
    marginTop: 12, paddingTop: 12, gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  detailBody: { fontSize: 11.5, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  toolTable: { gap: 2 },
  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolKey: { fontSize: 11.5 },
  toolTier: { fontSize: 11.5 },

  globLine: { flexDirection: 'row', gap: 8 },
  globLabel: { fontSize: 10.5, width: 38, paddingTop: 2 },
  globValue: { flex: 1 },

  assignmentLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pane: { fontSize: 12.5, fontWeight: '600' },
  assignmentProfile: { flexShrink: 1 },

  auditLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  glyph: { fontSize: 13, width: 14, textAlign: 'center', paddingTop: 1 },
});
