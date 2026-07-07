import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { useTunnel } from '../../src/lib/TunnelContext';
import { Surface } from '../../src/components/ui/Surface';
import { ModalHeader } from '../../src/components/shell/ModalHeader';

type Row = {
  key: string;
  title: string;
  detail: string;
  href: Href;
  soon?: boolean;
};

const ROWS: readonly Row[] = [
  {
    key: 'sessions',
    title: 'Sessions',
    detail: 'Every desktop session · chat with any agent',
    href: '/(sessions)/roster',
  },
  {
    key: 'connection',
    title: 'Connection',
    detail: 'Pair with base-studio-code · QR / reconnect',
    href: '/(more)/connection',
  },
  {
    key: 'providers',
    title: 'Providers',
    detail: 'Connect a model — Anthropic · OpenAI · Google · local',
    href: '/(more)/providers',
  },
  {
    key: 'theme',
    title: 'Theme',
    detail: 'Appearance · desktop theme parity',
    href: '/(more)/theme',
  },
  {
    key: 'security',
    title: 'Security',
    detail: 'Audit & activity · read-only mirror',
    href: '/(more)/security',
  },
];

/** The More menu (#218): everything that is not one of the five tabs. */
export default function MoreScreen() {
  const t = useTheme();
  const { connectionState } = useTunnel();

  return (
    <View style={styles.root}>
      <ModalHeader title="More" subtitle="Connection, appearance & account" />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {ROWS.map((row) => (
          <Pressable key={row.key} onPress={() => router.push(row.href)}>
            <Surface style={styles.row} radius={8}>
              <View style={styles.rowText}>
                <View style={styles.rowTitleLine}>
                  <Text style={[styles.rowTitle, { color: t.fg }]}>{row.title}</Text>
                  {row.key === 'connection' && (
                    <View
                      style={[styles.stateDot, {
                        backgroundColor: connectionState === 'connected' ? '#4ade80' : t.fgDim,
                      }]}
                    />
                  )}
                  {row.soon && (
                    <Text style={[styles.soon, { color: t.fgDim, borderColor: t.borderColor, fontFamily: t.fontMono }]}>
                      SOON
                    </Text>
                  )}
                </View>
                <Text style={[styles.rowDetail, { color: t.fgMuted }]} numberOfLines={1}>
                  {row.detail}
                </Text>
              </View>
              <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                <Path d="M3.5 2l4 3.5-4 3.5" stroke={t.fgMuted} strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
            </Surface>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowText: { flex: 1, gap: 3 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 14.5, fontWeight: '600' },
  rowDetail: { fontSize: 12 },
  stateDot: { width: 7, height: 7, borderRadius: 3.5 },
  soon: {
    fontSize: 9,
    letterSpacing: 0.8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
});
