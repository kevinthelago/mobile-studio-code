import React, { Fragment } from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { useTheme } from '../../theme';

// Port of the design's `.msc-head` — the github-style page header used at the
// top of every screen in the redesign. Layout:
//
//   CRUMB › CRUMB › CRUMB                  (mono, fgDim, uppercase, 0.06em)
//   Title (large mono)        meta  [right slot]
//
// `meta` and `title` accept ReactNode so screens can drop in inline accent
// emphasis (e.g. `<>3 changed · <Strong>+87 / -7</Strong></>`).
export interface PageHeaderProps extends ViewProps {
  /** Crumbs rendered left-to-right with `›` separators. */
  crumbs?: ReadonlyArray<React.ReactNode>;
  /** Main title (large monospace, ellipsised). */
  title?: React.ReactNode;
  /** Meta line beside the title (small monospace). */
  meta?: React.ReactNode;
  /** Optional right-aligned slot (typically a Btn or status pill). */
  right?: React.ReactNode;
}

export function PageHeader({
  crumbs,
  title,
  meta,
  right,
  style,
  ...rest
}: PageHeaderProps) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.head,
        { backgroundColor: t.bg, borderBottomColor: t.borderColor },
        style,
      ]}
    >
      {crumbs && crumbs.length > 0 && (
        <View style={styles.crumbs}>
          {crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <Text style={[styles.crumbSep, { color: t.fgDim, fontFamily: t.fontMono }]}>
                  ›
                </Text>
              )}
              <Text style={[styles.crumb, { color: t.fgMuted, fontFamily: t.fontMono }]}>
                {c}
              </Text>
            </Fragment>
          ))}
        </View>
      )}
      {(title != null || meta != null || right != null) && (
        <View style={styles.row}>
          {title != null && (
            <Text
              numberOfLines={1}
              style={[styles.title, { color: t.fg, fontFamily: t.fontMono }]}
            >
              {title}
            </Text>
          )}
          {meta != null && (
            <Text style={[styles.meta, { color: t.fgMuted, fontFamily: t.fontMono }]}>
              {meta}
            </Text>
          )}
          {right}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  crumbs: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  crumb: {
    fontSize: 10.5,
    fontWeight: '500',
    textTransform: 'uppercase',
    // 0.06em ≈ 0.6 at 10.5px font size
    letterSpacing: 0.6,
  },
  crumbSep: {
    fontSize: 10.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.17,
  },
  meta: {
    fontSize: 10.5,
  },
});
