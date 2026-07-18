import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Icon } from '../ui/icon';
import { Loading } from '../ui/states';
import { useCargasDoAluno } from '../../services/cargas/cargas.queries';
import { useRegistrarCarga, useRemoverCarga } from '../../services/cargas/cargas.mutations';
import type { EvolucaoExercicio } from '../../services/cargas/cargas.types';
import { formatDate } from '../../services/date';
import { ApiError } from '../../services/http';

interface Props {
  /** Exercício selecionado (null = fechado). */
  exercicio: string | null;
  alunoId?: string;
  alunoNome?: string;
  /** Repetições sugeridas no treino, usadas como default do registro. */
  repeticoesPadrao?: string;
  onClose: () => void;
}

/** Formata peso sem casas desnecessárias: 22.5 → "22,5" | 20 → "20". */
function kg(v: number): string {
  return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

/** Gráfico de barras da evolução (últimos 10 registros). */
function GraficoEvolucao({ evo }: { evo: EvolucaoExercicio }) {
  const registros = evo.registros.slice(-10);
  const max = Math.max(...registros.map((r) => r.peso), 1);
  const min = Math.min(...registros.map((r) => r.peso));
  // Escala com base mínima para diferenças pequenas ficarem visíveis
  const base = min > 0 && max > min ? min * 0.85 : 0;

  return (
    <View style={s.chartArea}>
      {registros.map((r, i) => {
        const alturaPct = max > base ? ((r.peso - base) / (max - base)) * 100 : 100;
        const ehUltimo = i === registros.length - 1;
        const ehRecorde = r.peso === evo.recorde;
        return (
          <View key={r.id} style={s.chartCol}>
            <Text style={[s.chartValor, ehUltimo && s.chartValorAtual]}>{kg(r.peso)}</Text>
            <View style={s.chartTrack}>
              <View
                style={[
                  s.chartBar,
                  { height: `${Math.max(alturaPct, 6)}%` },
                  ehRecorde && s.chartBarRecorde,
                  ehUltimo && s.chartBarAtual,
                ]}
              />
            </View>
            <Text style={s.chartData}>{formatDate(r.data, 'DD/MM')}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Histórico de carga de UM exercício: evolução, gráfico e registro de nova carga.
 * Usado pelo professor dentro do treino do aluno.
 */
export function CargaExercicioModal({ exercicio, alunoId, alunoNome, repeticoesPadrao, onClose }: Props) {
  const cargas = useCargasDoAluno(alunoId, !!exercicio);
  const registrar = useRegistrarCarga();
  const remover = useRemoverCarga();

  const [peso, setPeso] = useState('');
  const [reps, setReps] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const evo = (cargas.data ?? []).find((e) => e.exercicio === exercicio) ?? null;

  useEffect(() => {
    if (exercicio) {
      // Pré-preenche com a última carga (o comum é repetir ou subir um pouco)
      const ultima = (cargas.data ?? []).find((e) => e.exercicio === exercicio)?.atual;
      setPeso(ultima != null ? kg(ultima) : '');
      setReps(repeticoesPadrao ?? '');
      setErro(null);
      setConfirmandoId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercicio, cargas.data]);

  const salvar = () => {
    if (!alunoId || !exercicio) return;
    const valor = Number(peso.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe a carga em kg (ex: 22,5)');
      return;
    }
    setErro(null);
    registrar.mutate(
      { alunoId, exercicio, peso: valor, repeticoes: reps.trim() || undefined },
      { onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar.') },
    );
  };

  const sinal = evo && evo.evolucaoKg > 0 ? '+' : '';

  return (
    <AppModal visible={!!exercicio} onClose={onClose} title={exercicio ?? ''}>
      {alunoNome ? <Text style={s.aluno}>{alunoNome}</Text> : null}

      {cargas.isLoading ? (
        <View style={{ height: 100 }}>
          <Loading />
        </View>
      ) : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Resumo da evolução */}
          {evo ? (
            <>
              <View style={s.resumo}>
                <View style={s.resumoItem}>
                  <Text style={s.resumoValor}>{kg(evo.atual)}<Text style={s.resumoUn}>kg</Text></Text>
                  <Text style={s.resumoLabel}>Atual</Text>
                </View>
                <View style={s.resumoDiv} />
                <View style={s.resumoItem}>
                  <Text style={[s.resumoValor, evo.evolucaoKg > 0 && { color: LC.success }, evo.evolucaoKg < 0 && { color: LC.danger }]}>
                    {sinal}{kg(evo.evolucaoKg)}<Text style={s.resumoUn}>kg</Text>
                  </Text>
                  <Text style={s.resumoLabel}>
                    Evolução {evo.evolucaoPct !== 0 ? `(${sinal}${evo.evolucaoPct}%)` : ''}
                  </Text>
                </View>
                <View style={s.resumoDiv} />
                <View style={s.resumoItem}>
                  <Text style={s.resumoValor}>{kg(evo.recorde)}<Text style={s.resumoUn}>kg</Text></Text>
                  <Text style={s.resumoLabel}>Recorde</Text>
                </View>
              </View>

              {evo.registros.length > 1 ? <GraficoEvolucao evo={evo} /> : null}
            </>
          ) : (
            <View style={s.vazio}>
              <Icon name="trending-up-outline" size={26} color={LC.textMuted} />
              <Text style={s.vazioText}>Nenhuma carga registrada ainda.{'\n'}Registre a primeira abaixo.</Text>
            </View>
          )}

          {/* Registrar nova carga */}
          <View style={s.formRow}>
            <View style={{ flex: 1.2 }}>
              <Input
                label="Carga hoje (kg)"
                value={peso}
                onChangeText={setPeso}
                keyboardType="decimal-pad"
                placeholder="22,5"
                maxLength={6}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Repetições" value={reps} onChangeText={setReps} placeholder="12" maxLength={12} />
            </View>
          </View>
          {erro ? <Text style={s.erro}>{erro}</Text> : null}
          <Button
            title="Registrar carga"
            size="sm"
            loading={registrar.isPending}
            onPress={salvar}
            leftIcon={<Icon name="add" size={16} color="#fff" />}
            style={{ marginTop: 10 }}
          />

          {/* Histórico */}
          {evo && evo.registros.length > 0 ? (
            <>
              <Text style={s.histTitulo}>Histórico</Text>
              {[...evo.registros].reverse().map((r) => (
                <View key={r.id} style={s.histRow}>
                  <Text style={s.histData}>{formatDate(r.data, 'DD/MM/YYYY')}</Text>
                  <Text style={s.histPeso}>
                    {kg(r.peso)} kg{r.repeticoes ? <Text style={s.histReps}>  ×{r.repeticoes}</Text> : null}
                  </Text>
                  {confirmandoId === r.id ? (
                    <View style={s.confirmRow}>
                      <Button
                        title="Remover"
                        variant="danger"
                        size="sm"
                        fullWidth={false}
                        loading={remover.isPending}
                        onPress={() => remover.mutate(r.id, { onSuccess: () => setConfirmandoId(null) })}
                      />
                      <Button title="Voltar" variant="outline" size="sm" fullWidth={false} onPress={() => setConfirmandoId(null)} />
                    </View>
                  ) : (
                    <Pressable style={s.histDel} hitSlop={6} onPress={() => setConfirmandoId(r.id)}>
                      <Icon name="trash-outline" size={14} color={LC.danger} />
                    </Pressable>
                  )}
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </AppModal>
  );
}

const s = StyleSheet.create({
  aluno: { fontSize: 13, color: LC.textSecondary, marginBottom: 12 },
  scroll: { maxHeight: 460 },

  // Resumo
  resumo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: LC.bg, borderRadius: LC.radius.md, paddingVertical: 14, marginBottom: 14,
  },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoDiv: { width: 1, height: 30, backgroundColor: LC.border },
  resumoValor: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  resumoUn: { fontSize: 12, fontWeight: '700', color: LC.textSecondary },
  resumoLabel: { fontSize: 11, color: LC.textSecondary, marginTop: 2 },

  // Gráfico
  chartArea: { height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 18 },
  chartCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  chartValor: { fontSize: 10, fontWeight: '700', color: LC.textMuted, marginBottom: 3 },
  chartValorAtual: { color: LC.primary },
  chartTrack: { flex: 1, width: '100%', maxWidth: 26, justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 5, backgroundColor: LC.primarySoft },
  chartBarRecorde: { backgroundColor: LC.primaryMid },
  chartBarAtual: { backgroundColor: LC.primary },
  chartData: { fontSize: 9, color: LC.textMuted, marginTop: 5 },

  // Vazio
  vazio: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  vazioText: { fontSize: 13, color: LC.textSecondary, textAlign: 'center', lineHeight: 19 },

  // Form
  formRow: { flexDirection: 'row', gap: 10 },
  erro: { fontSize: 12, color: LC.danger, marginTop: 8 },

  // Histórico
  histTitulo: {
    fontSize: 12, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 20, marginBottom: 4,
  },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: LC.border,
  },
  histData: { fontSize: 12, color: LC.textSecondary, width: 78 },
  histPeso: { flex: 1, fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  histReps: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },
  histDel: { width: 30, height: 30, borderRadius: 15, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
  confirmRow: { flexDirection: 'row', gap: 6 },
});
