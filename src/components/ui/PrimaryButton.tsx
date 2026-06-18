import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { Btn } from './Btn';

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
 * Full-width primary CTA — a thin wrapper over the `Btn` primitive
 * (`kind="primary"`). Kept as a named export because it reads clearly at call
 * sites and is used widely; all of its styling now lives in `Btn`.
 */
export function PrimaryButton({ label, children, onPress, disabled, loading, style }: Props) {
  return (
    <Btn kind="primary" size="lg" label={label} onPress={onPress} disabled={disabled} loading={loading} style={style}>
      {children}
    </Btn>
  );
}
