import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../src/theme';
import { useMirrorDomain } from '../../src/lib/mirror/MirrorContext';
import { mapKitTokens, parseKitThemes } from '../../src/lib/mirror/themeMap';
import { Surface } from '../../src/components/ui/Surface';
import { ThemePicker } from '../../src/components/ui/ThemePicker';
import { ModalHeader } from '../../src/components/shell/ModalHeader';

/**
 * Theme screen (#218) — the native ThemePicker (the default look, always
 * available) plus the theme-parity scaffold: when the desktop syncs its kit
 * theme registry (mirror domain "themes"), each synced theme is previewed
 * through `mapKitTokens` against the current native theme. Read-only for now;
 * applying a synced theme lands with the parity content issue.
 */
export default function ThemeScreen() {
  const t = useTheme();
  const { data, synced } = useMirrorDomain('themes');
  const kitThemes = synced ? parseKitThemes(data) : [];

  return (
    <View style={styles.root}>
      <ModalHeader title="Theme" subtitle="Appearance & desktop parity" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ThemePicker />

        <Text style={[styles.sectionLabel, { color: t.fgDim, fontFamily: t.fontMono }]}>
          DESKTOP THEMES · SYNCED
        </Text>
        {kitThemes.length === 0 ? (
          <Surface style={styles.emptyCard} radius={8}>
            <Text style={[styles.emptyText, { color: t.fgMuted }]}>
              {synced
                ? 'The desktop synced no themes yet.'
                : 'Awaiting sync — pair with base-studio-code to mirror its theme kit here. Until then the app keeps its current look.'}
            </Text>
          </Surface>
        ) : (
          kitThemes.map((kit) => {
            const preview = mapKitTokens(t, kit.vars);
            return (
              <Surface key={kit.id} style={styles.kitRow} radius={8}>
                <View style={[styles.kitSwatch, {
                  backgroundColor: preview.bg,
                  borderColor: preview.borderColor,
                  borderRadius: Math.min(preview.radius, 10),
                }]}>
                  <View style={[styles.kitSwatchSurface, { backgroundColor: preview.surface }]} />
                  <View style={[styles.kitSwatchDot, { backgroundColor: preview.accent }]} />
                </View>
                <View style={styles.kitText}>
                  <Text style={[styles.kitLabel, { color: t.fg }]}>{kit.label}</Text>
                  {kit.description ? (
                    <Text style={[styles.kitDetail, { color: t.fgMuted }]} numberOfLines={2}>
                      {kit.description}
                    </Text>
                  ) : null}
                </View>
              </Surface>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyCard: { padding: 16 },
  emptyText: { fontSize: 12.5, lineHeight: 18 },
  kitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  kitSwatch: {
    width: 52,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  kitSwatchSurface: { width: 32, height: 12, borderRadius: 3 },
  kitSwatchDot: { width: 8, height: 8, borderRadius: 4 },
  kitText: { flex: 1, gap: 2 },
  kitLabel: { fontSize: 13.5, fontWeight: '600' },
  kitDetail: { fontSize: 11.5, lineHeight: 16 },
});
