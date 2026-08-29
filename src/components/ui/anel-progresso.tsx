import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { CURVA } from './motion';

/**
 * Anel que se preenche sozinho — o saldo da semana da aluna.
 *
 * Sem `react-native-svg` no projeto, o anel é feito do jeito clássico: duas
 * metades de círculo giram atrás de uma máscara. A da direita cobre de 0 a
 * 50%, a da esquerda de 50 a 100%; o furo do meio é um disco da cor do fundo.
 * Dá o mesmo resultado de um `stroke-dasharray` e roda igual no navegador e
 * no celular, sem dependência nova.
 *
 * Ele começa vazio e enche até a fração — a aluna vê o quanto já usou da
 * semana antes de ler o número.
 */
export function AnelProgresso({
  fracao,
  tamanho = 96,
  espessura = 9,
  cor,
  trilho,
  corDoFuro,
  atraso = 150,
  children,
  style,
}: {
  /** 0 a 1. */
  fracao: number;
  tamanho?: number;
  espessura?: number;
  cor: string;
  trilho: string;
  /** Cor do miolo — precisa ser a cor do fundo atrás do anel. */
  corDoFuro: string;
  atraso?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(0);
  const alvo = Math.max(0, Math.min(1, fracao));

  useEffect(() => {
    p.value = withDelay(atraso, withTiming(alvo, { duration: 900, easing: CURVA }));
  }, [p, alvo, atraso]);

  const raio = tamanho / 2;
  const metade = { width: raio, height: tamanho, overflow: 'hidden' as const };
  /** Meia-lua: metade de um círculo, arredondada só do lado de fora. */
  const luaDir = {
    width: raio, height: tamanho, backgroundColor: cor,
    borderTopRightRadius: raio, borderBottomRightRadius: raio,
    transformOrigin: 'left center' as const,
  };
  const luaEsq = {
    width: raio, height: tamanho, backgroundColor: cor,
    borderTopLeftRadius: raio, borderBottomLeftRadius: raio,
    transformOrigin: 'right center' as const,
  };

  /**
   * Cada meia-lua gira em torno do CENTRO DO CÍRCULO, não do próprio centro.
   * Para a meia-lua da direita esse ponto é a borda esquerda dela; para a da
   * esquerda, a borda direita — daí os `transformOrigin`. (Fazer isso com
   * translate-rotate-translate também funciona, mas a ordem em que o React
   * Native aplica os transforms é fácil de errar; assim o pivô fica escrito.)
   *
   * As duas começam em -180°, escondidas atrás da máscara da metade oposta, e
   * chegam a 0° preenchidas — o anel enche no sentido horário a partir das 12h.
   */
  const direita = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-180 + Math.min(p.value, 0.5) * 360}deg` }],
  }));
  const esquerda = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-180 + (Math.max(p.value, 0.5) - 0.5) * 360}deg` }],
  }));

  return (
    <View style={[{ width: tamanho, height: tamanho }, style]}>
      {/* trilho */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: raio, backgroundColor: trilho }]} />

      {/* metade esquerda (50%→100%) */}
      <View style={[styles.ladoEsq, metade]}>
        <Animated.View style={[luaEsq, esquerda]} />
      </View>
      {/* metade direita (0%→50%) */}
      <View style={[styles.ladoDir, metade, { left: raio }]}>
        <Animated.View style={[luaDir, direita]} />
      </View>

      {/* furo */}
      <View
        style={[
          styles.furo,
          {
            top: espessura,
            left: espessura,
            width: tamanho - espessura * 2,
            height: tamanho - espessura * 2,
            borderRadius: (tamanho - espessura * 2) / 2,
            backgroundColor: corDoFuro,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ladoEsq: { position: 'absolute', top: 0, left: 0 },
  ladoDir: { position: 'absolute', top: 0 },
  furo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
