import { View, StyleSheet } from 'react-native';
import { LC } from '../../constants/theme';

/** Indicador visual de aulas usadas/disponíveis na semana. */
export function SaldoDots({ usadas, total, size = 22 }: { usadas: number; total: number; size?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: Math.max(total, 0) }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { width: size, height: size, borderRadius: size / 2 },
            i < usadas ? styles.used : styles.free,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  dot: {},
  used: { backgroundColor: LC.primary },
  free: { backgroundColor: LC.border },
});
