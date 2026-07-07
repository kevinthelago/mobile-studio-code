import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

/**
 * Compact in-section empty state (#223) — for a synced mirror page whose list
 * happens to be empty (the page-level absent/awaiting states belong to
 * MirrorScaffold, not here).
 */
export function EmptyRow({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderColor: t.borderColor }]}>
      <Text style={[styles.text, { color: t.fgDim }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  text: { fontSize: 12, textAlign: 'center' },
});
