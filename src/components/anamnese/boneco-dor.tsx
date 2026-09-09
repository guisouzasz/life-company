import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { rotuloDaRegiao } from '../../constants/anamnese';

/**
 * O boneco onde o aluno marca onde dói.
 *
 * Desenhado com Views posicionadas, e não em SVG, porque o projeto não tem
 * `react-native-svg`: puxar uma dependência nativa para desenhar retângulos
 * arredondados obrigaria a um rebuild do app e não desenharia nada que isto
 * não desenhe.
 *
 * As medidas estão em PIXELS sobre uma caixa fixa, não em porcentagem. Com
 * porcentagem, largura e altura escalam por eixos diferentes — 10% de largura
 * é metade de 10% de altura nesta caixa — e um braço pensado como "estreito e
 * comprido" sai quadrado. Foi assim na primeira tentativa: as partes ficaram
 * soltas e o conjunto não parecia gente.
 *
 * O que vai para o banco é o `id` da região, nunca a posição na tela. O
 * desenho pode ser refeito à vontade sem invalidar o que os alunos marcaram.
 *
 * DIREITO E ESQUERDO são do aluno, não de quem olha. Numa figura de frente
 * isso se inverte, e é o erro clássico deste tipo de tela: a pessoa toca o
 * ombro que aparece à direita e o sistema grava "ombro esquerdo". Por isso
 * cada par leva um "D" ou "E" escrito em cima — quem toca lê o lado em vez de
 * deduzir da imagem.
 */

const LARGURA = 170;
const ALTURA = 340;

type Caixa = { x: number; y: number; w: number; h: number; r?: number };

/** Partes só de desenho: dão o contorno de gente sob as regiões tocáveis. */
const SILHUETA_FRENTE: Caixa[] = [
  { x: 66, y: 4, w: 38, h: 38, r: 19 }, // cabeça
  { x: 78, y: 38, w: 14, h: 14, r: 4 }, // pescoço
  { x: 34, y: 72, w: 18, h: 36, r: 9 }, // braço D
  { x: 118, y: 72, w: 18, h: 36, r: 9 }, // braço E
  { x: 34, y: 126, w: 18, h: 32, r: 9 }, // antebraço D
  { x: 118, y: 126, w: 18, h: 32, r: 9 }, // antebraço E
  { x: 60, y: 168, w: 24, h: 52, r: 10 }, // coxa D
  { x: 86, y: 168, w: 24, h: 52, r: 10 }, // coxa E
  { x: 56, y: 300, w: 30, h: 14, r: 6 }, // pé D
  { x: 84, y: 300, w: 30, h: 14, r: 6 }, // pé E
];

const SILHUETA_COSTAS: Caixa[] = [
  { x: 66, y: 4, w: 38, h: 38, r: 19 }, // cabeça
  { x: 34, y: 58, w: 18, h: 40, r: 9 }, // braço D
  { x: 118, y: 58, w: 18, h: 40, r: 9 }, // braço E
  { x: 34, y: 100, w: 18, h: 38, r: 9 }, // antebraço D
  { x: 118, y: 100, w: 18, h: 38, r: 9 }, // antebraço E
  { x: 26, y: 50, w: 30, h: 22, r: 10 }, // ombro D (só desenho nas costas)
  { x: 114, y: 50, w: 30, h: 22, r: 10 }, // ombro E
  { x: 56, y: 300, w: 30, h: 14, r: 6 }, // pé D
  { x: 84, y: 300, w: 30, h: 14, r: 6 }, // pé E
];

const FRENTE: Record<string, Caixa> = {
  'ombro-d': { x: 26, y: 50, w: 30, h: 24, r: 11 },
  'ombro-e': { x: 114, y: 50, w: 30, h: 24, r: 11 },
  peito: { x: 58, y: 50, w: 54, h: 46, r: 9 },
  abdomen: { x: 60, y: 98, w: 50, h: 44, r: 9 },
  'cotovelo-d': { x: 30, y: 104, w: 26, h: 24, r: 11 },
  'cotovelo-e': { x: 114, y: 104, w: 26, h: 24, r: 11 },
  'punho-d': { x: 30, y: 156, w: 26, h: 24, r: 11 },
  'punho-e': { x: 114, y: 156, w: 26, h: 24, r: 11 },
  'quadril-d': { x: 58, y: 144, w: 26, h: 26, r: 8 },
  'quadril-e': { x: 86, y: 144, w: 26, h: 26, r: 8 },
  'joelho-d': { x: 57, y: 216, w: 30, h: 28, r: 13 },
  'joelho-e': { x: 83, y: 216, w: 30, h: 28, r: 13 },
  'canela-d': { x: 60, y: 244, w: 24, h: 58, r: 10 },
  'canela-e': { x: 86, y: 244, w: 24, h: 58, r: 10 },
};

const COSTAS: Record<string, Caixa> = {
  cervical: { x: 70, y: 36, w: 30, h: 20, r: 8 },
  dorsal: { x: 58, y: 56, w: 54, h: 52, r: 9 },
  lombar: { x: 60, y: 110, w: 50, h: 34, r: 9 },
  gluteo: { x: 56, y: 146, w: 58, h: 34, r: 15 },
  'posterior-d': { x: 60, y: 182, w: 24, h: 50, r: 10 },
  'posterior-e': { x: 86, y: 182, w: 24, h: 50, r: 10 },
  'panturrilha-d': { x: 60, y: 234, w: 24, h: 52, r: 10 },
  'panturrilha-e': { x: 86, y: 234, w: 24, h: 52, r: 10 },
};

