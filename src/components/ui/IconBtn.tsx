import React from 'react';
import {
  Pressable, StyleSheet, type ViewStyle, type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  children?: React.ReactNode;
  onPress?: () => void;
  primary?: boolean;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconBtn({
  children, onPress, primary = false, size = 32, disabled, style,
}: Props) {
  const t = useTheme();
  const sizing = { width: size, height: size, borderRadius: 4 };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        sizing,
        styles.center,
        primary
          ? { backgroundColor: t.accent }
          : {
              backgroundColor: t.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.borderColor,
            },
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
