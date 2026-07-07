import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme';
import { Surface } from '../../src/components/ui/Surface';
import { ModalHeader } from '../../src/components/shell/ModalHeader';

/**
 * Security placeholder (#218) — reserved for the read-only audit/activity
 * mirror (#223): the desktop's audit log, tool-attempt trail, and session
 * activity, displayed here exactly as the desktop records them.
 */
export default function SecurityScreen() {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <ModalHeader title="Security" subtitle="Audit & activity" />
      <View style={styles.centered}>
        <Surface style={styles.card} radius={10}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6l7-3z"
              stroke={t.accent} strokeWidth={1.5} strokeLinejoin="round"
            />
            <Path d="M9 12l2 2 4-4" stroke={t.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.title, { color: t.fg }]}>Audit log — coming later</Text>
          <Text style={[styles.detail, { color: t.fgMuted }]}>
            A read-only mirror of the desktop&apos;s security audit and session
            activity lands here with #223. Like every page in this app it will
            only display — nothing is editable from the phone.
          </Text>
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 22,
  },
  title: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
});
