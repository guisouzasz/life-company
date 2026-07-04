import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { LC } from '../../constants/theme';

interface CardProps extends ViewProps {
  padding?: number;
  /** Card flutuante com sombra difusa (default). */
  elevated?: boolean;
  /** Adiciona uma borda hairline sutil (para cards sobre fundo branco). */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ padding = 16, elevated = true, bordered = false, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && LC.shadowCard,
        bordered && styles.bordered,
        { padding },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LC.bgCard,
    borderRadius: LC.radius.lg,
  },
  bordered: {
    borderWidth: 1,
    borderColor: LC.border,
  },
});
