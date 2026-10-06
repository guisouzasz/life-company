import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { cargaDeHoje } from './situacao';
import { conjugacoes, juntarParceiros } from './conjugados';
import type { ExercicioTreino } from '../../services/treinos/treinos.types';
import type { EvolucaoExercicio } from '../../services/cargas/cargas.types';

/**
 * A ficha de musculação como o professor usa em pé, na sala: um cartão por
 * exercício, agrupados por músculo, na ordem da ficha.
 *
 * Era uma tabela de três colunas. No celular o nome do exercício quebrava em
 * três linhas ("SUPINO RETO / COM / HALTERES") para caber ao lado de colunas
 * de largura fixa, e a carga que o aluno levantou da última vez vinha num
 * texto de 11px embaixo da carga da ficha — justamente o número que ele
 * pergunta ("quanto eu coloquei semana passada?").
 *
 * Agora cada exercício diz, em letra de ler de longe: o que fazer (séries ×
 * repetições), com quanto (a carga da ficha) e quanto foi da última vez — e
 * fica verde quando a carga de hoje já foi registrada, que é o "feito" da
 * aula. O toque abre o registro de carga.
 */

/** 22.5 → "22,5" | 20 → "20" */
export const kgFmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');

/**
 * A carga da ficha é texto livre: "12", "12kg" ou "elástico forte". Número
 * ganha "kg"; o resto aparece como foi escrito.
 */
export function formatarCarga(carga?: string | null): string | null {
  const v = (carga ?? '').trim();
  if (!v) return null;
  return /^\d+([.,]\d+)?$/.test(v) ? `${v.replace('.', ',')} kg` : v;
}

type Secao = { grupo: string; itens: { e: ExercicioTreino; n: number }[] };

/** Agrupa preservando a ordem em que os grupos aparecem na ficha. */
function agrupar(exercicios: ExercicioTreino[]): Secao[] {
  const secoes: Secao[] = [];
  exercicios.forEach((e, i) => {
    const grupo = e.grupo ?? '';
    let secao = secoes.find((s) => s.grupo === grupo);
    if (!secao) {
      secao = { grupo, itens: [] };
      secoes.push(secao);
    }
    secao.itens.push({ e, n: i + 1 });
  });
  return secoes;
}

export type ExercicioAberto = { nome: string; reps: string; carga?: string | null };

interface Props {
  exercicios: ExercicioTreino[];
  /** Evolução de carga já registrada para o exercício, se houver. */
  evolucaoDe: (nome: string) => EvolucaoExercicio | null;
  /**
   * Abre o registro de carga. Vem com a ficha inteira em `sequencia`, para o
   * registro poder seguir para o próximo exercício sem voltar à lista.
   */
  onAbrirCarga: (exercicio: ExercicioAberto & { sequencia: ExercicioAberto[] }) => void;
}

