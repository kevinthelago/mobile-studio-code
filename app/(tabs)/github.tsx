import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useSession } from '../../src/lib/session';
import { Surface } from '../../src/components/ui/Surface';
import {
  fetchRepoPulse,
  type RepoPulseLive,
  type VelocitySlice,
  DEFAULT_PULSE_COLORS,
  type PulseColors,
} from '../../src/lib/githubPulse';
import {
  cachedGithubGet,
  GithubAuthError,
  GithubRateLimitError,
  GithubOfflineError,
} from '../../src/lib/githubCache';
import {
  LineAreaChart,
  HBars,
  Ring,
  StatGrid,
  SectionHead,
  type Stat,
  type HBarItem,
} from '../../src/components/github/charts';

// ── Types ─────────────────────────────────────────────────────────────────────

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: RepoPulseLive; refreshing: boolean }
  | { status: 'auth-error' }
  | { status: 'rate-limit'; resetAt: number | null }
  | { status: 'offline' }
  | { status: 'error'; message: string };

interface GhRepoInfo {
  default_branch: string;
  description: string | null;
  language: string | null;
  pushed_at: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function loadPulse(
  pat: string,
  slug: string,
  colors: PulseColors,
): Promise<RepoPulseLive> {
  const info = await cachedGithubGet<GhRepoInfo>(pat, `repos/${slug}`);
  return fetchRepoPulse(pat, slug, info.default_branch, info, colors);
}

// ── Screen ────────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const CONTENT_W = SCREEN_W - 32; // 16pt padding each side

export default function GithubScreen() {
  const t = useTheme();
  const { pat, manifest } = useSession();
  const [state, setState] = useState<FetchState>({ status: 'idle' });

  const colors: PulseColors = {
    accent:  t.accent,
    info:    t.accent2,
    success: t.code.ty,
    warn:    t.code.nm,
    extra1:  t.code.kw,
    extra2:  t.fgDim,
  };

  const load = useCallback(
    async (isRefresh = false) => {
      if (!pat || !manifest?.repo) return;
      if (isRefresh) {
        setState((s) =>
          s.status === 'success' ? { ...s, refreshing: true } : { status: 'loading' },
        );
      } else {
        setState({ status: 'loading' });
      }
      try {
        const data = await loadPulse(pat, manifest.repo, colors);
        setState({ status: 'success', data, refreshing: false });
      } catch (e: unknown) {
        if (e instanceof GithubAuthError) {
          setState({ status: 'auth-error' });
        } else if (e instanceof GithubRateLimitError) {
          setState({ status: 'rate-limit', resetAt: e.resetAt });
        } else if (e instanceof GithubOfflineError) {
          setState({ status: 'offline' });
        } else {
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pat, manifest?.repo],
  );

  useEffect(() => {
    if (pat && manifest?.repo) {
      load(false);
    } else {
      setState({ status: 'idle' });
    }
  }, [pat, manifest?.repo, load]);

  // ── Empty / error states ────────────────────────────────────────────────────

  if (!pat) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
        <View style={styles.centered}>
          <Text style={[styles.emptyIcon, { color: t.fgDim }]}>⚙</Text>
          <Text style={[styles.emptyTitle, { color: t.fg }]}>No GitHub connection</Text>
          <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
            Add your GitHub PAT in Settings to see repo analytics.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!manifest?.repo) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
        <View style={styles.centered}>
          <Text style={[styles.emptyIcon, { color: t.fgDim }]}>◎</Text>
          <Text style={[styles.emptyTitle, { color: t.fg }]}>No repo selected</Text>
          <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
            Clone a repo from the Git tab to view its Pulse analytics.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={t.accent} />
          <Text style={[styles.loadingText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
            Loading Pulse…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'auth-error') {
    return <ErrorView icon="⚠" title="Authorization failed"
      body="Your GitHub PAT is invalid or expired. Reset it in Settings."
      t={t} />;
  }

  if (state.status === 'rate-limit') {
    const reset = state.resetAt
      ? new Date(state.resetAt).toLocaleTimeString()
      : 'soon';
    return <ErrorView icon="⏱" title="Rate limit exceeded"
      body={`GitHub rate limit hit. Try again at ${reset}.`}
      t={t} />;
  }

  if (state.status === 'offline') {
    return <ErrorView icon="◌" title="No connection"
      body="Check your internet connection and pull to refresh."
      t={t} />;
  }

  if (state.status === 'error') {
    return <ErrorView icon="!" title="Couldn't load data"
      body={state.message}
      t={t} />;
  }

  if (state.status === 'idle') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  const { data, refreshing } = state;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={t.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <PulseHeader data={data} t={t} onRefresh={() => load(true)} />
        <KpiSection data={data} t={t} colors={colors} />
        <VelocitySection velocity={data.velocity} t={t} colors={colors} />
        <CiSection data={data} t={t} colors={colors} />
        <ChurnSection data={data} t={t} colors={colors} />
        <ContribSection data={data} t={t} />
        <BranchSection data={data} t={t} />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PulseHeader({
  data, t, onRefresh,
}: { data: RepoPulseLive; t: ReturnType<typeof useTheme>; onRefresh: () => void }) {
  const parts = data.repo.name.split('/');
  const repoLabel = parts[1] ?? data.repo.name;
  const pushedText = data.repo.pushedMin < 60
    ? `${data.repo.pushedMin}m ago`
    : data.repo.pushedMin < 1440
    ? `${Math.floor(data.repo.pushedMin / 60)}h ago`
    : `${Math.floor(data.repo.pushedMin / 1440)}d ago`;

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={[styles.repoName, { color: t.fg }]}>{repoLabel}</Text>
        <View style={styles.headerMeta}>
          {data.repo.lang !== '—' && (
            <Text style={[styles.metaPill, { color: t.accent, borderColor: t.borderColor, fontFamily: t.fontMono }]}>
              {data.repo.lang}
            </Text>
          )}
          <Text style={[styles.metaText, { color: t.fgDim, fontFamily: t.fontMono }]}>
            {data.repo.branch} · pushed {pushedText}
          </Text>
        </View>
      </View>
      <Pressable onPress={onRefresh} hitSlop={8} style={styles.refreshBtn}>
        <Text style={{ color: t.fgMuted, fontSize: 16 }}>↻</Text>
      </Pressable>
    </View>
  );
}

function KpiSection({
  data, colors,
}: { data: RepoPulseLive; t: ReturnType<typeof useTheme>; colors: PulseColors }) {
  const { kpis, ci } = data;
  const stats: Stat[] = [
    { key: 'commits/7d', value: String(kpis.commitsWeek), tone: 'accent' },
    { key: 'PRs merged', value: String(kpis.prsMerged) },
    { key: 'net lines', value: kpis.netLines >= 0 ? `+${kpis.netLines}` : String(kpis.netLines), tone: kpis.netLines >= 0 ? 'success' : 'danger' },
    { key: 'CI pass %', value: `${ci.passRate}%`, tone: ci.passRate >= 90 ? 'success' : ci.passRate >= 70 ? 'warn' : 'danger' },
    { key: 'review/h', value: kpis.reviewLatencyH ? `${kpis.reviewLatencyH}h` : '—' },
    { key: 'contributors', value: String(kpis.contributors) },
  ];
  return (
    <Card>
      <StatGrid stats={stats} />
    </Card>
  );
}

function VelocitySection({
  velocity, colors,
}: { velocity: VelocitySlice; t: ReturnType<typeof useTheme>; colors: PulseColors }) {
  return (
    <Card>
      <SectionHead title="Velocity" sub="commits + PRs · 14 days" />
      <LineAreaChart
        width={CONTENT_W - 24}
        labels={velocity.labels}
        series={[
          { data: velocity.commits, color: colors.info, area: true, gradientId: 'vel-commits' },
          { data: velocity.merged, color: colors.accent, dash: false },
          { data: velocity.opened, color: colors.extra2, dash: true },
        ]}
        height={110}
      />
      <View style={styles.legendRow}>
        <LegendDot color={colors.info} label="commits" />
        <LegendDot color={colors.accent} label="merged" />
        <LegendDot color={colors.extra2} label="opened" />
      </View>
    </Card>
  );
}

function CiSection({
  data, t, colors,
}: { data: RepoPulseLive; t: ReturnType<typeof useTheme>; colors: PulseColors }) {
  const { ci, workflows } = data;
  const ringColor = ci.passRate >= 90 ? colors.success : ci.passRate >= 70 ? colors.warn : '#ff6b6b';

  return (
    <Card>
      <SectionHead title="CI health" sub={`${ci.runs} runs · avg ${ci.avgMin}m`} />
      <View style={styles.ciRow}>
        <Ring percent={ci.passRate} color={ringColor} size={72} />
        <View style={styles.ciStats}>
          <CiStat t={t} label="passed" value={ci.passed} color={colors.success} />
          <CiStat t={t} label="failed" value={ci.failed} color="#ff6b6b" />
          <CiStat t={t} label="cancelled" value={ci.cancelled} color={t.fgDim} />
        </View>
      </View>
      {workflows.length > 0 && (
        <View style={[styles.wfList, { borderTopColor: t.borderColor }]}>
          {workflows.slice(0, 4).map((wf) => (
            <View key={wf.name} style={styles.wfRow}>
              <Text style={[styles.wfName, { color: t.fgMuted, fontFamily: t.fontMono }]} numberOfLines={1}>
                {wf.name}
              </Text>
              <Text style={[styles.wfPass, {
                color: wf.pass >= 90 ? colors.success : wf.pass >= 70 ? colors.warn : '#ff6b6b',
                fontFamily: t.fontMono,
              }]}>
                {wf.pass}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function CiStat({
  t, label, value, color,
}: { t: ReturnType<typeof useTheme>; label: string; value: number; color: string }) {
  return (
    <View style={styles.ciStatRow}>
      <Text style={[styles.ciStatVal, { color, fontFamily: t.fontMono }]}>{value}</Text>
      <Text style={[styles.ciStatLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>{label}</Text>
    </View>
  );
}

function ChurnSection({
  data, colors,
}: { data: RepoPulseLive; t: ReturnType<typeof useTheme>; colors: PulseColors }) {
  if (data.churnAreas.length === 0) return null;
  const items: HBarItem[] = data.churnAreas.map((a) => ({
    label: a.area,
    value: a.add + a.del,
    color: a.color,
    sub: `+${a.add} -${a.del}`,
  }));
  return (
    <Card>
      <SectionHead title="Churn by area" sub="additions + deletions" />
      <HBars items={items} width={CONTENT_W - 24} />
    </Card>
  );
}

function ContribSection({
  data, t,
}: { data: RepoPulseLive; t: ReturnType<typeof useTheme> }) {
  const contributors = data.contributors.slice(0, 8);
  if (contributors.length === 0) return null;
  return (
    <Card>
      <SectionHead
        title="Contributors"
        sub={`${data.contributors.length} total · ${data.kpis.botShare}% bot`}
      />
      {contributors.map((c) => (
        <View key={c.name} style={styles.contribRow}>
          <View style={[styles.contribDot, { backgroundColor: c.color }]} />
          <Text style={[styles.contribName, { color: c.bot ? t.fgDim : t.fg, fontFamily: t.fontMono }]}
            numberOfLines={1}>
            {c.name}
            {c.bot && ' [bot]'}
          </Text>
          <Text style={[styles.contribCommits, { color: t.fgDim, fontFamily: t.fontMono }]}>
            {c.commits} commit{c.commits !== 1 ? 's' : ''}
          </Text>
          {c.add > 0 && (
            <Text style={[styles.contribLines, { color: t.code.ty, fontFamily: t.fontMono }]}>
              +{c.add}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );
}

function BranchSection({
  data, t,
}: { data: RepoPulseLive; t: ReturnType<typeof useTheme> }) {
  const STATUS_COLOR: Record<string, string> = {
    'open-pr': t.code.ty,
    'ci-running': t.accent,
    draft: t.fgDim,
    blocked: '#ff6b6b',
    'commit-only': t.fgMuted,
    integration: t.accent,
  };
  const STATUS_LABEL: Record<string, string> = {
    'open-pr': 'PR open',
    'ci-running': 'CI',
    draft: 'draft',
    blocked: 'blocked',
    'commit-only': 'commits',
    integration: 'main',
  };

  if (data.branches.length === 0) return null;

  return (
    <Card>
      <SectionHead title="Branches" sub={`${data.branches.length} total`} />
      {data.branches.slice(0, 10).map((b) => (
        <View key={b.n} style={styles.branchRow}>
          <View style={[styles.branchDot, { backgroundColor: b.color }]} />
          <Text style={[styles.branchName, { color: t.fg, fontFamily: t.fontMono }]}
            numberOfLines={1}>
            {b.n}
          </Text>
          <Text style={[styles.branchStatus, {
            color: STATUS_COLOR[b.status] ?? t.fgMuted,
            fontFamily: t.fontMono,
          }]}>
            {STATUS_LABEL[b.status] ?? b.status}
          </Text>
          {(b.ahead > 0 || b.behind > 0) && (
            <Text style={[styles.branchAB, { color: t.fgDim, fontFamily: t.fontMono }]}>
              {b.ahead > 0 ? `↑${b.ahead}` : ''}{b.behind > 0 ? ` ↓${b.behind}` : ''}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <Surface style={styles.card}>
      {children}
    </Surface>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>
        {label}
      </Text>
    </View>
  );
}

function ErrorView({
  icon, title, body, t,
}: { icon: string; title: string; body: string; t: ReturnType<typeof useTheme> }) {
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={styles.centered}>
        <Text style={[styles.emptyIcon, { color: t.fgDim }]}>{icon}</Text>
        <Text style={[styles.emptyTitle, { color: t.fg }]}>{title}</Text>
        <Text style={[styles.emptyBody, { color: t.fgMuted }]}>{body}</Text>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  bottomSpacer: { height: 110 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 12, marginTop: 12 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingVertical: 4 },
  headerLeft: { flex: 1 },
  repoName: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaPill: { fontSize: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  metaText: { fontSize: 11 },
  refreshBtn: { padding: 8 },

  // Card
  card: { padding: 12 },

  // Legend
  legendRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 3, borderRadius: 1.5 },
  legendLabel: { fontSize: 10 },

  // CI
  ciRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  ciStats: { gap: 4, flex: 1 },
  ciStatRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  ciStatVal: { fontSize: 16, fontWeight: '600', width: 32 },
  ciStatLabel: { fontSize: 11 },
  wfList: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 8, gap: 6 },
  wfRow: { flexDirection: 'row', alignItems: 'center' },
  wfName: { flex: 1, fontSize: 11 },
  wfPass: { fontSize: 11, fontWeight: '600' },

  // Contributors
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  contribDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  contribName: { flex: 1, fontSize: 12 },
  contribCommits: { fontSize: 11 },
  contribLines: { fontSize: 11, width: 44, textAlign: 'right' },

  // Branches
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  branchDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  branchName: { flex: 1, fontSize: 11 },
  branchStatus: { fontSize: 10, fontWeight: '600' },
  branchAB: { fontSize: 10, width: 44, textAlign: 'right' },

  // Empty / error states
  emptyIcon: { fontSize: 32, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
