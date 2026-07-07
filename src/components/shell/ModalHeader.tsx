import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { IconBtn } from '../ui/IconBtn';

/** Header for the More-corner modal screens: back chevron + title. */
export function ModalHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.borderColor }]}>
      <IconBtn onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
        <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
          <Path d="M9 3L5 7l4 4" stroke={t.fg} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </IconBtn>
      <View style={styles.text}>
        <Text style={[styles.title, { color: t.fg }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.fgDim }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 11.5 },
});
