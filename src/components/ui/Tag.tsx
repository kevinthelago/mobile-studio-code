import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { Theme, useTheme } from '../../theme';
import { hexAlpha } from '../../lib/color';

// Port of the design's `.msc-tag` — a monospace pill used for status chips,
// counts, and inline metadata. Five visual variants:
//
//   default — neutral elev2 fill, muted text       (.msc-tag)
//   amber   — accent-tinted                        (.msc-tag.amber)
//   green   — success-tinted                       (.msc-tag.green)
//   info    — info-tinted                          (.msc-tag.info)
//   warn    — warn-tinted                          (.msc-tag.warn)
//
// The design uses `color-mix(in oklch, var(--msc-X), transparent 88%)` for
// tinted backgrounds. React Native has no color-mix, so we approximate by
// taking the semantic hex token and emitting rgba() at the same alpha levels:
//   background = semantic at 12% alpha
//   border     = semantic at 30% alpha
export type TagVariant = 'default' | 'amber' | 'green' | 'info' | 'warn';

export interface TagProps extends ViewProps {
  variant?: TagVariant;
  /** Override font size (default 9.5 to match design). */
  fontSize?: number;
  children?: React.ReactNode;
}

function variantTokens(t: Theme, variant: TagVariant): {
  bg: string; border: string; fg: string;
} {
  if (variant === 'default') {
    return { bg: t.elev2, border: t.borderColor, fg: t.fgMuted };
  }
  const semantic =
    variant === 'amber' ? t.accent :
    variant === 'green' ? t.success :
    variant === 'info' ? t.info :
    /* warn */ t.warn;
  return {
    bg: hexAlpha(semantic, 0.12),
    border: hexAlpha(semantic, 0.30),
    fg: semantic,
  };
}

export function Tag({
  variant = 'default',
  fontSize = 9.5,
  style,
  children,
  ...rest
}: TagProps) {
  const t = useTheme();
  const { bg, border, fg } = variantTokens(t, variant);
  return (
    <View
      {...rest}
      style={[
        styles.tag,
        { backgroundColor: bg, borderColor: border },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: fg, fontFamily: t.fontMono, fontSize }]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    lineHeight: 16,
  },
});
