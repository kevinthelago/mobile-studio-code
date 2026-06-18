import React from 'react';
import {
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Surface } from './Surface';
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
  index: 'Files',
  find: 'Find',
  edit: 'Edit',
  run: 'Run',
  git: 'Git',
  github: 'Pulse',
};

// Custom themed bottom tab bar. Each theme renders a different chrome:
//   glass / dawn  → floating rounded pill with circular highlight on active
//   terminal      → tmux-style numbered row with hairline dividers
//   paper         → text labels with a top accent border on active
//   basic         → material-style icon + label
export function BottomTabBar(props: BottomTabBarProps) {
  const t = useTheme();
  const { state, navigation, descriptors } = props;

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

  // Variant 1: floating pill (glass + soft dark)
  if (t.glass || t.name === 'Soft Dark') {
    return (
      <View style={styles.pillWrap}>
        <Surface
          radius={32}
          style={styles.pillSurface}
        >
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const Icon = ICONS[route.name] ?? FilesIcon;
            const tint = focused
              ? (t.glass ? '#fff' : t.accent)
              : t.fgMuted;
            const bg = focused
              ? (t.glass ? 'rgba(255,255,255,0.16)' : 'rgba(217,119,87,0.18)')
              : 'transparent';
            return (
              <Pressable
                key={route.key}
                onPress={() => onPress(route.key, route.name, focused)}
                style={[styles.pillBtn, { backgroundColor: bg }]}
                accessibilityRole="button"
                accessibilityLabel={LABELS[route.name]}
              >
                <Icon color={tint} />
              </Pressable>
            );
          })}
        </Surface>
      </View>
    );
  }

  // Variant 2: terminal — tmux numbered row
  if (t.sharp) {
    return (
      <View
        style={[
          styles.sharpWrap,
          { backgroundColor: t.surface, borderTopColor: t.borderColor },
        ]}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              onPress={() => onPress(route.key, route.name, focused)}
              style={[
                styles.sharpBtn,
                {
                  borderRightColor: t.borderColor,
                  backgroundColor: focused ? t.surfaceSolid : 'transparent',
                },
                i === state.routes.length - 1 && { borderRightWidth: 0 },
              ]}
            >
              <Text
                style={[
                  styles.sharpNum,
                  {
                    color: focused ? t.accent : t.fgDim,
                    fontFamily: t.fontMono,
                  },
                ]}
              >
                {i + 1}
              </Text>
              <Text
                style={[
                  styles.sharpLabel,
                  {
                    color: focused ? t.accent : t.fgMuted,
                    fontFamily: t.fontMono,
                  },
                ]}
              >
                {LABELS[route.name].toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // Variant 3: paper — text labels with top accent border on active
  if (t.name === 'Paper') {
    return (
      <View
        style={[
          styles.paperWrap,
          { backgroundColor: t.bg, borderTopColor: t.borderColor },
        ]}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              onPress={() => onPress(route.key, route.name, focused)}
              style={[
                styles.paperBtn,
                {
                  borderTopColor: focused ? t.accent : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.paperLabel,
                  { color: focused ? t.fg : t.fgMuted },
                ]}
              >
                {LABELS[route.name].toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // Variant 4: basic — material-style icon + label
  return (
    <View
      style={[
        styles.basicWrap,
        { backgroundColor: t.bg, borderTopColor: t.borderColor },
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
            style={styles.basicBtn}
          >
            <Icon color={tint} />
            <Text style={[styles.basicLabel, { color: tint }]}>
              {LABELS[route.name]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Glass / dawn pill
  pillWrap: {
    position: 'absolute',
    left: 16, right: 16, bottom: 30,
    height: 60,
  },
  pillSurface: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  pillBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },

  // Terminal sharp
  sharpWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 28,
    height: 36,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sharpBtn: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  sharpNum: { fontSize: 11, fontWeight: '700' },
  sharpLabel: { fontSize: 11, letterSpacing: 0.4 },

  // Paper
  paperWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 32,
    height: 56,
    flexDirection: 'row',
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  paperBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1.5,
    paddingTop: 8,
  },
  paperLabel: {
    fontSize: 11.5, fontWeight: '500',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },

  // Basic (material)
  basicWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 76,
    flexDirection: 'row',
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  basicBtn: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  basicLabel: { fontSize: 10, fontWeight: '500' },
});
