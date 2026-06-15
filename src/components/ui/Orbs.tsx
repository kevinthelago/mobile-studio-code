import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme';

// Blur strength for the orb-smoothing overlay. Higher = smoother but more
// frosted; tune on-device. iOS needs less than Android for the same effect.
const ORB_BLUR = Platform.OS === 'ios' ? 60 : 100;

type OrbDef = { left: number; top: number; size: number; color: string };

const GLASS_ORBS: OrbDef[] = [
  { left: -80, top: 80, size: 280, color: '#5b3fc8' },
  { left: 220, top: 240, size: 240, color: '#1f6dd9' },
  { left: -40, top: 560, size: 260, color: '#0f5b6b' },
  { left: 180, top: 720, size: 220, color: '#7a2a6a' },
];

// Subtle orbs for dark themes that don't have full glass effect
const DARK_ORBS: OrbDef[] = [
  { left: -60, top: 120, size: 200, color: '#2a1f4a' },
  { left: 200, top: 400, size: 180, color: '#0f2a3a' },
  { left: -20, top: 650, size: 160, color: '#1a2a1a' },
];

// Ambient blurred color orbs. Renders for all dark themes.
// Native RN has no filter:blur, so each orb is a stack of progressively-larger
// semi-transparent rings (a coarse glow). On its own that stack shows visible
// concentric banding ("staircase"), so we overlay a native BlurView that
// dissolves the rings into a smooth glow. Content renders in front of <Orbs/>,
// so only the orbs (and the flat theme bg) behind this layer get blurred.
export function Orbs() {
  const t = useTheme();
  // Don't render on light themes — their bg is already the right colour
  if (t.light) return null;

  const orbs = t.orbs ? GLASS_ORBS : DARK_ORBS;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {orbs.map((o, i) => (
        <SoftOrb key={i} {...o} isGlass={!!t.orbs} />
      ))}
      <BlurView
        pointerEvents="none"
        intensity={ORB_BLUR}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function SoftOrb({ left, top, size, color, isGlass }: OrbDef & { isGlass: boolean }) {
  const rings = isGlass ? 5 : 3;
  const baseOpacity = isGlass ? 0.45 : 0.3;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left - size * 0.25,
        top: top - size * 0.25,
        width: size * 1.5,
        height: size * 1.5,
      }}
    >
      {Array.from({ length: rings }).map((_, i) => {
        const expand = i * (size * 0.12);
        const opacity = baseOpacity * (1 - i / rings);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: size * 0.25 - expand / 2,
              top: size * 0.25 - expand / 2,
              width: size + expand,
              height: size + expand,
              borderRadius: (size + expand) / 2,
              backgroundColor: color,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}
