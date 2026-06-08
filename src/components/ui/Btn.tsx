import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

export type BtnKind = 'primary' | 'ghost' | 'soft' | 'danger';
export type BtnSize = 'sm' | 'md' | 'lg';

type Props = {
  /** Button text (ignored when `children` is provided). */
  label?: string;
  children?: React.ReactNode;
  kind?: BtnKind;
  size?: BtnSize;
  /** Stretch to fill the parent's width. */
  full?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const MIN_HEIGHT: Record<BtnSize, number> = { sm: 36, md: 44, lg: 50 };
const DANGER = '#ff8fa3';

/**
 * The app's button primitive (from the redesign's `Btn`). Variants:
 * - `primary` — Claude-orange→purple gradient on glass themes, solid accent otherwise.
 * - `ghost` / `soft` — translucent fills with a hairline border.
 * - `danger` — translucent red with red text.
 *
 * `PrimaryButton` is a thin `kind="primary"` wrapper, so every button reads from here.
 */
export function Btn({
  label, children, kind = 'primary', size = 'lg', full, onPress, disabled, loading, style,
}: Props) {
  const t = useTheme();
  const radius = t.sharp ? 6 : 14;
  const dim = disabled || loading;
  const fontSize = size === 'sm' ? 13 : 14.5;
  const textColor = kind === 'primary' ? '#fff' : kind === 'danger' ? DANGER : t.fg;

  const base: ViewStyle = {
    minHeight: MIN_HEIGHT[size], borderRadius: radius, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...(full ? { width: '100%' } : null),
  };
  const content = loading
    ? <ActivityIndicator color={textColor} size="small" />
    : children ?? <Text style={[styles.label, { color: textColor, fontSize }]}>{label}</Text>;
  const press = ({ pressed }: { pressed: boolean }) => ({ opacity: dim ? 0.4 : pressed ? 0.85 : 1 });

  // Primary: gradient on glass, solid accent elsewhere (mirrors IconBtn's primary).
  if (kind === 'primary') {
    if (t.glass) {
      return (
        <Pressable onPress={onPress} disabled={dim} style={({ pressed }) => [press({ pressed }), full ? styles.full : null, style]}>
          <LinearGradient colors={['#d97757', '#c084fc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={base}>
            {content}
          </LinearGradient>
        </Pressable>
      );
    }
    return (
      <Pressable onPress={onPress} disabled={dim} style={({ pressed }) => [base, { backgroundColor: t.accent }, press({ pressed }), style]}>
        {content}
      </Pressable>
    );
  }

  const variant: ViewStyle = kind === 'danger'
    ? { backgroundColor: 'rgba(255,143,163,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,143,163,0.4)' }
    : {
        backgroundColor: t.glass ? `rgba(255,255,255,${kind === 'soft' ? 0.08 : 0.06})` : t.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: t.borderColor,
      };

  return (
    <Pressable onPress={onPress} disabled={dim} style={({ pressed }) => [base, variant, press({ pressed }), style]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '600' },
  full: { width: '100%' },
});
