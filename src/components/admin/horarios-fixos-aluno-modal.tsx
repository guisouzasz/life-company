import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { iconePorModalidade, nomeModalidade } from '../../constants/assets';
import { AppModal, InfoModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Card } from '../ui/card';
import { Loading } from '../ui/states';
import { usePlanos } from '../../services/planos/planos.queries';
import { useModalidades } from '../../services/modalidades/modalidades.queries';
import { useHorarios } from '../../services/horarios/horarios.queries';
import { useHorariosFixosDoAluno } from '../../services/horarios-fixos/horarios-fixos.queries';
import { useAgendamentosDoAluno } from '../../services/agendamentos/agendamentos.queries';
import { useDesmarcarAgendamento } from '../../services/agendamentos/agendamentos.mutations';
import { useCriarHorarioFixo, useRemoverHorarioFixo } from '../../services/horarios-fixos/horarios-fixos.mutations';
import { useAtualizarPlanoAluno } from '../../services/usuarios/usuarios.mutations';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';
import type { DiaSemana } from '../../services/agendamentos/agendamentos.types';
import { addDays, formatDate } from '../../services/date';
import { nomeCurto } from '../../services/nome';

const DIAS_ORDEM: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
const DIAS_CURTO: Record<string, string> = {
  SEGUNDA: 'Seg',
  TERCA: 'Ter',
  QUARTA: 'Qua',
  QUINTA: 'Qui',
  SEXTA: 'Sex',
};

type Duracao = 'sem-prazo' | '1m' | '3m';
const DURACOES: { key: Duracao; label: string }[] = [
  { key: 'sem-prazo', label: 'Sem prazo' },
  { key: '1m', label: '1 mês' },
  { key: '3m', label: '3 meses' },
];

function dataFimDe(duracao: Duracao): string | undefined {
  if (duracao === '1m') return formatDate(addDays(new Date(), 30), 'YYYY-MM-DD');
  if (duracao === '3m') return formatDate(addDays(new Date(), 90), 'YYYY-MM-DD');
  return undefined;
}

