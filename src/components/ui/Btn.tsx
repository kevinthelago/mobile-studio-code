import React from 'react';
import { Pressable, PressableProps, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

// Port of the design's `.msc-btn` — the redesign's textual button. Three
// variants × two sizes. For icon-only round buttons, keep using IconBtn.
//
//   default — elev fill, hairline border, fg text     (.msc-btn)
//   primary — accent fill, dark text                  (.msc-btn.primary)
//   ghost   — transparent, no border, fg text         (.msc-btn.ghost)
//
//   size 'md' — height 32, padding 14, font 12        (default)
//   size 'sm' — height 26, padding 10, font 10.5      (.msc-btn.small)
export type BtnVariant = 'default' | 'primary' | 'ghost';
export type BtnSize = 'md' | 'sm';

export interface BtnProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: BtnVariant;
  size?: BtnSize;
  /** Optional icon / glyph rendered to the left of the label. */
  icon?: React.ReactNode;
  /** Button label (or any node, e.g. a glyph). */
  children?: React.ReactNode;
}

export function Btn({
  variant = 'default',
  size = 'md',
  icon,
  children,
  disabled,
  ...rest
}: BtnProps) {
  const t = useTheme();

  const sizing = size === 'sm' ? styles.sm : styles.md;
  const fontSize = size === 'sm' ? 10.5 : 12;

  const bg =
    variant === 'primary' ? t.accent :
    variant === 'ghost' ? 'transparent' :
    t.elev;
  const fg =
    variant === 'primary' ? '#1a120a' :
    t.fg;
  const border =
    variant === 'primary' ? 'transparent' :
    variant === 'ghost' ? 'transparent' :
    t.borderColor;

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        sizing,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon != null && <View style={styles.icon}>{icon}</View>}
      {children != null && (
        <Text
          style={[
            styles.label,
            {
              color: fg,
              fontFamily: t.fontMono,
              fontSize,
              fontWeight: variant === 'primary' ? '600' : '500',
            },
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  md: { height: 32, paddingHorizontal: 14 },
  sm: { height: 26, paddingHorizontal: 10 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {},
});
