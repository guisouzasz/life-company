import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import type { ExercicioTreino } from '../../services/treinos/treinos.types';
import type { EvolucaoExercicio } from '../../services/cargas/cargas.types';

/**
 * Ficha de musculação no formato de tabela impressa: colunas Exercício,
 * Repetições e Carga, com os exercícios agrupados por músculo.
 *
 * O selo escuro do grupo recolhe e expande a seção. Numa ficha longa isso
 * evita rolagem, e faz o "+" ser um controle de verdade em vez de enfeite.
 */

/** 22.5 → "22,5" | 20 → "20" */
const kgFmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');

/**
 * A carga é texto livre: o professor escreve "12", "12kg" ou "elástico forte".
 * Quando é só número, ganha o "Kg" para a coluna ficar uniforme; qualquer
 * outra coisa aparece exatamente como foi digitada.
 */
function formatarCarga(carga?: string | null): string {
  const v = (carga ?? '').trim();
  if (!v) return '—';
  return /^\d+([.,]\d+)?$/.test(v) ? `${v.replace('.', ',')} Kg` : v;
}

type Secao = { grupo: string; itens: ExercicioTreino[] };

/** Agrupa preservando a ordem em que os grupos aparecem na ficha. */
function agrupar(exercicios: ExercicioTreino[]): Secao[] {
  const secoes: Secao[] = [];
  for (const e of exercicios) {
    const grupo = e.grupo ?? '';
    let secao = secoes.find((s) => s.grupo === grupo);
    if (!secao) {
      secao = { grupo, itens: [] };
      secoes.push(secao);
    }
    secao.itens.push(e);
  }
  return secoes;
}

interface Props {
  exercicios: ExercicioTreino[];
  /** Evolução de carga já registrada para o exercício, se houver. */
  evolucaoDe: (nome: string) => EvolucaoExercicio | null;
  /** Abre o histórico/registro de carga do exercício. */
  onAbrirCarga: (exercicio: { nome: string; reps: string }) => void;
}

export function FichaExercicios({ exercicios, evolucaoDe, onAbrirCarga }: Props) {
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({});
  if (exercicios.length === 0) return null;

  const secoes = agrupar(exercicios);
  const alternar = (grupo: string) => setRecolhidos((r) => ({ ...r, [grupo]: !r[grupo] }));

  return (
    <View style={s.tabela}>
      {/* Cabeçalho das colunas */}
      <View style={s.cabecalho}>
        <Text style={[s.colTitulo, s.colNome]}>Exercício</Text>
        <Text style={[s.colTitulo, s.colReps]}>Repetições</Text>
        <Text style={[s.colTitulo, s.colCarga]}>Carga</Text>
        <View style={s.colAcao} />
      </View>

      {secoes.map((secao) => {
        const recolhido = !!recolhidos[secao.grupo];
        return (
          <View key={secao.grupo || 'sem-grupo'}>
            {secao.grupo ? (
              <Pressable
                style={({ pressed }) => [s.linhaGrupo, pressed && s.linhaPressionada]}
                onPress={() => alternar(secao.grupo)}
                accessibilityRole="button"
                accessibilityState={{ expanded: !recolhido }}
                accessibilityLabel={`${recolhido ? 'Expandir' : 'Recolher'} grupo ${secao.grupo}`}
              >
                <View style={s.selo}>
                  <Icon name={recolhido ? 'add' : 'remove'} size={15} color="#fff" />
                </View>
                <Text style={s.grupoNome}>GRUPO: {secao.grupo.toUpperCase()}</Text>
                {recolhido ? (
                  <Text style={s.grupoContagem}>
                    {secao.itens.length} {secao.itens.length === 1 ? 'exercício' : 'exercícios'}
                  </Text>
                ) : null}
              </Pressable>
            ) : null}

            {recolhido
              ? null
              : secao.itens.map((e) => {
                  const evo = evolucaoDe(e.nome);
                  return (
                    <Pressable
                      key={e.id}
                      style={({ pressed }) => [s.linha, pressed && s.linhaPressionada]}
                      onPress={() => onAbrirCarga({ nome: e.nome, reps: e.repeticoes })}
                      accessibilityRole="button"
                      accessibilityLabel={`Carga de ${e.nome}`}
                    >
                      <View style={s.colNome}>
                        <Text style={s.exNome}>{e.nome}</Text>
                        {e.observacao ? <Text style={s.exObs}>({e.observacao})</Text> : null}
                      </View>

                      <Text style={[s.valor, s.colReps]}>
                        {e.series} x {e.repeticoes}
                      </Text>

                      <View style={s.colCarga}>
                        <Text style={s.valor}>{formatarCarga(e.carga)}</Text>
                        {evo ? (
                          <View style={s.evoRow}>
                            <Icon
                              name={evo.evolucaoKg > 0 ? 'trending-up' : evo.evolucaoKg < 0 ? 'trending-down' : 'remove'}
                              size={11}
                              color={evo.evolucaoKg > 0 ? LC.success : evo.evolucaoKg < 0 ? LC.danger : LC.textMuted}
                            />
                            <Text style={s.evoTexto}>
                              {kgFmt(evo.atual)}
                              {evo.evolucaoKg !== 0 ? ` (${evo.evolucaoKg > 0 ? '+' : ''}${kgFmt(evo.evolucaoKg)})` : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={s.colAcao}>
                        <Icon name="stats-chart-outline" size={15} color={LC.primary} />
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
  tabela: { marginTop: 12, borderTopWidth: 1, borderTopColor: LC.borderStrong },

  cabecalho: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: LC.borderStrong },
  colTitulo: { fontSize: 12.5, color: LC.textSecondary },

  // Colunas: nome ocupa o resto; as duas de números têm largura fixa para alinhar
  colNome: { flex: 1, paddingRight: 8 },
  colReps: { width: 78 },
  colCarga: { width: 66 },
  colAcao: { width: 22, alignItems: 'flex-end' },

  linhaGrupo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: LC.border,
  },
  selo: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: LC.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  grupoNome: { flex: 1, fontSize: 13.5, fontWeight: '800', color: LC.textPrimary, letterSpacing: 0.3 },
  grupoContagem: { fontSize: 11.5, color: LC.textMuted },

  linha: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: LC.border,
  },
  linhaPressionada: { backgroundColor: LC.neutralBg },
  exNome: { fontSize: 13.5, color: LC.textPrimary, textTransform: 'uppercase', letterSpacing: 0.2 },
  exObs: { fontSize: 12, color: LC.textMuted, marginTop: 2 },
  valor: { fontSize: 13.5, color: LC.textPrimary },
  evoRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  evoTexto: { fontSize: 11, fontWeight: '700', color: LC.textSecondary },
});
