import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { LC } from '../../constants/theme';

interface CardProps extends ViewProps {
  padding?: number;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ padding = 16, elevated = true, style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.card, elevated && LC.shadow, { padding }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LC.bgCard,
    borderRadius: LC.radius.lg,
    borderWidth: 1,
    borderColor: LC.border,
  },
});
