import { Tabs } from 'expo-router';
import React from 'react';
import { Path, Svg, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../../src/ThemeContext';
import { View } from 'react-native';

function FilesIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.6}>
      <Path d="M3 5a2 2 0 012-2h3l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
    </Svg>
  );
}

function FindIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <Circle cx={9} cy={9} r={5} />
      <Path d="M13 13l3.5 3.5" />
    </Svg>
  );
}

function EditIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <Path d="M4 14l1-4 8-8 3 3-8 8-4 1z" />
    </Svg>
  );
}

function RunIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 6l3 3-3 3M9 13h6" />
    </Svg>
  );
}

function GitIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.6}>
      <Circle cx={6} cy={5} r={2} />
      <Circle cx={6} cy={15} r={2} />
      <Circle cx={14} cy={10} r={2} />
      <Path d="M6 7v6M8 5h4a2 2 0 012 2v1" />
    </Svg>
  );
}

export default function TabLayout() {
  const { theme: t } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.glass ? 'rgba(18,20,30,0.92)' : t.bg,
          borderTopColor: t.borderColor,
          borderTopWidth: 0.5,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.fgMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          fontFamily: t.sharp ? 'Courier' : 'System',
          letterSpacing: t.sharp ? 0.4 : 0,
          textTransform: t.sharp ? 'uppercase' : 'none',
        },
      }}
    >
      <Tabs.Screen
        name="files"
        options={{ title: 'Files', tabBarIcon: ({ color }) => <FilesIcon color={color} /> }}
      />
      <Tabs.Screen
        name="find"
        options={{ title: 'Find', tabBarIcon: ({ color }) => <FindIcon color={color} /> }}
      />
      <Tabs.Screen
        name="edit"
        options={{ title: 'Edit', tabBarIcon: ({ color }) => <EditIcon color={color} /> }}
      />
      <Tabs.Screen
        name="run"
        options={{ title: 'Run', tabBarIcon: ({ color }) => <RunIcon color={color} /> }}
      />
      <Tabs.Screen
        name="git"
        options={{ title: 'Git', tabBarIcon: ({ color }) => <GitIcon color={color} /> }}
      />
    </Tabs>
  );
}
