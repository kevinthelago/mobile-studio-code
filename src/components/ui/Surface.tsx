import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  soft?: boolean;
};

export function Surface({ children, style, radius, soft = false }: Props) {
  const t = useTheme();
  const r = radius ?? t.radius;

  return (
    <View
      style={[
        {
          borderRadius: r,
          backgroundColor: soft ? t.surface : t.surfaceSolid,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.borderColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
