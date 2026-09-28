import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LC } from '../../constants/theme';
import { AppModal } from '../ui/modal';
import { Icon } from '../ui/icon';
import { Loading } from '../ui/states';
import { useCargasDoAluno } from '../../services/cargas/cargas.queries';
import { useRegistrarCarga, useRemoverCarga } from '../../services/cargas/cargas.mutations';
import type { EvolucaoExercicio } from '../../services/cargas/cargas.types';
import { formatDate } from '../../services/date';
import { ApiError } from '../../services/http';
import { nomeCurto } from '../../services/nome';
import { cargaDeHoje } from './situacao';
import { formatarCarga, kgFmt, type ExercicioAberto } from './ficha-exercicios';

/**
 * Registrar a carga de um exercício, no meio da aula.
 *
 * Quem usa isto está em pé, com o celular numa mão e o aluno esperando. Antes
 * era um campo de texto: tocar, esperar o teclado, apagar o número, digitar
 * "117,5", fechar o teclado, achar o botão. Agora o caso comum é um toque —
 * "+2,5" ou "mesma carga" — e o botão já diz o que vai gravar.
 *
 * Depois de gravar, o próximo exercício da ficha está a um toque: a aula é
 * uma sequência, e voltar à lista a cada exercício era o que fazia o
 * professor desistir de registrar.
 */

interface Props {
  /** Exercício aberto (null = fechado). */
  exercicio: string | null;
  alunoId?: string;
  alunoNome?: string;
  /** Repetições da ficha, sugeridas no registro. */
  repeticoesPadrao?: string;
  /** Carga escrita na ficha ("40", "elástico"): referência e ponto de partida. */
  cargaFicha?: string | null;
  /** A ficha inteira, na ordem: habilita "próximo exercício". */
  sequencia?: ExercicioAberto[];
  /** Troca o exercício aberto (próximo da sequência). */
  onIr?: (e: ExercicioAberto) => void;
  onClose: () => void;
}

/** "22,5" → 22.5; vazio ou inválido → NaN. */
const lerKg = (t: string) => Number(t.replace(',', '.').replace(/[^\d.]/g, ''));

