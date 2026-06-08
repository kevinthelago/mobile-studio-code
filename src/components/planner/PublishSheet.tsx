import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Surface } from '../ui/Surface';
import { PrimaryButton } from '../ui/PrimaryButton';
import { PLAN_COLORS } from '../../lib/planner/colors';
import { KEYS, getSecret } from '../../lib/storage';
import {
  buildPublishPlan, defaultRepoFromPlan, publishToGitHub,
  type PublishResult,
} from '../../lib/planner/publish';
import type { PlanProject } from '../../lib/planner/project';

/** Confirm-first GitHub publish: preview milestones/issues, pick the target repo,
 *  then create them. Outward-facing, so it requires an explicit confirm. */
export function PublishSheet({ project, onClose }: { project: PlanProject; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const plan = useMemo(() => buildPublishPlan(project), [project]);

  const [repo, setRepo] = useState(defaultRepoFromPlan(project) ?? '');
  const [pat, setPat] = useState<string | null>(null);
  const [patLoaded, setPatLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSecret(KEYS.GITHUB_PAT).then((p) => { setPat(p); setPatLoaded(true); });
  }, []);

  const repoValid = /^[^/\s]+\/[^/\s]+$/.test(repo.trim());
  const canPublish = patLoaded && !!pat && repoValid && plan.issues.length > 0 && !publishing && !result;

  async function doPublish() {
    if (!pat) return;
    setError(null);
    setPublishing(true);
    setProgress({ done: 0, total: plan.milestones.length + plan.issues.length, label: 'Starting…' });
    try {
      const res = await publishToGitHub(plan, repo.trim(), pat, (done, total, label) =>
        setProgress({ done, total, label }));
      setResult(res);
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setPublishing(false);
      setProgress(null);
    }
  }

  function confirmPublish() {
    Alert.alert(
      'Publish to GitHub?',
      `This creates ${plan.milestones.length} milestone(s) and ${plan.issues.length} issue(s) in ${repo.trim()}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', onPress: () => { void doPublish(); } },
      ],
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={publishing ? undefined : onClose} />
      <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 12 }]}>
        <Surface style={styles.sheet} radius={20}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.fg }]}>Publish to GitHub</Text>
            <Pressable onPress={onClose} hitSlop={10} disabled={publishing}>
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path d="M4 4l8 8M12 4l-8 8" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner} showsVerticalScrollIndicator={false}>
            {result ? (
              <>
                <Text style={[styles.resultTitle, { color: PLAN_COLORS.good }]}>
                  Published — {result.issues.length} issue(s), {result.milestonesCreated} new milestone(s)
                </Text>
                {result.issues.map((iss) => (
                  <Pressable key={iss.url} onPress={() => { void Linking.openURL(iss.url); }} style={styles.linkRow}>
                    <Text style={[styles.linkText, { color: t.accent }]} numberOfLines={1}>{iss.title}</Text>
                  </Pressable>
                ))}
                {result.failures.map((f) => (
                  <Text key={f.title} style={[styles.failText, { color: PLAN_COLORS.bad }]} numberOfLines={2}>
                    {f.title}: {f.error}
                  </Text>
                ))}
                <PrimaryButton label="Done" onPress={onClose} style={styles.action} />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: t.fgDim }]}>TARGET REPO</Text>
                <TextInput
                  value={repo}
                  onChangeText={setRepo}
                  placeholder="owner/repo"
                  placeholderTextColor={t.fgDim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!publishing}
                  style={[styles.input, { color: t.fg, borderColor: t.borderColor, fontFamily: t.fontMono, backgroundColor: t.surface }]}
                />

                <View style={styles.previewRow}>
                  <View style={[styles.pill, { borderColor: t.borderColor }]}>
                    <Text style={[styles.pillText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                      {plan.milestones.length} milestones
                    </Text>
                  </View>
                  <View style={[styles.pill, { borderColor: t.borderColor }]}>
                    <Text style={[styles.pillText, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                      {plan.issues.length} issues
                    </Text>
                  </View>
                </View>

                {patLoaded && !pat && (
                  <Text style={[styles.note, { color: PLAN_COLORS.warn }]}>
                    Add a GitHub PAT on the repo screen (Git tab → Switch) to publish.
                  </Text>
                )}
                {plan.warnings.length > 0 && (
                  <View style={styles.warnBox}>
                    {plan.warnings.slice(0, 4).map((w, i) => (
                      <Text key={i} style={[styles.warnText, { color: t.fgDim }]} numberOfLines={2}>• {w}</Text>
                    ))}
                    {plan.warnings.length > 4 && (
                      <Text style={[styles.warnText, { color: t.fgDim }]}>+{plan.warnings.length - 4} more</Text>
                    )}
                  </View>
                )}
                {error && <Text style={[styles.failText, { color: PLAN_COLORS.bad }]}>{error}</Text>}

                {publishing ? (
                  <View style={styles.progress}>
                    <ActivityIndicator color={t.accent} />
                    <Text style={[styles.progressText, { color: t.fgMuted }]} numberOfLines={1}>
                      {progress ? `${progress.done}/${progress.total} · ${progress.label}` : 'Publishing…'}
                    </Text>
                  </View>
                ) : (
                  <PrimaryButton
                    label="Publish to GitHub"
                    onPress={confirmPublish}
                    style={[styles.action, { opacity: canPublish ? 1 : 0.45 }]}
                    disabled={!canPublish}
                  />
                )}
              </>
            )}
          </ScrollView>
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetWrap: { paddingHorizontal: 10 },
  sheet: { padding: 16, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { flexGrow: 0 },
  bodyInner: { gap: 10 },
  label: { fontSize: 10.5, letterSpacing: 1.2, fontWeight: '700' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  previewRow: { flexDirection: 'row', gap: 8 },
  pill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 11.5 },
  note: { fontSize: 12, lineHeight: 17 },
  warnBox: { gap: 3 },
  warnText: { fontSize: 11.5, lineHeight: 16 },
  failText: { fontSize: 12, lineHeight: 17 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  progressText: { fontSize: 12.5, flex: 1 },
  action: { marginTop: 6 },
  resultTitle: { fontSize: 14, fontWeight: '700' },
  linkRow: { paddingVertical: 4 },
  linkText: { fontSize: 13, fontWeight: '500' },
});
