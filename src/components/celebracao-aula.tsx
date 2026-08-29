import { useEffect, useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LC } from '../constants/theme';
import { Icon } from './ui/icon';
import { CURVA } from './ui/motion';

/**
 * A tela que aparece quando a aluna marca a aula.
 *
 * Antes era um alerta com o texto "Aula agendada!" e dois botões. Funcionava,
 * mas marcar aula é o momento bom do app — é a aluna se comprometendo com o
 * treino dela — e um alerta cinza trata isso como se fosse a confirmação de
 * um formulário. Aqui a confirmação vira o assunto da tela: o círculo cresce,
 * o certo é desenhado, os confetes caem, e só então o cartão da aula sobe com
 * o dia e a hora.
 *
 * O tempo total é de pouco mais de um segundo, e qualquer toque já fecha —
 * quem marca cinco aulas seguidas não pode ser obrigada a assistir cinco
 * vezes.
 */

const CORES_CONFETE = ['#0E9488', '#16B8A7', '#F59E0B', '#FBBF24', '#34D399', '#FFFFFF'];

function Confete({ indice, largura }: { indice: number; largura: number }) {
  const progresso = useSharedValue(0);

  // Cada pedacinho tem sua trajetória, senão viram uma cortina só.
  const { x, giro, tamanho, cor, atraso, deriva, duracao } = useMemo(() => {
    const aleatorio = (semente: number) => {
      const v = Math.sin(semente * 127.1 + indice * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    return {
      x: aleatorio(1) * largura,
      giro: (aleatorio(2) * 2 - 1) * 720,
      tamanho: 6 + aleatorio(3) * 7,
      cor: CORES_CONFETE[Math.floor(aleatorio(4) * CORES_CONFETE.length)],
      atraso: 180 + aleatorio(5) * 320,
      deriva: (aleatorio(6) * 2 - 1) * 90,
      duracao: 1500 + aleatorio(7) * 900,
    };
  }, [indice, largura]);

  useEffect(() => {
    progresso.value = withDelay(atraso, withTiming(1, { duration: duracao }));
  }, [progresso, atraso, duracao]);

  const animado = useAnimatedStyle(() => ({
    opacity: progresso.value < 0.75 ? 1 : (1 - progresso.value) * 4,
    transform: [
      { translateY: -60 + progresso.value * 900 },
      { translateX: progresso.value * deriva },
      { rotate: `${progresso.value * giro}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: x,
          width: tamanho,
          height: tamanho * 1.6,
          borderRadius: 2,
          backgroundColor: cor,
        },
        animado,
      ]}
    />
  );
}

function Selo() {
  const escala = useSharedValue(0);
  const anel = useSharedValue(0);
  const certo = useSharedValue(0);

  useEffect(() => {
    // O disco chega com um leve exagero — é o que dá o "pop".
    escala.value = withSequence(
      withTiming(1.12, { duration: 320, easing: CURVA }),
      withSpring(1, { damping: 12, stiffness: 220 }),
    );
    // A onda que sai do disco: cresce e some.
    anel.value = withDelay(240, withTiming(1, { duration: 700 }));
    // O certo entra depois do disco, senão os dois competem.
    certo.value = withDelay(300, withSpring(1, { damping: 11, stiffness: 260 }));
  }, [escala, anel, certo]);

  const discoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: escala.value }],
    opacity: Math.min(1, escala.value * 2),
  }));
  const anelStyle = useAnimatedStyle(() => ({
    opacity: (1 - anel.value) * 0.5,
    transform: [{ scale: 1 + anel.value * 1.1 }],
  }));
  const certoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: certo.value }],
    opacity: certo.value,
  }));

  return (
    <View style={s.seloArea}>
      <Animated.View style={[s.anel, anelStyle]} />
      <Animated.View style={[s.disco, discoStyle]}>
        <LinearGradient
          colors={['#16B8A7', '#0B6F66']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.discoGrad}
        >
          <Animated.View style={certoStyle}>
            <Icon name="checkmark" size={46} color="#fff" />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

export function CelebracaoAula({
  visible,
  modalidade,
  quando,
  hora,
  reposicao,
  onFechar,
  onVerAulas,
}: {
  visible: boolean;
  /** "Musculação" */
  modalidade: string;
  /** "Sexta, 04/09" */
  quando: string;
  /** "17:00" */
  hora: string;
  /** Marcada com crédito — muda o selo do cartão. */
  reposicao?: boolean;
  onFechar: () => void;
  onVerAulas: () => void;
}) {
  const { width } = useWindowDimensions();
  const larguraConfete = Math.min(width, 560);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onFechar}>
      <Animated.View entering={FadeIn.duration(220)} style={s.fundo}>
        <LinearGradient
          colors={['rgba(5,45,48,0.995)', 'rgba(2,116,122,0.985)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Toque em qualquer lugar fecha: quem marca várias aulas seguidas
            não pode ser obrigada a esperar a animação toda vez. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onFechar} accessibilityLabel="Fechar" />

        <View style={[s.confetes, { width: larguraConfete }]} pointerEvents="none">
          {Array.from({ length: 26 }).map((_, i) => (
            <Confete key={i} indice={i} largura={larguraConfete} />
          ))}
        </View>

        <View style={s.centro} pointerEvents="box-none">
          <Selo />

          <Animated.Text entering={FadeInDown.delay(420).duration(420).easing(CURVA)} style={s.titulo}>
            Aula marcada!
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(500).duration(420).easing(CURVA)} style={s.sub}>
            {reposicao ? 'Reposição confirmada. Bom treino!' : 'Está na sua agenda. Bom treino!'}
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(580).duration(460).easing(CURVA)} style={s.cartao}>
            <View style={s.cartaoHora}>
              <Text style={s.horaNum}>{hora}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cartaoModalidade}>{modalidade}</Text>
              <Text style={s.cartaoQuando}>{quando}</Text>
            </View>
            {reposicao && (
              <View style={s.selinho}>
                <Icon name="ticket-outline" size={13} color="#0B6F66" />
                <Text style={s.selinhoTexto}>Reposição</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(680).duration(460).easing(CURVA)} style={s.botoes}>
            <Pressable style={s.btnPrincipal} onPress={onVerAulas}>
              <Text style={s.btnPrincipalTexto}>Ver minhas aulas</Text>
            </Pressable>
            <Pressable style={s.btnVazado} onPress={onFechar}>
              <Text style={s.btnVazadoTexto}>Marcar outra</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fundo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confetes: { position: 'absolute', top: 0, bottom: 0, alignSelf: 'center' },
  centro: { alignItems: 'center', paddingHorizontal: 28, width: '100%', maxWidth: 460 },

  seloArea: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  anel: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#fff' },
  disco: { width: 104, height: 104, borderRadius: 52, overflow: 'hidden' },
  discoGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  titulo: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.6, textAlign: 'center' },
  sub: { fontSize: 15, color: 'rgba(255,255,255,0.82)', marginTop: 8, textAlign: 'center' },

  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: LC.radius.xl,
    padding: 16,
    marginTop: 28,
    alignSelf: 'stretch',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(14px)' } as object : null),
  },
  cartaoHora: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: LC.radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  horaNum: { fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  cartaoModalidade: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cartaoQuando: { fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  selinho: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D2ECE7', borderRadius: LC.radius.full,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  selinhoTexto: { fontSize: 10.5, fontWeight: '800', color: '#0B6F66' },

  botoes: { alignSelf: 'stretch', gap: 10, marginTop: 26 },
  btnPrincipal: {
    backgroundColor: '#fff', borderRadius: LC.radius.lg,
    paddingVertical: 16, alignItems: 'center',
  },
  btnPrincipalTexto: { fontSize: 15.5, fontWeight: '800', color: LC.primaryDark },
  btnVazado: { paddingVertical: 13, alignItems: 'center' },
  btnVazadoTexto: { fontSize: 14.5, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
});