export function FichaExercicios({ exercicios, evolucaoDe, onAbrirCarga }: Props) {
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({});
  if (exercicios.length === 0) return null;

  const secoes = agrupar(exercicios);
  const alternar = (grupo: string) => setRecolhidos((r) => ({ ...r, [grupo]: !r[grupo] }));
  const sequencia: ExercicioAberto[] = exercicios.map((e) => ({ nome: e.nome, reps: e.repeticoes, carga: e.carga }));
  const blocos = conjugacoes(exercicios);

  return (
    <View style={s.lista}>
      {secoes.map((secao) => {
        const recolhido = !!recolhidos[secao.grupo];
        const feitos = secao.itens.filter(({ e }) => cargaDeHoje(evolucaoDe(e.nome))).length;
        return (
          <View key={secao.grupo || 'sem-grupo'} style={s.secao}>
            {secao.grupo ? (
              <Pressable
                style={s.grupo}
                onPress={() => alternar(secao.grupo)}
                accessibilityRole="button"
                accessibilityState={{ expanded: !recolhido }}
                accessibilityLabel={`${recolhido ? 'Mostrar' : 'Esconder'} ${secao.grupo}`}
              >
                <Text style={s.grupoNome}>{secao.grupo}</Text>
                <View style={s.grupoLinha} />
                <Text style={s.grupoConta}>
                  {feitos > 0 ? `${feitos}/${secao.itens.length} feitos` : secao.itens.length}
                </Text>
                <Icon name={recolhido ? 'chevron-down' : 'chevron-up'} size={14} color={LC.textMuted} />
              </Pressable>
            ) : null}

            {recolhido
              ? null
              : secao.itens.map(({ e, n }) => {
                  const evo = evolucaoDe(e.nome);
                  const hoje = cargaDeHoje(evo);
                  const carga = formatarCarga(e.carga);
                  // A última carga ANTES de hoje: é o "quanto foi da última vez".
                  const anteriores = (evo?.registros ?? []).filter((r) => r !== hoje);
                  const ultima = anteriores[anteriores.length - 1];
                  const subiu = hoje && ultima ? hoje.peso - ultima.peso : 0;
                  const bloco = blocos.get(n - 1);
                  return (
                    <Pressable
                      key={e.id}
                      style={({ pressed }) => [s.cartao, bloco && s.cartaoConjugado, hoje && s.cartaoFeito, pressed && s.cartaoApertado]}
                      onPress={() => onAbrirCarga({ nome: e.nome, reps: e.repeticoes, carga: e.carga, sequencia })}
                      accessibilityRole="button"
                      accessibilityLabel={`Carga de ${e.nome}`}
                    >
                      <View style={[s.numero, hoje && s.numeroFeito]}>
                        {hoje ? (
                          <Icon name="checkmark" size={15} color="#fff" />
                        ) : (
                          <Text style={s.numeroTexto}>{n}</Text>
                        )}
                      </View>

                      <View style={s.meio}>
                        <Text style={s.nome}>{e.nome}</Text>
                        {bloco ? (
                          <View style={s.conjugadoLinha}>
                            <Icon name="link-outline" size={12} color={LC.primaryDark} />
                            <Text style={s.conjugadoTexto} numberOfLines={2}>
                              <Text style={s.conjugadoRotulo}>{bloco.rotulo.toUpperCase()}</Text> com {juntarParceiros(bloco.parceiros)}
                            </Text>
                          </View>
                        ) : null}
                        <View style={s.metaLinha}>
                          <View style={s.series}>
                            <Text style={s.seriesTexto}>
                              {e.series} × {e.repeticoes}
                            </Text>
                          </View>
                          {e.observacao ? (
                            <Text style={s.obs} numberOfLines={2}>
                              {e.observacao}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={s.direita}>
                        {hoje ? (
                          <>
                            <Text style={[s.carga, { color: LC.successFg }]}>{kgFmt(hoje.peso)} kg</Text>
                            <Text style={[s.ultima, { color: LC.successFg }]}>
                              hoje{subiu > 0 ? ` · +${kgFmt(subiu)}` : ''}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text style={[s.carga, !carga && s.cargaVazia]}>{carga ?? '—'}</Text>
                            {ultima ? (
                              <View style={s.ultimaLinha}>
                                <Icon name="time-outline" size={11} color={LC.textSecondary} />
                                <Text style={s.ultimaTexto}>última {kgFmt(ultima.peso)}</Text>
                              </View>
                            ) : (
                              <Text style={s.semRegistro}>registrar</Text>
                            )}
                          </>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  lista: { marginTop: 10 },
  secao: { marginBottom: 6 },

  grupo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  grupoNome: {
    fontSize: 11.5, fontWeight: '800', color: LC.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase',
  },
  grupoLinha: { flex: 1, height: 1, backgroundColor: LC.borderStrong },
  grupoConta: { fontSize: 11.5, fontWeight: '700', color: LC.textMuted },

  cartao: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: LC.bgCard, borderRadius: 14, borderWidth: 1, borderColor: LC.border,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8,
    ...LC.shadow,
  },
  cartaoFeito: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  /* Bloco de bi-set: a borda da esquerda na cor da marca liga os cartões. */
  cartaoConjugado: { borderLeftWidth: 4, borderLeftColor: LC.primary },
  conjugadoLinha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  conjugadoTexto: { flexShrink: 1, fontSize: 12, color: LC.primaryDark },
  conjugadoRotulo: { fontWeight: '800', letterSpacing: 0.4 },
  cartaoApertado: { backgroundColor: LC.primaryLight, borderColor: LC.primarySoft },

  numero: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: LC.neutralBg,
    alignItems: 'center', justifyContent: 'center',
  },
  numeroFeito: { backgroundColor: LC.success },
  numeroTexto: { fontSize: 13, fontWeight: '800', color: LC.textSecondary },

  meio: { flex: 1, minWidth: 0 },
  nome: { fontSize: 14.5, fontWeight: '700', color: LC.textPrimary, letterSpacing: 0.1 },
  metaLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  series: { backgroundColor: LC.primaryLight, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  seriesTexto: { fontSize: 12.5, fontWeight: '800', color: LC.primaryDark },
  obs: { flexShrink: 1, fontSize: 12, color: LC.textSecondary, fontStyle: 'italic' },

  direita: { alignItems: 'flex-end', minWidth: 70 },
  carga: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  cargaVazia: { color: LC.textMuted },
  ultimaLinha: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  ultima: { fontSize: 11.5, fontWeight: '600', color: LC.textSecondary, marginTop: 3 },
  ultimaTexto: { fontSize: 11.5, fontWeight: '600', color: LC.textSecondary },
  semRegistro: { fontSize: 11.5, fontWeight: '700', color: LC.primary, marginTop: 3 },
});
