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
}

export function SectionLabel({
  children,
  count,
  action,
  onActionPress,
  style,
  ...rest
}: SectionLabelProps) {
  const t = useTheme();

  const actionEl =
    action == null ? null : onActionPress ? (
      <Pressable onPress={onActionPress} hitSlop={6}>
        <Text style={[styles.action, { color: t.accent, fontFamily: t.fontMono }]}>
          {action}
        </Text>
      </Pressable>
    ) : (
      <Text style={[styles.action, { color: t.accent, fontFamily: t.fontMono }]}>
        {action}
      </Text>
    );

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
      {actionEl}
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
});
