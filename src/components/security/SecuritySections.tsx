import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { Tag } from '../ui/Tag';
import { SectionLabel } from '../ui/SectionLabel';
import { EmptyRow } from '../ui/EmptyRow';
import {
  selectSecurityView,
  type AuditEntryVM, type SecurityAssignmentVM, type SecurityProfileVM,
} from '../../lib/mirror/securityView';
import { relativeTime } from '../../lib/mirror/payload';

/**
 * The Security page body (#223): Audit activity · Profiles · Assignments,
 * read-only, fed by the `security` mirror domain. The desktop projector does
 * not publish that domain yet — until it does, `synced` is false and the
 * page leads with the "not yet published" card while keeping the section
 * structure visible (it fills in the moment the desktop starts pushing).
 */
export function SecuritySections({ data, synced }: { data: unknown; synced: boolean }) {
  const view = useMemo(() => selectSecurityView(synced ? data : undefined), [synced, data]);

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {!synced && <NotPublishedCard />}

      <SectionLabel>Audit activity</SectionLabel>
      {view.audit.length === 0 ? (
        <EmptyRow>No audit activity mirrored yet.</EmptyRow>
      ) : (
        view.audit.map((e) => <AuditRow key={e.id} entry={e} />)
      )}

      <SectionLabel style={styles.sectionGap}>Profiles</SectionLabel>
      {view.profiles.length === 0 ? (
        <EmptyRow>No agent profiles mirrored yet.</EmptyRow>
      ) : (
        view.profiles.map((p) => <ProfileRow key={p.id} profile={p} />)
      )}

      <SectionLabel style={styles.sectionGap}>Assignments</SectionLabel>
      {view.assignments.length === 0 ? (
        <EmptyRow>No profile assignments mirrored yet.</EmptyRow>
      ) : (
        view.assignments.map((a) => <AssignmentRow key={a.id} assignment={a} />)
      )}
    </ScrollView>
  );
}

function NotPublishedCard() {
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
      <Text style={[styles.noticeTitle, { color: t.fg }]}>
        Not yet published by the desktop
      </Text>
      <Text style={[styles.noticeDetail, { color: t.fgMuted }]}>
        The desktop doesn&apos;t push a security domain over the tunnel yet. This
        page is feed-ready — the sections below fill in the moment it does.
        Read-only, like everything here.
      </Text>
    </Surface>
  );
}

function AuditRow({ entry: e }: { entry: AuditEntryVM }) {
  const t = useTheme();
  return (
    <Surface style={styles.row} radius={8}>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{e.action}</Text>
          <Text style={[styles.when, { color: t.fgDim, fontFamily: t.fontMono }]}>
            {relativeTime(e.at)}
          </Text>
        </View>
        {(e.detail || e.actor) && (
          <Text style={[styles.meta, { color: t.fgMuted }]} numberOfLines={2}>
            {e.actor ? `${e.actor}${e.detail ? ' — ' : ''}` : ''}
            {e.detail ?? ''}
          </Text>
        )}
      </View>
    </Surface>
  );
}

function ProfileRow({ profile: p }: { profile: SecurityProfileVM }) {
  const t = useTheme();
  return (
    <Surface style={styles.row} radius={8}>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={[styles.name, { color: t.fg }]} numberOfLines={1}>{p.name}</Text>
          {p.role && <Tag color={t.accent}>{p.role}</Tag>}
        </View>
        {p.summary && (
          <Text style={[styles.meta, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
            {p.summary}
          </Text>
        )}
      </View>
    </Surface>
  );
}

function AssignmentRow({ assignment: a }: { assignment: SecurityAssignmentVM }) {
  const t = useTheme();
  return (
    <Surface style={styles.row} radius={8}>
      <View style={styles.assignmentLine}>
        <Text style={[styles.name, styles.assignmentSubject, { color: t.fg }]} numberOfLines={1}>
          {a.subject}
        </Text>
        <Text style={[styles.meta, { color: t.fgDim }]}>→</Text>
        <Text style={[styles.meta, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
          {a.profile}
        </Text>
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
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  when: { fontSize: 10.5 },
  meta: { fontSize: 11.5, lineHeight: 16 },
  assignmentLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assignmentSubject: { flex: undefined, flexShrink: 1 },
});
