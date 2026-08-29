import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LC } from '../../constants/theme';

/**
 * Esqueleto no lugar do rodinha-de-carregando.
 *
 * A rodinha diz "espere" e some, e a tela salta quando o conteúdo chega. O
 * esqueleto já mostra o formato do que vem: a lista não pula, e a espera
 * parece mais curta mesmo levando o mesmo tempo.
 */
function Bloco({ largura, altura, raio = 8 }: { largura: DimensionValue; altura: number; raio?: number }) {
  const brilho = useSharedValue(0.5);

  useEffect(() => {
    brilho.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [brilho]);

  const animado = useAnimatedStyle(() => ({ opacity: brilho.value }));

  return (
    <Animated.View
      style={[{ width: largura, height: altura, borderRadius: raio, backgroundColor: LC.neutralBg }, animado]}
    />
  );
}

/** Um card de aula fantasma, no mesmo tamanho do de verdade. */
export function EsqueletoAula() {
  return (
    <View style={s.card}>
      <View style={s.hora}>
        <Bloco largura={38} altura={17} />
        <View style={{ height: 6 }} />
        <Bloco largura={30} altura={10} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Bloco largura="62%" altura={15} />
        <Bloco largura="40%" altura={11} />
        <Bloco largura="100%" altura={5} raio={5} />
      </View>
      <Bloco largura={74} altura={34} raio={LC.radius.md} />
    </View>
  );
}

export function EsqueletoLista({ quantos = 4 }: { quantos?: number }) {
  return (
    <View>
      {Array.from({ length: quantos }).map((_, i) => (
        <EsqueletoAula key={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: LC.bgCard,
    borderRadius: LC.radius.xl,
    borderWidth: 1,
    borderColor: LC.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  hora: { minWidth: 52, borderRightWidth: 1, borderRightColor: LC.border, paddingRight: 14 },
});
