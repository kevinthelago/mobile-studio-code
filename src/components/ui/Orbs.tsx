import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
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

// Vivid orbs for the full glass theme. left/top are the orb's CENTER.
const GLASS_ORBS: OrbDef[] = [
  { left: 40, top: 200, size: 320, color: '#5b3fc8', dur: 14000, ax: 28, ay: -20 },
  { left: 320, top: 300, size: 280, color: '#1f6dd9', dur: 18000, ax: -24, ay: 26 },
  { left: 60, top: 640, size: 320, color: '#0f5b6b', dur: 16000, ax: 22, ay: 22 },
  { left: 300, top: 800, size: 260, color: '#7a2a6a', dur: 21000, ax: -20, ay: -24 },
];

// Subtler orbs for dark (non-glass) themes.
const DARK_ORBS: OrbDef[] = [
  { left: 30, top: 220, size: 260, color: '#3a2c63', dur: 17000, ax: 18, ay: -14 },
  { left: 300, top: 470, size: 240, color: '#17384a', dur: 20000, ax: -16, ay: 18 },
  { left: 60, top: 740, size: 220, color: '#243a24', dur: 18000, ax: 14, ay: 16 },
];

// Concentric layers per orb. More layers = smoother (more blurred-looking)
// falloff. Plain Views (no SVG) so it renders reliably on every architecture.
const LAYERS = 22;

/**
 * Ambient background "orbs" — soft glowing blobs that slowly drift and breathe.
 * RN has no `filter: blur`, and SVG radial gradients don't render on some New
 * Architecture builds, so each orb is a stack of many concentric translucent
 * circles whose cumulative alpha peaks at the centre and fades smoothly to the
 * edge. Animated with the native-driver Animated API (transform + opacity).
 * Renders only on dark themes; light themes use their flat bg.
 */
export function Orbs() {
  const t = useTheme();
  if (t.light) return null;

  const orbs = t.orbs ? GLASS_ORBS : DARK_ORBS;
  const peak = t.orbs ? 0.6 : 0.42;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {orbs.map((o, i) => <SoftOrb key={i} peak={peak} {...o} />)}
    </View>
  );
}

function SoftOrb({
  left, top, size, color, dur, ax, ay, peak,
}: OrbDef & { peak: number }) {
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
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  // Subtle "breathing" brightness on top of the per-layer alpha.
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });

  // Per-layer alpha chosen so the fully-overlapped centre reaches ~peak.
  const layerAlpha = 1 - Math.pow(1 - peak, 1 / LAYERS);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left - size / 2,
        top: top - size / 2,
        width: size,
        height: size,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      {Array.from({ length: LAYERS }).map((_, i) => {
        const frac = i / (LAYERS - 1);        // 0 (largest, back) → 1 (smallest, front)
        const d = size * (1 - frac * 0.82);    // diameter shrinks toward the centre
        const off = (size - d) / 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: off,
              top: off,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: color,
              opacity: layerAlpha,
            }}
          />
        );
      })}
    </Animated.View>
  );
}
