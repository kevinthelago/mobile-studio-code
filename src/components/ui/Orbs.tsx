import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../../theme';

type OrbDef = {
  left: number;
  top: number;
  size: number;
  color: string;
  /** One drift cycle in ms (each orb differs so they never sync up). */
  dur: number;
  /** Drift amplitude in px. */
  ax: number;
  ay: number;
};

// Vivid orbs for the full glass theme.
const GLASS_ORBS: OrbDef[] = [
  { left: -40, top: 120, size: 300, color: '#5b3fc8', dur: 14000, ax: 28, ay: -20 },
  { left: 250, top: 250, size: 260, color: '#1f6dd9', dur: 18000, ax: -24, ay: 26 },
  { left: -20, top: 600, size: 300, color: '#0f5b6b', dur: 16000, ax: 22, ay: 22 },
  { left: 230, top: 760, size: 240, color: '#7a2a6a', dur: 21000, ax: -20, ay: -24 },
];

// Subtler orbs for dark (non-glass) themes.
const DARK_ORBS: OrbDef[] = [
  { left: -20, top: 160, size: 240, color: '#2a1f4a', dur: 17000, ax: 18, ay: -14 },
  { left: 230, top: 430, size: 220, color: '#0f2a3a', dur: 20000, ax: -16, ay: 18 },
  { left: 0, top: 700, size: 200, color: '#1a2a1a', dur: 18000, ax: 14, ay: 16 },
];

/**
 * Ambient background "orbs" — soft radial-gradient blobs that slowly drift,
 * scale, and breathe. RN has no `filter: blur`, so each orb is an SVG radial
 * gradient (color → transparent) for a true soft edge, animated via the
 * native-driver Animated API (transform + opacity, so it runs off the JS
 * thread). Renders only on dark themes; light themes use their flat bg.
 */
export function Orbs() {
  const t = useTheme();
  if (t.light) return null;

  const orbs = t.orbs ? GLASS_ORBS : DARK_ORBS;
  const peak = t.orbs ? 0.55 : 0.4;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {orbs.map((o, i) => <SoftOrb key={i} index={i} peak={peak} {...o} />)}
    </View>
  );
}

function SoftOrb({
  left, top, size, color, dur, ax, ay, index, peak,
}: OrbDef & { index: number; peak: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, dur]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, ax] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, ay] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [peak * 0.72, peak] });

  // The SVG canvas is twice the orb size so the gradient has room to fade out.
  const canvas = size * 2;
  const gid = `orb-grad-${index}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left - size / 2,
        top: top - size / 2,
        width: canvas,
        height: canvas,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      <Svg width={canvas} height={canvas}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.85} />
            <Stop offset="45%" stopColor={color} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size} cy={size} r={size} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}
