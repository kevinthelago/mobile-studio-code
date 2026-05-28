import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewProps } from 'react-native';
import { useTheme } from '../../theme';

// Port of the design's `.msc-section-label` — the uppercase, letter-spaced
// section header used above lists and grouped content. Layout:
//
//   LABEL  · count                       action ›
//
//   .count  → muted, monospace
//   action  → accent-colored, normal-case (not uppercase). Pressable when
//             onActionPress is supplied; otherwise a plain Text label.
export interface SectionLabelProps extends ViewProps {
  /** The main label (will be displayed uppercase via letterSpacing + uppercase). */
  children: React.ReactNode;
  /** Optional count after a `·` separator (mono, fgMuted). */
  count?: number | string;
  /** Optional action label rendered right-aligned in accent color. */
  action?: React.ReactNode;
  /** Makes the action pressable. */
  onActionPress?: () => void;
  /**
   * Optional right-aligned dim hint (fgDim, normal-case) — for passive helper
   * text like "tap folder to expand". Distinct from `action`, which is an
   * accent-colored affordance. If both are given, `action` wins.
   */
  hint?: React.ReactNode;
}

export function SectionLabel({
  children,
  count,
  action,
  onActionPress,
  hint,
  style,
  ...rest
}: SectionLabelProps) {
  const t = useTheme();

  let rightEl: React.ReactNode = null;
  if (action != null) {
    const actionText = (
      <Text style={[styles.action, { color: t.accent, fontFamily: t.fontMono }]}>
        {action}
      </Text>
    );
    rightEl = onActionPress ? (
      <Pressable onPress={onActionPress} hitSlop={6}>{actionText}</Pressable>
    ) : actionText;
  } else if (hint != null) {
    rightEl = (
      <Text style={[styles.hint, { color: t.fgDim, fontFamily: t.fontMono }]}>
        {hint}
      </Text>
    );
  }

  return (
    <View {...rest} style={[styles.row, style]}>
      <Text style={[styles.label, { color: t.fgDim, fontFamily: t.fontMono }]}>
        {children}
      </Text>
      {count != null && (
        <Text style={[styles.count, { color: t.fgMuted, fontFamily: t.fontMono }]}>
          · {count}
        </Text>
      )}
      <View style={styles.spacer} />
      {rightEl}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    // 0.08em ≈ 0.8 at 10px font size — RN letterSpacing is in px, not em.
    letterSpacing: 0.8,
  },
  count: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  spacer: { flex: 1 },
  action: {
    fontSize: 10.5,
  },
  hint: {
    fontSize: 9.5,
  },
});
