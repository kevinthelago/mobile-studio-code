import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from './Surface';
import { useTheme } from '../../theme/ThemeContext';

interface TopPillProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  sub?: string;
}

export function TopPill({ left, center, right, sub }: TopPillProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 6,
        left: 16,
        right: 16,
        height: 48,
        zIndex: 25,
      }}
    >
      <Surface
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          gap: 10,
        }}
      >
        {left}
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          {center}
          {sub && (
            <Text
              style={{
                fontSize: 10.5,
                color: t.fgDim,
                marginTop: 1,
                fontFamily: t.fontMono,
              }}
            >
              {sub}
            </Text>
          )}
        </View>
        {right}
      </Surface>
    </View>
  );
}