const posicao = (c: Caixa) => ({
  position: 'absolute' as const,
  top: c.y,
  left: c.x,
  width: c.w,
  height: c.h,
  borderRadius: c.r ?? 8,
});

/** "ombro-d" → "D". Vazio quando a região não tem lado. */
const lado = (id: string) => (id.endsWith('-d') ? 'D' : id.endsWith('-e') ? 'E' : '');

interface Props {
  marcadas: string[];
  onAlternar: (id: string) => void;
  /** Só leitura: a ficha do professor mostra o boneco sem deixar mexer. */
  somenteLeitura?: boolean;
}

export function BonecoDor({ marcadas, onAlternar, somenteLeitura = false }: Props) {
  /*
    Na leitura, começa pela vista onde o aluno marcou algo: o professor não
    deveria descobrir, tocando, que a dor estava nas costas.
  */
  const temNaFrente = marcadas.some((id) => id in FRENTE);
  const [vista, setVista] = useState<'frente' | 'costas'>(
    somenteLeitura && !temNaFrente && marcadas.length > 0 ? 'costas' : 'frente',
  );

  const regioes = vista === 'frente' ? FRENTE : COSTAS;
  const silhueta = vista === 'frente' ? SILHUETA_FRENTE : SILHUETA_COSTAS;
  const marcadasAqui = Object.keys(regioes).filter((id) => marcadas.includes(id));
  const naOutraVista = marcadas.filter((id) => !(id in regioes)).length;

  return (
    <View>
      <View style={s.abas}>
        {(['frente', 'costas'] as const).map((v) => {
          const ativa = vista === v;
          const quantas = marcadas.filter((id) => id in (v === 'frente' ? FRENTE : COSTAS)).length;
          return (
            <Pressable
              key={v}
              style={[s.aba, ativa && s.abaAtiva]}
              onPress={() => setVista(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
            >
              <Text style={[s.abaTexto, ativa && s.abaTextoAtivo]}>
                {v === 'frente' ? 'Frente' : 'Costas'}
                {quantas > 0 ? ` · ${quantas}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.palco}>
        <View style={[s.corpo, { width: LARGURA, height: ALTURA }]}>
          {silhueta.map((c, i) => (
            <View key={i} style={[posicao(c), s.silhueta]} pointerEvents="none" />
          ))}

          {Object.entries(regioes).map(([id, caixa]) => {
            const marcada = marcadas.includes(id);
            const l = lado(id);
            return (
              <Pressable
                key={id}
                style={[posicao(caixa), s.regiao, marcada && s.regiaoMarcada]}
                onPress={somenteLeitura ? undefined : () => onAlternar(id)}
                disabled={somenteLeitura}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcada }}
                accessibilityLabel={rotuloDaRegiao(id)}
              >
                {l ? <Text style={[s.lado, marcada && s.ladoMarcado]}>{l}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {!somenteLeitura ? (
        <Text style={s.dica}>Toque onde dói. D = seu lado direito · E = seu lado esquerdo.</Text>
      ) : null}

      {marcadasAqui.length > 0 ? (
        <View style={s.lista}>
          {marcadasAqui.map((id) => (
            <View key={id} style={s.selo}>
              <Text style={s.seloTexto}>{rotuloDaRegiao(id)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {naOutraVista > 0 ? (
        <Text style={s.dica}>
          Mais {naOutraVista} marcada(s) em {vista === 'frente' ? 'Costas' : 'Frente'}.
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  abas: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  aba: {
    flex: 1, paddingVertical: 9, borderRadius: 9,
    backgroundColor: LC.neutralBg, alignItems: 'center',
  },
  abaAtiva: { backgroundColor: LC.primaryLight },
  abaTexto: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
  abaTextoAtivo: { color: LC.primary },

  palco: { alignItems: 'center', paddingVertical: 4 },
  corpo: { position: 'relative' },
  /*
    A silhueta precisa ser visivelmente mais escura que o fundo, senão o
    conjunto lê como pastilhas soltas em vez de um corpo — foi o que aconteceu
    quando ela usava o mesmo tom das regiões.
  */
  silhueta: { backgroundColor: '#CBD5E1' },
  regiao: {
    backgroundColor: LC.bgCard,
    borderWidth: 1.5, borderColor: '#94A3B8',
    alignItems: 'center', justifyContent: 'center',
  },
  /*
    Vermelho na região marcada: é dor, e o professor lê isso de relance no meio
    da aula. Um tom neutro faria "marcado" e "não marcado" parecerem iguais
    numa tela ao sol.
  */
  regiaoMarcada: { backgroundColor: LC.danger, borderColor: '#B91C1C' },
  lado: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  ladoMarcado: { color: '#fff' },

  dica: { fontSize: 12, color: LC.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  lista: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' },
  selo: { backgroundColor: LC.dangerBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  seloTexto: { fontSize: 12, fontWeight: '700', color: LC.dangerFg },
});