/** Gráfico de barras da evolução (últimos 8 registros). */
function GraficoEvolucao({ evo }: { evo: EvolucaoExercicio }) {
  const registros = evo.registros.slice(-8);
  const max = Math.max(...registros.map((r) => r.peso), 1);
  const min = Math.min(...registros.map((r) => r.peso));
  // Base acima de zero: diferenças de 2,5 kg precisam aparecer.
  const base = min > 0 && max > min ? min * 0.8 : 0;

  return (
    <View style={s.grafico}>
      {registros.map((r, i) => {
        const pct = max > base ? ((r.peso - base) / (max - base)) * 100 : 100;
        const ultimo = i === registros.length - 1;
        return (
          <View key={r.id} style={s.barraCol}>
            <Text style={[s.barraValor, ultimo && s.barraValorAtual]}>{kgFmt(r.peso)}</Text>
            <View style={s.barraTrilho}>
              <View style={[s.barra, { height: `${Math.max(pct, 8)}%` }, r.peso === evo.recorde && s.barraRecorde, ultimo && s.barraAtual]} />
            </View>
            <Text style={s.barraData}>{formatDate(new Date(r.data), 'DD/MM')}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function CargaExercicioModal({
  exercicio, alunoId, alunoNome, repeticoesPadrao, cargaFicha, sequencia, onIr, onClose,
}: Props) {
  const cargas = useCargasDoAluno(alunoId, !!exercicio);
  const registrar = useRegistrarCarga();
  const remover = useRemoverCarga();

  const [peso, setPeso] = useState('');
  const [reps, setReps] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  /** O que acabou de ser gravado — vira o cartão de "registrado". */
  const [salvo, setSalvo] = useState<{ id?: string; peso: number; recorde: boolean; subiu: number } | null>(null);

  const evo = (cargas.data ?? []).find((e) => e.exercicio === exercicio) ?? null;
  const deHoje = cargaDeHoje(evo);
  const anterior = useMemo(() => {
    const lista = (evo?.registros ?? []).filter((r) => r !== deHoje);
    return lista[lista.length - 1] ?? null;
  }, [evo, deHoje]);
  const numeroDaFicha = lerKg(cargaFicha ?? '');

  // Ponto de partida: o de hoje, se já registrou; senão o da última vez;
  // senão o que está escrito na ficha.
  useEffect(() => {
    if (!exercicio) return;
    const base = deHoje?.peso ?? anterior?.peso ?? (Number.isFinite(numeroDaFicha) && numeroDaFicha > 0 ? numeroDaFicha : null);
    setPeso(base != null ? kgFmt(base) : '');
    setReps(repeticoesPadrao ?? '');
    setErro(null);
    setConfirmandoId(null);
    setSalvo(null);
    setVerHistorico(false);
    // Só quando troca o exercício ou chegam os dados; não a cada gravação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercicio, cargas.isSuccess]);

  const valor = lerKg(peso);
  const passo = Number.isFinite(valor) && valor > 0 && valor < 10 ? 1 : 2.5;
  const somar = (d: number) => {
    const atual = Number.isFinite(valor) ? valor : 0;
    setPeso(kgFmt(Math.max(0, Math.round((atual + d) * 100) / 100)));
    setSalvo(null);
  };

  const i = sequencia ? sequencia.findIndex((e) => e.nome === exercicio) : -1;
  const proximo = sequencia && i >= 0 && i < sequencia.length - 1 ? sequencia[i + 1] : null;

  const salvar = () => {
    if (!alunoId || !exercicio) return;
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe a carga em kg (ex: 22,5)');
      return;
    }
    setErro(null);
    const recordeAntes = evo?.recorde ?? 0;
    const base = anterior?.peso;
    registrar.mutate(
      { alunoId, exercicio, peso: valor, repeticoes: reps.trim() || undefined },
      {
        onSuccess: (r) =>
          setSalvo({ id: r?.id, peso: valor, recorde: !!evo && valor > recordeAntes, subiu: base != null ? valor - base : 0 }),
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar.'),
      },
    );
  };

  const sinal = evo && evo.evolucaoKg > 0 ? '+' : '';
  const fichaTexto = [repeticoesPadrao ? `${repeticoesPadrao} reps` : null, formatarCarga(cargaFicha)].filter(Boolean).join(' · ');

  return (
    <AppModal visible={!!exercicio} onClose={onClose} title={exercicio ?? ''} larguraMax={480}>
      <Text style={s.sub}>
        {alunoNome ? nomeCurto(alunoNome) : ''}
        {fichaTexto ? `  ·  na ficha: ${fichaTexto}` : ''}
      </Text>

      {cargas.isLoading ? (
        <View style={{ height: 120 }}>
          <Loading />
        </View>
      ) : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {evo ? (
            <>
              <View style={s.resumo}>
                <View style={s.resumoItem}>
                  <Text style={s.resumoValor}>{kgFmt(evo.atual)}<Text style={s.resumoUn}> kg</Text></Text>
                  <Text style={s.resumoRotulo}>Última</Text>
                </View>
                <View style={s.resumoDiv} />
                <View style={s.resumoItem}>
                  <Text style={[s.resumoValor, evo.evolucaoKg > 0 && { color: LC.successFg }, evo.evolucaoKg < 0 && { color: LC.dangerFg }]}>
                    {sinal}{kgFmt(evo.evolucaoKg)}<Text style={s.resumoUn}> kg</Text>
                  </Text>
                  <Text style={s.resumoRotulo}>Evolução{evo.evolucaoPct ? ` (${sinal}${evo.evolucaoPct}%)` : ''}</Text>
                </View>
                <View style={s.resumoDiv} />
                <View style={s.resumoItem}>
                  <Text style={s.resumoValor}>{kgFmt(evo.recorde)}<Text style={s.resumoUn}> kg</Text></Text>
                  <Text style={s.resumoRotulo}>Recorde</Text>
                </View>
              </View>
              {evo.registros.length > 1 ? <GraficoEvolucao evo={evo} /> : null}
            </>
          ) : (
            <View style={s.vazio}>
              <Icon name="trending-up-outline" size={24} color={LC.primary} />
              <Text style={s.vazioTexto}>Primeira carga deste exercício — registre para começar a evolução.</Text>
            </View>
          )}

          {salvo ? (
            /* Gravado: confirma o que foi, e o próximo passo é o próximo exercício. */
            <View style={s.salvo} accessibilityRole="alert">
              <View style={s.salvoTopo}>
                <View style={s.salvoIcone}>
                  <Icon name={salvo.recorde ? 'trophy' : 'checkmark'} size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.salvoTitulo}>
                    {salvo.recorde ? 'Novo recorde!' : 'Carga registrada'}
                  </Text>
                  <Text style={s.salvoTexto}>
                    {kgFmt(salvo.peso)} kg hoje
                    {salvo.subiu > 0 ? ` · +${kgFmt(salvo.subiu)} kg desde a última` : salvo.subiu < 0 ? ` · ${kgFmt(salvo.subiu)} kg desde a última` : ''}
                  </Text>
                </View>
              </View>
              {proximo && onIr ? (
                <Pressable
                  style={({ pressed }) => [s.proximo, pressed && { opacity: 0.85 }]}
                  onPress={() => onIr(proximo)}
                  accessibilityRole="button"
                  accessibilityLabel={`Próximo exercício: ${proximo.nome}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.proximoRotulo}>PRÓXIMO EXERCÍCIO</Text>
                    <Text style={s.proximoNome} numberOfLines={1}>{proximo.nome}</Text>
                  </View>
                  <Icon name="arrow-forward" size={20} color="#fff" />
                </Pressable>
              ) : (
                <Pressable style={s.fecharFicha} onPress={onClose} accessibilityRole="button">
                  <Text style={s.fecharFichaTexto}>{sequencia ? 'Fim da ficha — fechar' : 'Fechar'}</Text>
                </Pressable>
              )}
              {/* Errou o número: desfaz o registro e volta ao ajuste, sem
                  deixar um registro errado no histórico do aluno. */}
              <Pressable
                onPress={() => {
                  if (!salvo.id) return setSalvo(null);
                  remover.mutate(salvo.id, { onSuccess: () => setSalvo(null) });
                }}
                hitSlop={8}
                style={{ alignSelf: 'center', marginTop: 10 }}
                accessibilityRole="button"
              >
                <Text style={s.corrigir}>{remover.isPending ? 'Desfazendo…' : 'Desfazer e corrigir'}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {deHoje ? (
                <View style={s.jaHoje}>
                  <Icon name="checkmark-circle" size={15} color={LC.successFg} />
                  <Text style={s.jaHojeTexto}>Hoje já tem {kgFmt(deHoje.peso)} kg registrado — gravar de novo cria outro registro.</Text>
                </View>
              ) : null}

              {/* O número, grande, com − e + dos lados: ajuste sem teclado. */}
              <View style={s.stepper}>
                <Pressable
                  style={({ pressed }) => [s.stepBtn, pressed && s.stepBtnApertado]}
                  onPress={() => somar(-passo)}
                  accessibilityRole="button"
                  accessibilityLabel={`Diminuir ${kgFmt(passo)} quilos`}
                >
                  <Icon name="remove" size={26} color={LC.textPrimary} />
                </Pressable>
                <View style={s.valorCaixa}>
                  <TextInput
                    value={peso}
                    onChangeText={(t) => {
                      setPeso(t.replace(/[^\d,.]/g, ''));
                      setSalvo(null);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={LC.textMuted}
                    style={s.valorInput}
                    maxLength={6}
                    selectTextOnFocus
                    accessibilityLabel="Carga em quilos"
                  />
                  <Text style={s.valorUn}>kg</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [s.stepBtn, pressed && s.stepBtnApertado]}
                  onPress={() => somar(passo)}
                  accessibilityRole="button"
                  accessibilityLabel={`Aumentar ${kgFmt(passo)} quilos`}
                >
                  <Icon name="add" size={26} color={LC.textPrimary} />
                </Pressable>
              </View>

              <View style={s.atalhos}>
                {anterior ? (
                  <Pressable
                    style={[s.atalho, s.atalhoMesma]}
                    onPress={() => { setPeso(kgFmt(anterior.peso)); setSalvo(null); }}
                    accessibilityRole="button"
                  >
                    <Text style={[s.atalhoTexto, { color: LC.primaryDark }]}>Mesma ({kgFmt(anterior.peso)})</Text>
                  </Pressable>
                ) : null}
                {[1, 2.5, 5].map((d) => (
                  <Pressable key={d} style={s.atalho} onPress={() => somar(d)} accessibilityRole="button" accessibilityLabel={`Somar ${kgFmt(d)} quilos`}>
                    <Text style={s.atalhoTexto}>+{kgFmt(d)}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.repsLinha}>
                <Text style={s.repsRotulo}>Repetições</Text>
                <TextInput
                  value={reps}
                  onChangeText={setReps}
                  placeholder="12"
                  placeholderTextColor={LC.textMuted}
                  style={s.repsInput}
                  maxLength={12}
                  accessibilityLabel="Repetições"
                />
              </View>

              {erro ? <Text style={s.erro}>{erro}</Text> : null}

              <Pressable
                style={({ pressed }) => [s.registrar, (registrar.isPending || !(valor > 0)) && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}
                onPress={salvar}
                disabled={registrar.isPending}
                accessibilityRole="button"
                accessibilityLabel="Registrar carga"
              >
                <Icon name="checkmark" size={20} color="#fff" />
                <Text style={s.registrarTexto}>
                  {registrar.isPending ? 'Registrando…' : Number.isFinite(valor) && valor > 0 ? `Registrar ${kgFmt(valor)} kg` : 'Registrar carga'}
                </Text>
              </Pressable>
            </>
          )}

          {evo && evo.registros.length > 0 ? (
            <>
              <Pressable style={s.histBotao} onPress={() => setVerHistorico((v) => !v)} accessibilityRole="button">
                <Text style={s.histBotaoTexto}>
                  {verHistorico ? 'Esconder histórico' : `Ver histórico (${evo.registros.length})`}
                </Text>
                <Icon name={verHistorico ? 'chevron-up' : 'chevron-down'} size={15} color={LC.textSecondary} />
              </Pressable>
              {verHistorico
                ? [...evo.registros].reverse().map((r) => (
                    <View key={r.id} style={s.histLinha}>
                      <Text style={s.histData}>{formatDate(new Date(r.data), 'DD/MM/YYYY')}</Text>
                      <Text style={s.histPeso}>
                        {kgFmt(r.peso)} kg{r.repeticoes ? <Text style={s.histReps}>  ×{r.repeticoes}</Text> : null}
                      </Text>
                      {confirmandoId === r.id ? (
                        <View style={s.confirma}>
                          <Pressable
                            style={[s.confirmaBtn, { backgroundColor: LC.danger }]}
                            onPress={() => remover.mutate(r.id, { onSuccess: () => setConfirmandoId(null) })}
                            accessibilityRole="button"
                          >
                            <Text style={[s.confirmaTexto, { color: '#fff' }]}>{remover.isPending ? '…' : 'Apagar'}</Text>
                          </Pressable>
                          <Pressable style={[s.confirmaBtn, s.confirmaVoltar]} onPress={() => setConfirmandoId(null)} accessibilityRole="button">
                            <Text style={s.confirmaTexto}>Voltar</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={s.histApagar}
                          hitSlop={6}
                          onPress={() => setConfirmandoId(r.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Apagar registro de ${formatDate(new Date(r.data), 'DD/MM')}`}
                        >
                          <Icon name="trash-outline" size={14} color={LC.danger} />
                        </Pressable>
                      )}
                    </View>
                  ))
                : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </AppModal>
  );
}

const s = StyleSheet.create({
  sub: { fontSize: 13, color: LC.textSecondary, marginTop: -6, marginBottom: 12 },
  scroll: { maxHeight: 540 },

  resumo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: LC.bg, borderRadius: 14, paddingVertical: 12, marginBottom: 12,
  },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoDiv: { width: 1, height: 28, backgroundColor: LC.borderStrong },
  resumoValor: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  resumoUn: { fontSize: 12, fontWeight: '700', color: LC.textSecondary },
  resumoRotulo: { fontSize: 11, color: LC.textSecondary, marginTop: 2 },

  grafico: { height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 14 },
  barraCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barraValor: { fontSize: 10, fontWeight: '700', color: LC.textMuted, marginBottom: 3 },
  barraValorAtual: { color: LC.primary },
  barraTrilho: { flex: 1, width: '100%', maxWidth: 24, justifyContent: 'flex-end' },
  barra: { width: '100%', borderRadius: 5, backgroundColor: LC.primarySoft },
  barraRecorde: { backgroundColor: LC.primaryMid },
  barraAtual: { backgroundColor: LC.primary },
  barraData: { fontSize: 9, color: LC.textMuted, marginTop: 4 },

  vazio: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 12,
    borderRadius: 12, backgroundColor: LC.primaryLight,
  },
  vazioTexto: { flex: 1, fontSize: 13, color: LC.primaryDark, lineHeight: 18 },

  jaHoje: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, marginBottom: 10,
    borderRadius: 10, backgroundColor: LC.successBg,
  },
  jaHojeTexto: { flex: 1, fontSize: 12.5, color: LC.successFg, lineHeight: 17 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 58, height: 58, borderRadius: 18, backgroundColor: LC.neutralBg,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnApertado: { backgroundColor: LC.primarySoft },
  valorCaixa: {
    flex: 1, height: 64, borderRadius: 18, borderWidth: 2, borderColor: LC.primary,
    backgroundColor: LC.bgCard, justifyContent: 'center',
  },
  valorInput: {
    width: '100%', fontSize: 30, fontWeight: '800', color: LC.textPrimary, textAlign: 'center',
    paddingVertical: 0, paddingHorizontal: 34,
    // O contorno azul do navegador brigava com a borda da caixa.
    ...({ outlineStyle: 'none' } as object),
  },
  // Presa à direita da caixa: o número fica centrado e nunca encosta nela.
  valorUn: { position: 'absolute', right: 14, fontSize: 15, fontWeight: '700', color: LC.textSecondary },

  atalhos: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  atalho: {
    flexGrow: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 12, backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.borderStrong,
  },
  atalhoMesma: { backgroundColor: LC.primaryLight, borderColor: LC.primarySoft, flexGrow: 2 },
  atalhoTexto: { fontSize: 14, fontWeight: '800', color: LC.textPrimary },

  repsLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    paddingHorizontal: 14, height: 48, borderRadius: 12, backgroundColor: LC.bg,
  },
  repsRotulo: { flex: 1, fontSize: 13.5, fontWeight: '600', color: LC.textSecondary },
  repsInput: {
    width: 90, textAlign: 'right', fontSize: 16, fontWeight: '800', color: LC.textPrimary,
    ...({ outlineStyle: 'none' } as object),
  },

  erro: { fontSize: 12.5, color: LC.danger, marginTop: 8 },

  registrar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 56, borderRadius: 16, backgroundColor: LC.primary, marginTop: 14,
    ...LC.shadowCard,
  },
  registrarTexto: { fontSize: 16.5, fontWeight: '800', color: '#fff' },

  salvo: {
    padding: 14, borderRadius: 16, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
  },
  salvoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  salvoIcone: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: LC.success,
    alignItems: 'center', justifyContent: 'center',
  },
  salvoTitulo: { fontSize: 16, fontWeight: '800', color: LC.successFg },
  salvoTexto: { fontSize: 13, color: LC.successFg, marginTop: 2 },
  proximo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: LC.primary,
  },
  proximoRotulo: { fontSize: 10.5, fontWeight: '800', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.8 },
  proximoNome: { fontSize: 15.5, fontWeight: '800', color: '#fff', marginTop: 1 },
  fecharFicha: { marginTop: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: LC.bgCard, alignItems: 'center', borderWidth: 1, borderColor: LC.border },
  fecharFichaTexto: { fontSize: 14, fontWeight: '800', color: LC.textPrimary },
  corrigir: { fontSize: 12.5, fontWeight: '700', color: LC.textSecondary, textDecorationLine: 'underline' },

  histBotao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 14, marginTop: 4 },
  histBotaoTexto: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
  histLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: LC.border,
  },
  histData: { fontSize: 12.5, color: LC.textSecondary, width: 84 },
  histPeso: { flex: 1, fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  histReps: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },
  histApagar: { width: 30, height: 30, borderRadius: 15, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
  confirma: { flexDirection: 'row', gap: 6 },
  confirmaBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  confirmaVoltar: { backgroundColor: LC.neutralBg },
  confirmaTexto: { fontSize: 12.5, fontWeight: '800', color: LC.textPrimary },
});
