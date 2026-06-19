import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  dot?: string;
  border?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Tag({ children, color, bg, dot, border = true, style }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: bg ?? t.surface,
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          borderColor: t.borderColor,
        },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.text, { color: color ?? t.fgMuted, fontFamily: t.fontMono }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    height: 20, paddingHorizontal: 8, borderRadius: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 10.5, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },
});
