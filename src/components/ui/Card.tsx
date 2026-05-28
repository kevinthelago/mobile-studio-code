import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from '../../theme';

// Lightweight bordered panel — port of the design's `.msc-card`.
// Use this for the redesign's row cards, info panels, and grouped content.
// For the heavier blurred/glass treatment (e.g. tab bar pill, terminal input),
// use Surface instead.
export interface CardProps extends ViewProps {
  /** Override the default panel background (defaults to theme.surface). */
  background?: string;
  /** Override the border color (defaults to theme.borderColor). */
  borderColor?: string;
  /** Override the border radius (defaults to 8, matching .msc-card). */
  radius?: number;
}

export function Card({
  style,
  background,
  borderColor,
  radius = 8,
  children,
  ...rest
}: CardProps) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: background ?? t.surface,
          borderColor: borderColor ?? t.borderColor,
          borderRadius: radius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
