import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeContext';

interface SurfaceProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
}

export function Surface({ children, style, radius }: SurfaceProps) {
  const t = useTheme();
  const r = radius ?? t.radius;

  const baseStyle: ViewStyle = {
    borderRadius: r,
    backgroundColor: t.surfaceSolid,
    borderWidth: 1,
    borderColor: t.borderColor,
  };

  return (
    <View style={[baseStyle, style]}>
      {children}
    </View>
  );
}
