import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from './icon';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, leftIcon, rightSlot, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={LC.textMuted}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

/** Botão de mostrar/ocultar senha, para usar no rightSlot. */
export function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable hitSlop={8} onPress={onToggle}>
      <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={LC.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: LC.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: LC.bgCard,
    borderWidth: 1.5,
    borderColor: LC.border,
    borderRadius: LC.radius.md,
    paddingHorizontal: 14,
    gap: 10,
  },
  fieldFocused: { borderColor: LC.borderFocus },
  fieldError: { borderColor: LC.danger },
  icon: { opacity: 0.7 },
  right: { paddingLeft: 4 },
  input: { flex: 1, fontSize: 15, color: LC.textPrimary, paddingVertical: 12 },
  errorText: { fontSize: 12, color: LC.danger },
});
