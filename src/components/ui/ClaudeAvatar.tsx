import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';

type Props = { size?: number };

// Amber accent circle used in chips, top pills, and commit-composer affordances.
export function ClaudeAvatar({ size = 14 }: Props) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.accent,
      }}
    />
  );
}
