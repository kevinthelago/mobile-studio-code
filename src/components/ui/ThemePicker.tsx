import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  THEMES, useTheme, useThemeId, useSetThemeId, type ThemeId,
} from '../../theme';

export function ThemePicker() {
  const t = useTheme();
  const activeId = useThemeId();
  const setThemeId = useSetThemeId();

  return (
    <View>
      <Text style={[styles.label, { color: t.fgDim, fontFamily: t.fontMono }]}>Theme</Text>
      <View style={styles.row}>
        {(Object.keys(THEMES) as ThemeId[]).map((id) => {
          const th = THEMES[id];
          const active = id === activeId;
          return (
            <Pressable
              key={id}
              onPress={() => setThemeId(id)}
              style={[
                styles.swatch,
                {
                  backgroundColor: th.bg,
                  borderColor: active ? t.accent : t.borderColor,
                  borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: th.accent }]} />
              <Text style={[styles.name, { color: active ? t.fg : t.fgMuted }]} numberOfLines={1}>
                {th.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8 },
  swatch: {
    flex: 1,
    height: 56, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    overflow: 'hidden',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 10.5, fontWeight: '500' },
});
