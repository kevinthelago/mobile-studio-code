import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

type Props = {
  /** Button text (ignored when `children` is provided). */
  label?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Full-width primary CTA. Matches the redesign: glass themes use the
 * Claude-orange → purple gradient; other themes use a solid accent fill.
 * Mirrors the gradient treatment already in `IconBtn`'s primary variant so all
 * primary actions read consistently.
 */
export function PrimaryButton({
  label, children, onPress, disabled, loading, style,
}: Props) {
  const t = useTheme();
  const radius = t.sharp ? 6 : 14;
  const dim = disabled || loading;
  const content = loading
    ? <ActivityIndicator color="#fff" />
    : children ?? <Text style={styles.label}>{label}</Text>;

  if (t.glass) {
    return (
      <Pressable
        onPress={onPress}
        disabled={dim}
        style={({ pressed }) => [{ opacity: dim ? 0.4 : pressed ? 0.85 : 1 }, style]}
      >
        <LinearGradient
          colors={['#d97757', '#c084fc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { borderRadius: radius }]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={dim}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: t.accent, borderRadius: radius, opacity: dim ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48, flexDirection: 'row', gap: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  label: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