export function HorariosFixosAlunoModal({ aluno, onClose }: { aluno: AlunoAdmin | null; onClose: () => void }) {
  const planoAtual = aluno?.usuarioPlanos?.[0];
  const [planoSel, setPlanoSel] = useState<string | undefined>(planoAtual?.plano?.id);
  const [modo, setModo] = useState<'ver' | 'adicionar'>('ver');
  const [diaSel, setDiaSel] = useState<DiaSemana>('SEGUNDA');
  const [modalidadeSel, setModalidadeSel] = useState<string | null>(null);
  const [duracaoSel, setDuracaoSel] = useState<Duracao>('sem-prazo');

  const planos = usePlanos();
  const modalidades = useModalidades();
  const horarios = useHorarios();
  const fixos = useHorariosFixosDoAluno(aluno?.id, !!aluno);
  const atualizarPlano = useAtualizarPlanoAluno();
  const criarFixo = useCriarHorarioFixo();
  /** Recado depois de mexer no horário fixo (aulas que não entraram, ou que foram canceladas). */
  const [aviso, setAviso] = useState<{ titulo: string; texto: string } | null>(null);
  const removerFixo = useRemoverHorarioFixo();
  const aulas = useAgendamentosDoAluno(aluno?.id, !!aluno);
  const cancelarAula = useDesmarcarAgendamento();

  const planoSelecionado = planoSel ?? planoAtual?.plano?.id;
  const aulasSemanais = planos.data?.find((p) => p.id === planoSelecionado)?.aulasSemanais ?? planoAtual?.plano?.aulasSemanais ?? 0;
  const ativosCount = fixos.data?.length ?? 0;
  const podeAdicionar = ativosCount < aulasSemanais;

  const diasComFixo = useMemo(() => {
    const set = new Set<DiaSemana>();
    (fixos.data ?? []).forEach((f) => set.add(f.horario.diaSemana));
    return set;
  }, [fixos.data]);

  const horariosDoDia = useMemo(
    () => (horarios.data ?? []).filter((h) => h.ativo && h.diaSemana === diaSel),
    [horarios.data, diaSel],
  );

  const modalidadesDoDia = useMemo(() => {
    const seen = new Map<string, { id: string; nome: string }>();
    horariosDoDia.forEach((h) => {
      if (!seen.has(h.modalidade.id)) seen.set(h.modalidade.id, h.modalidade);
    });
    return [...seen.values()];
  }, [horariosDoDia]);

  const horariosFiltrados = useMemo(
    () => modalidadeSel ? horariosDoDia.filter((h) => h.modalidade.id === modalidadeSel) : [],
    [horariosDoDia, modalidadeSel],
  );

  const idsFixosAtivos = new Set((fixos.data ?? []).map((f) => f.horarioId));

  /**
   * Aula marcada que não corresponde a nenhum horário fixo ativo. Reposição não
   * conta — essa é avulsa de propósito. As outras quase sempre são sobra de um
   * horário fixo que foi removido depois: continuam ocupando a semana do aluno
   * e derrubam o horário novo com "limite semanal", sem dar pista de onde veio.
   * A dona viu isso como o sistema "misturando" um aluno com outro.
   */
  const ehSolta = (ag: { horarioId: string; reposicao?: boolean }) =>
    !ag.reposicao && !!fixos.data && !idsFixosAtivos.has(ag.horarioId);
  const soltas = (aulas.data ?? []).filter(ehSolta).length;

  const primeiroNome = aluno ? nomeCurto(aluno.nome) : '';

  const fechar = () => {
    setModo('ver');
    onClose();
  };

  const salvarPlano = () => {
    if (!aluno || !planoSelecionado) return;
    const modalidadeId = planoAtual?.modalidade?.id ?? modalidades.data?.[0]?.id;
    if (!modalidadeId) return;
    atualizarPlano.mutate({ id: aluno.id, payload: { planoId: planoSelecionado, modalidadeId } });
  };

  const adicionarHorario = (horarioId: string) => {
    if (!aluno) return;
    criarFixo.mutate(
      { usuarioId: aluno.id, payload: { horarioId, dataFim: dataFimDe(duracaoSel) } },
      {
        onSuccess: (resposta) => {
          setModo('ver');
          /**
           * O horário fixo é só a combinação; quem coloca o aluno na aula é a
           * geração que roda em seguida. Quando ela não consegue (turma cheia,
           * semana do plano no limite), o fixo aparecia criado e o aluno não
           * entrava em aula nenhuma — sem ninguém avisar. Era assim que a dona
           * marcava alguém na sexta às 17h e depois não achava ele na turma.
           */
          const g = resposta?.geracao;
          if (!g) return;
          if (g.criados === 0 && g.erros > 0) {
            setAviso({
              titulo: 'Horário salvo, aulas não',
              texto:
                `O horário fixo foi salvo, mas nenhuma aula foi marcada para ${nomeCurto(aluno.nome)}: ` +
                (g.motivos?.join(' ') || 'não foi possível gerar as aulas.') +
                ' Resolva isso e adicione o horário de novo.',
            });
          } else if (g.erros > 0) {
            setAviso({
              titulo: 'Parte das aulas não entrou',
              texto:
                `${g.criados} aula(s) marcada(s), mas outras não: ` +
                (g.motivos?.join(' ') || 'não foi possível gerar todas.'),
            });
          }
        },
      },
    );
  };

  // ── Modo: Adicionar ────────────────────────────────────────────────
  if (modo === 'adicionar') {
    return (
      <AppModal visible={!!aluno} onClose={fechar} title="Adicionar horário fixo">
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Passo 1: Dia da semana */}
          <Text style={s.sectionLabel}>Dia da semana</Text>
          <View style={s.diaChips}>
            {DIAS_ORDEM.map((dia) => {
              const sel = diaSel === dia;
              return (
                <Pressable
                  key={dia}
                  style={[s.diaChip, sel && s.diaChipSel]}
                  onPress={() => { setDiaSel(dia); setModalidadeSel(null); }}
                >
                  <Text style={[s.diaChipText, sel && s.diaChipTextSel]}>{DIAS_CURTO[dia]}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Passo 2: Modalidade */}
          <Text style={s.sectionLabel}>Modalidade</Text>
          {modalidadesDoDia.length === 0 ? (
            <Text style={s.empty}>Sem aulas nesse dia.</Text>
          ) : (
            <View style={s.diaChips}>
              {modalidadesDoDia.map((m) => {
                const sel = modalidadeSel === m.id;
                const cor = corPorModalidade(m.nome);
                return (
                  <Pressable
                    key={m.id}
                    style={[s.modChip, sel && { backgroundColor: cor + '1A', borderColor: cor }]}
                    onPress={() => setModalidadeSel(sel ? null : m.id)}
                  >
                    <Icon name={iconePorModalidade(m.nome)} size={15} color={sel ? cor : LC.textSecondary} />
                    <Text style={[s.modChipText, sel && { color: cor }]}>{nomeModalidade(m.nome)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Passo 3: Horários disponíveis */}
          {modalidadeSel && (
            <>
              <Text style={s.sectionLabel}>Horário</Text>
              {horariosFiltrados.map((h) => {
                const jaAtivo = idsFixosAtivos.has(h.id);
                return (
                  <Card key={h.id} style={[s.horarioCard, jaAtivo && s.horarioCardDisabled]} padding={14}>
                    <View style={s.horarioCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.horarioNome}>{h.horaInicio} às {h.horaFim}</Text>
                      </View>
                      {jaAtivo ? (
                        <View style={s.jaFixoBadge}>
                          <Text style={s.jaFixoText}>Fixo</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={s.addBtn}
                          disabled={!podeAdicionar || criarFixo.isPending}
                          onPress={() => adicionarHorario(h.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Fixar ${h.horaInicio} para este aluno`}
                          hitSlop={6}
                        >
                          <Icon name="add" size={18} color={LC.primary} />
                        </Pressable>
                      )}
                    </View>
                  </Card>
                );
              })}
            </>
          )}

          {!podeAdicionar && (
            <View style={s.avisoRow}>
              <Icon name="alert-circle-outline" size={14} color={LC.danger} />
              <Text style={s.aviso}>Limite atingido ({aulasSemanais}x/semana).</Text>
            </View>
          )}

          <Text style={[s.sectionLabel, { marginTop: 18 }]}>Duração</Text>
          <View style={s.diaChips}>
            {DURACOES.map((d) => {
              const sel = duracaoSel === d.key;
              return (
                <Pressable key={d.key} style={[s.diaChip, sel && s.diaChipSel]} onPress={() => setDuracaoSel(d.key)}>
                  <Text style={[s.diaChipText, sel && s.diaChipTextSel]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Button
          title="Voltar"
          variant="outline"
          size="sm"
          onPress={() => setModo('ver')}
          style={{ marginTop: 16 }}
        />
      <InfoModal
        visible={!!aviso}
        title={aviso?.titulo ?? ''}
        message={aviso?.texto ?? ''}
        onClose={() => setAviso(null)}
      />
      </AppModal>
    );
  }

  // ── Modo: Ver (principal) ──────────────────────────────────────────
  return (
    <AppModal visible={!!aluno} onClose={fechar} title={aluno ? `Plano e horários — ${primeiroNome}` : ''}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Plano ─────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Plano semanal</Text>
        <View style={s.diaChips}>
          {planos.data?.map((p) => {
            const sel = planoSelecionado === p.id;
            return (
              <Pressable key={p.id} style={[s.diaChip, sel && s.diaChipSel]} onPress={() => setPlanoSel(p.id)}>
                <Text style={[s.diaChipText, sel && s.diaChipTextSel]}>{p.nome}</Text>
              </Pressable>
            );
          })}
        </View>
        {planoSelecionado && planoSelecionado !== planoAtual?.plano?.id && (
          <Button
            title="Salvar plano"
            size="sm"
            variant="outline"
            fullWidth={false}
            loading={atualizarPlano.isPending}
            onPress={salvarPlano}
            style={s.savePlano}
          />
        )}
        {ativosCount > aulasSemanais && (
          <View style={s.avisoRow}>
            <Icon name="alert-circle-outline" size={14} color={LC.danger} />
            <Text style={s.aviso}>
              {ativosCount} horários fixos — acima do plano ({aulasSemanais}x).
            </Text>
          </View>
        )}

        {/* ── Visão semanal (dots) ──────────────────────────────── */}
        <View style={s.divider} />
        <Text style={s.sectionLabel}>Horários fixos ({ativosCount}/{aulasSemanais})</Text>

        <View style={s.weekRow}>
          {DIAS_ORDEM.map((dia) => {
            const ativo = diasComFixo.has(dia);
            return (
              <View key={dia} style={s.weekDay}>
                <Text style={[s.weekDayText, ativo && s.weekDayTextAtivo]}>{DIAS_CURTO[dia]}</Text>
                {ativo && <View style={s.weekDot} />}
              </View>
            );
          })}
        </View>

        {/* ── Cards dos horários fixos ─────────────────────────── */}
        {fixos.isLoading ? (
          <View style={{ height: 60 }}><Loading /></View>
        ) : !fixos.data || fixos.data.length === 0 ? (
          <Text style={s.empty}>Nenhum horário fixo cadastrado.</Text>
        ) : (
          fixos.data.map((f) => (
            <Card key={f.id} style={s.fixoCard} padding={14} bordered>
              <View style={s.fixoCardRow}>
                <View style={[s.iconBubble, { backgroundColor: corPorModalidade(f.horario.modalidade.nome) + '1A' }]}>
                  <Icon name={iconePorModalidade(f.horario.modalidade.nome)} size={18} color={corPorModalidade(f.horario.modalidade.nome)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fixoModalidade}>{nomeModalidade(f.horario.modalidade.nome)}</Text>
                  <Text style={s.fixoDetalhe}>
                    {DIAS_PT[f.horario.diaSemana]} • {f.horario.horaInicio} às {f.horario.horaFim}
                  </Text>
                  {f.dataFim && (
                    <Text style={s.fixoDuracao}>Até {formatDate(f.dataFim, 'DD/MM/YYYY')}</Text>
                  )}
                </View>
                <Pressable
                  style={s.removeBtn}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${DIAS_PT[f.horario.diaSemana]} ${f.horario.horaInicio} deste aluno`}
                  onPress={() =>
                    removerFixo.mutate(f.id, {
                      onSuccess: (r) => {
                        // Tirar o horário fixo também desmarca as aulas que
                        // ele já tinha criado — a dona precisa ver isso, senão
                        // fica sem saber se o aluno saiu da turma de verdade.
                        if (r?.aulasCanceladas) {
                          setAviso({ titulo: 'Horário removido', texto: r.mensagem });
                        }
                      },
                    })
                  }
                >
                  <Icon name="trash-outline" size={15} color={LC.danger} />
                </Pressable>
              </View>
            </Card>
          ))
        )}

        {/* ── Adicionar ────────────────────────────────────────── */}
        {podeAdicionar && (
          <Pressable
            style={s.addHorarioBtn}
            onPress={() => {
              setDiaSel('SEGUNDA');
              setModalidadeSel(null);
              setDuracaoSel('sem-prazo');
              setModo('adicionar');
            }}
          >
            <Icon name="add-circle-outline" size={18} color={LC.primary} />
            <Text style={s.addHorarioText}>Adicionar horário</Text>
          </Pressable>
        )}

        {/* ── Aulas já marcadas ────────────────────────────────── */}
        {/*
          O horário fixo é a combinação; isto aqui é o que está realmente
          marcado. Sem esta lista a dona não tinha como achar aula que sobrou
          de um horário fixo antigo — e aula sobrando consome a cota da semana,
          fazendo o horário novo falhar com "Limite semanal atingido" sem que
          desse para ver a causa em lugar nenhum.
        */}
        <Text style={s.sectionLabel}>Próximas aulas marcadas</Text>
        {soltas > 0 && (
          <View style={s.soltasAviso}>
            <Icon name="alert-circle-outline" size={14} color={LC.warningFg} />
            <Text style={s.soltasAvisoText}>
              {soltas === 1 ? '1 aula está fora' : `${soltas} aulas estão fora`} dos horários fixos de cima.
              Costuma ser sobra de um horário fixo antigo: ela ocupa a semana do aluno e faz o horário
              novo falhar. Se não deveria estar aí, tire no ✕.
            </Text>
          </View>
        )}
        {aulas.isLoading ? (
          <View style={{ height: 50 }}><Loading /></View>
        ) : !aulas.data || aulas.data.length === 0 ? (
          <Text style={s.empty}>Nenhuma aula marcada daqui para frente.</Text>
        ) : (
          aulas.data.map((ag) => (
            <View key={ag.id} style={s.aulaLinha}>
              <View style={{ flex: 1 }}>
                <Text style={s.aulaTitulo}>
                  {nomeModalidade(ag.horario.modalidade.nome)} • {ag.horario.horaInicio}
                </Text>
                <Text style={s.aulaDetalhe}>
                  {formatDate(ag.dataAula, 'ddd, DD/MM')}
                  {ag.reposicao ? ' · reposição' : ''}
                </Text>
                {ehSolta(ag) && (
                  <View style={s.soltaBadge}>
                    <Text style={s.soltaBadgeText}>Fora dos horários fixos</Text>
                  </View>
                )}
              </View>
              <Pressable
                style={s.removeBtn}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Desmarcar aula de ${formatDate(ag.dataAula, 'DD/MM')} às ${ag.horario.horaInicio}`}
                disabled={cancelarAula.isPending}
                onPress={() =>
                  cancelarAula.mutate(ag.id, {
                    onSuccess: () =>
                      setAviso({
                        titulo: 'Aula desmarcada',
                        texto:
                          `${formatDate(ag.dataAula, 'DD/MM')} às ${ag.horario.horaInicio} foi desmarcada. ` +
                          'A vaga voltou para a turma e a semana do aluno ficou livre. ' +
                          'Não gerou crédito de reposição — isto é arrumação de agenda.',
                      }),
                  })
                }
              >
                <Icon name="close" size={16} color={LC.danger} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
      <InfoModal
        visible={!!aviso}
        title={aviso?.titulo ?? ''}
        message={aviso?.texto ?? ''}
        onClose={() => setAviso(null)}
      />
    </AppModal>
  );
}

function corPorModalidade(nome?: string): string {
  const n = (nome ?? '').toLowerCase();
  if (n.includes('pilates') || n.includes('yoga')) return '#3B82F6';
  if (n.includes('funcional')) return '#22C55E';
  return LC.primary;
}

const s = StyleSheet.create({
  aulaLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: LC.border,
  },
  aulaTitulo: { fontSize: 13.5, fontWeight: '700', color: LC.textPrimary },
  aulaDetalhe: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  soltaBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: LC.radius.full,
    backgroundColor: LC.warningBg,
  },
  soltaBadgeText: { fontSize: 10.5, fontWeight: '800', color: LC.warningFg },
  soltasAviso: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: LC.warningBg,
    borderRadius: LC.radius.md,
    padding: 10,
    marginBottom: 10,
  },
  soltasAvisoText: { flex: 1, fontSize: 11.5, color: LC.warningFg, lineHeight: 16 },
  scroll: { maxHeight: 480 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: LC.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: LC.border,
    marginVertical: 16,
  },

  // ── Chips (dias, planos, duração) ─────────────────────────────────
  diaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  diaChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: LC.radius.full,
    backgroundColor: LC.bg,
    borderWidth: 1.5,
    borderColor: LC.border,
  },
  diaChipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  diaChipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  diaChipTextSel: { color: LC.primary, fontWeight: '700' },

  // ── Plano ─────────────────────────────────────────────────────────
  savePlano: { marginTop: 12, alignSelf: 'flex-start' },

  // ── Visão semanal (dots) ──────────────────────────────────────────
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: LC.bg,
    borderRadius: LC.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  weekDay: { alignItems: 'center', gap: 5, minWidth: 36 },
  weekDayText: { fontSize: 13, fontWeight: '700', color: LC.textMuted },
  weekDayTextAtivo: { color: LC.primary },
  weekDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: LC.primary,
  },

  // ── Cards horário fixo ────────────────────────────────────────────
  fixoCard: { marginBottom: 10 },
  fixoCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixoModalidade: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  fixoDetalhe: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  fixoDuracao: { fontSize: 11, color: LC.textMuted, marginTop: 1 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LC.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Botão adicionar ───────────────────────────────────────────────
  addHorarioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 6,
    borderRadius: LC.radius.md,
    borderWidth: 1.5,
    borderColor: LC.primary,
    borderStyle: 'dashed',
  },
  addHorarioText: { fontSize: 14, fontWeight: '700', color: LC.primary },

  // ── Adicionar: chips de modalidade ─────────────────────────────────
  modChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: LC.radius.full,
    backgroundColor: LC.bg,
    borderWidth: 1.5,
    borderColor: LC.border,
  },
  modChipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },

  // ── Adicionar: cards de horário disponível ────────────────────────
  horarioCard: { marginBottom: 8 },
  horarioCardDisabled: { opacity: 0.45 },
  horarioCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  horarioNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  horarioHora: { fontSize: 12, color: LC.textSecondary, marginTop: 1 },
  jaFixoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LC.radius.full,
    backgroundColor: LC.primaryLight,
  },
  jaFixoText: { fontSize: 11, fontWeight: '700', color: LC.primary },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: LC.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Avisos ────────────────────────────────────────────────────────
  avisoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
  },
  aviso: { flex: 1, fontSize: 12, color: LC.danger, lineHeight: 17 },
  empty: { fontSize: 13, color: LC.textSecondary, textAlign: 'center', paddingVertical: 14 },
});