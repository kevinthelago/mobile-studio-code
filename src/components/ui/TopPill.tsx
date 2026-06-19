import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  sub?: string;
  right?: React.ReactNode;
};

export function TopPill({ left, center, sub, right }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: t.bg, borderBottomColor: t.borderColor },
      ]}
    >
      {left}
      <View style={styles.centerCol}>
        {typeof center === 'string' ? (
          <Text style={[styles.centerText, { color: t.fg }]} numberOfLines={1}>
            {center}
          </Text>
        ) : (
          center
        )}
        {sub ? (
          <Text
            style={[styles.subText, { color: t.fgMuted, fontFamily: t.fontMono }]}
            numberOfLines={1}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  centerCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  centerText: { fontSize: 13, fontWeight: '600' },
  subText: { fontSize: 10.5, marginTop: 1 },
});
