import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  children: React.ReactNode;
  /** Override the label color (defaults to the dim foreground). */
  color?: string;
  /** Extra layout styling (margins/padding) per call site. */
  style?: StyleProp<TextStyle>;
};

/**
 * Small uppercase section eyebrow/label from the redesign — used above titles
 * ("Workspace", "Search") and over grouped lists ("Recent", "Files"). Provides the
 * text treatment; call sites add their own spacing via `style`.
 */
export function SectionLabel({ children, color, style }: Props) {
  const t = useTheme();
  return <Text style={[styles.label, { color: color ?? t.fgDim }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600' },
});
