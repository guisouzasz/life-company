import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

/**
 * As peças de movimento do app, num lugar só.
 *
 * Duas regras que valem para tudo aqui:
 *
 *  1. Movimento serve para explicar, não para enfeitar. Um card que sobe ao
 *     entrar diz "isto é novo"; um botão que afunda ao toque diz "recebi".
 *     Animação que não responde a nada vira ruído — e numa tela que a aluna
 *     abre três vezes por semana, ruído cansa rápido.
 *
 *  2. Rápido. Nada aqui passa de 420ms, e o que responde ao dedo fica abaixo
 *     de 150ms. Interface sofisticada é a que parece instantânea; a lentidão
 *     é que denuncia o efeito.
 */

/** Curva padrão: sai rápido, chega macio. */
export const CURVA = Easing.bezier(0.22, 1, 0.36, 1);

const MOLA_TOQUE = { damping: 15, stiffness: 400, mass: 0.5 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Botão/card que afunda ao toque.
 *
 * O feedback de toque padrão do React Native é a opacidade caindo, que no
 * navegador não acontece e no celular parece que a tela apagou. Escala com
 * mola dá a sensação física de apertar algo, e funciona igual nos dois.
 */
export const Toque = forwardRef<any, PressableProps & {
  children: ReactNode;
  /** Quanto afunda. 0.97 para cards grandes, 0.94 para botões pequenos. */
  escala?: number;
  style?: StyleProp<ViewStyle>;
}>(function Toque({ children, escala = 0.97, style, disabled, ...props }, ref) {
  const s = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) s.value = withSpring(escala, MOLA_TOQUE);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, MOLA_TOQUE);
        props.onPressOut?.(e);
      }}
      style={[style, animado]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
});

/**
 * Item de lista que entra subindo, um atrás do outro.
 *
 * O escalonamento (`indice`) é o que faz a lista parecer que se montou em vez
 * de aparecer de uma vez. Passa de 8 itens e o último demoraria demais, então
 * o atraso satura.
 *
 * CUIDADO no navegador: a animação de entrada do Reanimated tira o item do
 * fluxo do layout. Enquanto a lista for a última coisa do ScrollView isso não
 * aparece, mas QUALQUER elemento depois dela (um rodapé, uma paginação) sobe e
 * fica por cima do primeiro item — e chega a roubar o toque dele. Aconteceu na
 * tela de registro de ações. Se houver algo abaixo da lista, use os itens sem
 * este envelope.
 */
export function EntraSubindo({
  indice = 0,
  distancia = 14,
  children,
  style,
}: {
  indice?: number;
  distancia?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const atraso = Math.min(indice, 8) * 45;
  return (
    <Animated.View entering={FadeInDown.delay(atraso).duration(380).easing(CURVA).withInitialValues({
      transform: [{ translateY: distancia }],
    })} style={style}>
      {children}
    </Animated.View>
  );
}

/** Aparece sem se mover — para trocas de conteúdo no mesmo lugar. */
export function Aparece({ children, atraso = 0, style }: { children: ReactNode; atraso?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.delay(atraso).duration(260)} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * Barra que enche sozinha ao aparecer.
 *
 * Usada na lotação da turma e no saldo da semana. Ver a barra crescer até 3/4
 * conta a mesma história que o texto "3 de 4", mas antes de a pessoa ler.
 */
export function BarraAnimada({
  fracao,
  cor,
  fundo,
  altura = 5,
  atraso = 120,
}: {
  fracao: number;
  cor: string;
  fundo: string;
  altura?: number;
  atraso?: number;
}) {
  const largura = useSharedValue(0);
  const alvo = Math.max(0, Math.min(1, fracao));

  const animado = useAnimatedStyle(() => {
    largura.value = withTiming(alvo * 100, { duration: 620, easing: CURVA });
    return { width: `${largura.value}%` };
  }, [alvo]);

  return (
    <Animated.View
      entering={FadeIn.delay(atraso)}
      style={{ height: altura, borderRadius: altura, backgroundColor: fundo, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height: altura, borderRadius: altura, backgroundColor: cor }, animado]} />
    </Animated.View>
  );
}
