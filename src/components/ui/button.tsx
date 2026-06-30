import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LC } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 56 };
const FONT: Record<Size, number> = { sm: 13, md: 15, lg: 16 };

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = true,
  leftIcon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const bg = BG[variant];
  const txtColor = TXT[variant];
  const isOutline = variant === 'outline' || variant === 'danger-outline';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size], backgroundColor: bg },
        isOutline && { borderWidth: 1.5, borderColor: txtColor },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={txtColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <Text style={[styles.label, { color: txtColor, fontSize: FONT[size] }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const BG: Record<Variant, string> = {
  primary: LC.primary,
  secondary: LC.primaryDark,
  outline: 'transparent',
  ghost: 'transparent',
  danger: LC.danger,
  'danger-outline': 'transparent',
};

const TXT: Record<Variant, string> = {
  primary: LC.textOnPrimary,
  secondary: LC.textOnPrimary,
  outline: LC.primary,
  ghost: LC.primary,
  danger: LC.textWhite,
  'danger-outline': LC.danger,
};

const styles = StyleSheet.create({
  base: {
    borderRadius: LC.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LC.space.xl,
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: LC.space.sm },
  label: { fontWeight: '700' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
});
