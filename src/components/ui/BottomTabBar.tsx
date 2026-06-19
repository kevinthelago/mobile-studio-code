import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import {
  FilesIcon, FindIcon, EditIcon, RunIcon, GitIcon, GithubIcon,
} from '../TabIcons';

type IconCmp = (props: { color: string }) => React.ReactElement;

const ICONS: Record<string, IconCmp> = {
  index: FilesIcon,
  find: FindIcon,
  edit: EditIcon,
  run: RunIcon,
  git: GitIcon,
  github: GithubIcon,
};

const LABELS: Record<string, string> = {
  index: 'FILES',
  find: 'FIND',
  edit: 'EDIT',
  run: 'RUN',
  git: 'GIT',
  github: 'PULSE',
};

export function BottomTabBar(props: BottomTabBarProps) {
  const t = useTheme();
  const { state, navigation } = props;
  const insets = useSafeAreaInsets();

  const onPress = (routeKey: string, name: string, focused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(name as never);
    }
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.bg,
          borderTopColor: t.borderColor,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const Icon = ICONS[route.name] ?? FilesIcon;
        const tint = focused ? t.accent : t.fgMuted;

        return (
          <Pressable
            key={route.key}
            onPress={() => onPress(route.key, route.name, focused)}
            style={[
              styles.tab,
              focused && { borderTopColor: t.accent },
            ]}
            accessibilityRole="button"
            accessibilityLabel={LABELS[route.name] ?? route.name}
          >
            <Icon color={tint} />
            <Text
              style={[
                styles.label,
                { color: tint, fontFamily: t.fontMono },
              ]}
            >
              {i + 1} {LABELS[route.name] ?? route.name.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderTopWidth: 1.5,
    borderTopColor: 'transparent',
  },
  label: {
    fontSize: 9.5,
    letterSpacing: 0.4,
    fontWeight: '500',
  },
});
