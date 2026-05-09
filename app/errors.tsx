/**
 * Errors tab
 *
 * Shows all entries from the error bus. Each card has a "Fix with Agent" button
 * that navigates to the Run tab with the error pre-loaded into the agent.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import {
  AppError,
  ErrorSeverity,
  subscribe,
  resolveError,
  clearAll,
  clearResolved,
} from '../src/lib/errorBus';
import { useTheme } from '../src/ThemeContext';

// ── Colour helpers ────────────────────────────────────────────────────────────

function severityColor(severity: ErrorSeverity, accent: string) {
  if (severity === 'error') return '#ff6b6b';
  if (severity === 'warning') return '#ffd479';
  return accent;
}

function sourceLabel(s: AppError['source']) {
  const map: Record<string, string> = {
    git: 'Git',
    agent: 'Agent',
    build: 'Build',
    lsp: 'LSP',
    llm: 'LLM',
    app: 'App',
  };
  return map[s] ?? s;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ErrorIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={8} stroke={color} strokeWidth={1.8} />
      <Path d="M10 6v5M10 14v.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function WarningIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
      <Path d="M10 3L2 17h16L10 3z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M10 9v4M10 15v.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function InfoIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={8} stroke={color} strokeWidth={1.8} />
      <Path d="M10 10v5M10 6v.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 20 20" fill="none">
      <Path d="M4 10l5 5 7-8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BotIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 20 20" fill="none">
      <Svg width={13} height={13} viewBox="0 0 20 20" fill="none">
        <Path d="M7 9h6M7 12h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Path
          d="M4 6h12a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"
          stroke={color}
          strokeWidth={1.6}
        />
        <Path d="M10 6V3" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </Svg>
  );
}

// ── Error card ────────────────────────────────────────────────────────────────

function ErrorCard({
  err,
  onResolve,
  onFix,
}: {
  err: AppError;
  onResolve: (id: string) => void;
  onFix: (err: AppError) => void;
}) {
  const t = useTheme();
  const color = severityColor(err.severity, t.accent);
  const [expanded, setExpanded] = useState(false);

  const SevIcon =
    err.severity === 'error'
      ? ErrorIcon
      : err.severity === 'warning'
      ? WarningIcon
      : InfoIcon;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.surface,
          borderColor: err.resolved ? t.borderColor : color + '44',
          opacity: err.resolved ? 0.5 : 1,
        },
      ]}
    >
      {/* Header row */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
      >
        <SevIcon color={err.resolved ? t.fgDim : color} />
        <View style={styles.cardMeta}>
          <Text style={[styles.cardSource, { color: err.resolved ? t.fgDim : color }]}>
            {sourceLabel(err.source).toUpperCase()}
          </Text>
          <Text style={[styles.cardTime, { color: t.fgDim }]}>
            {new Date(err.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: t.fgDim }]}>
          {expanded ? '▾' : '▸'}
        </Text>
      </TouchableOpacity>

      {/* Message */}
      <Text
        style={[styles.cardMessage, { color: t.fg }]}
        numberOfLines={expanded ? undefined : 2}
      >
        {err.message}
      </Text>

      {/* Detail (expandable) */}
      {expanded && err.detail ? (
        <View style={[styles.detailBox, { backgroundColor: t.surfaceSolid ?? t.bg, borderColor: t.borderColor }]}>
          <Text style={[styles.detailText, { color: t.fgMuted }]} selectable>
            {err.detail}
          </Text>
        </View>
      ) : null}

      {/* Actions */}
      {!err.resolved && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.fixBtn, { backgroundColor: color + '22', borderColor: color + '55' }]}
            onPress={() => onFix(err)}
          >
            <BotIcon color={color} />
            <Text style={[styles.fixBtnText, { color }]}>Fix with Agent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resolveBtn, { borderColor: t.borderColor }]}
            onPress={() => onResolve(err.id)}
          >
            <CheckIcon color={t.fgMuted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ t }: { t: any }) {
  return (
    <View style={styles.empty}>
      <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
        <Circle cx={24} cy={24} r={20} stroke={t.fgDim} strokeWidth={1.5} />
        <Path
          d="M16 24l6 6 10-12"
          stroke={t.fgDim}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={[styles.emptyTitle, { color: t.fg }]}>No errors</Text>
      <Text style={[styles.emptyBody, { color: t.fgMuted }]}>
        Errors and warnings captured from Git, the agent, and builds will appear here.
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ErrorsScreen() {
  const t = useTheme();
  const router = useRouter();
  const [errors, setErrors] = useState<AppError[]>([]);

  useEffect(() => {
    const unsub = subscribe(setErrors);
    return unsub;
  }, []);

  const handleResolve = useCallback((id: string) => resolveError(id), []);

  const handleFix = useCallback(
    (err: AppError) => {
      // Navigate to Run tab — pass the error id as a query param.
      // run.tsx reads it and pre-seeds the agent input.
      router.push({ pathname: '/run', params: { errorId: err.id } });
    },
    [router],
  );

  const unresolvedCount = errors.filter((e) => !e.resolved).length;
  const hasResolved = errors.some((e) => e.resolved);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.borderColor }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: t.fg }]}>Errors</Text>
          {unresolvedCount > 0 && (
            <View style={[styles.badge, { backgroundColor: '#ff6b6b' }]}>
              <Text style={styles.badgeText}>{unresolvedCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {hasResolved && (
            <TouchableOpacity onPress={clearResolved} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: t.fgMuted }]}>Clear resolved</Text>
            </TouchableOpacity>
          )}
          {errors.length > 0 && (
            <TouchableOpacity onPress={clearAll} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: t.fgMuted }]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {errors.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {errors.map((err) => (
            <ErrorCard
              key={err.id}
              err={err}
              onResolve={handleResolve}
              onFix={handleFix}
            />
          ))}
          <View style={styles.listBottom} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerBtn: { paddingVertical: 4 },
  headerBtnText: { fontSize: 12 },
  list: { padding: 12, gap: 10 },
  listBottom: { height: 80 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardSource: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1, fontFamily: 'monospace' },
  cardTime: { fontSize: 10.5, fontFamily: 'monospace' },
  chevron: { fontSize: 12 },
  cardMessage: { fontSize: 13.5, lineHeight: 20 },
  detailBox: {
    borderRadius: 8,
    borderWidth: 0.5,
    padding: 10,
  },
  detailText: { fontSize: 11.5, fontFamily: 'monospace', lineHeight: 17 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  fixBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  fixBtnText: { fontSize: 12.5, fontWeight: '600' },
  resolveBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
