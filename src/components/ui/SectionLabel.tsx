import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function SectionLabel({ children, color, style }: Props) {
  const t = useTheme();
  return (
    <Text
      style={[styles.label, { color: color ?? t.fgDim, fontFamily: t.fontMono }, style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600' },
});
