import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { nomeModalidade } from '../../constants/assets';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Loading } from '../ui/states';
import { usePlanos } from '../../services/planos/planos.queries';
import { useModalidades } from '../../services/modalidades/modalidades.queries';
import { useHorarios } from '../../services/horarios/horarios.queries';
import { useHorariosFixosDoAluno } from '../../services/horarios-fixos/horarios-fixos.queries';
import { useCriarHorarioFixo, useRemoverHorarioFixo } from '../../services/horarios-fixos/horarios-fixos.mutations';
import { useAtualizarPlanoAluno } from '../../services/usuarios/usuarios.mutations';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';
import type { DiaSemana } from '../../services/agendamentos/agendamentos.types';
import { addDays, formatDate } from '../../services/date';

const DIAS_ORDEM: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];

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
  const [diaSel, setDiaSel] = useState<DiaSemana>('SEGUNDA');
  const [duracaoSel, setDuracaoSel] = useState<Duracao>('sem-prazo');

  const planos = usePlanos();
  const modalidades = useModalidades();
  const horarios = useHorarios();
  const fixos = useHorariosFixosDoAluno(aluno?.id, !!aluno);
  const atualizarPlano = useAtualizarPlanoAluno();
  const criarFixo = useCriarHorarioFixo();
  const removerFixo = useRemoverHorarioFixo();

  const planoSelecionado = planoSel ?? planoAtual?.plano?.id;
  const aulasSemanais = planos.data?.find((p) => p.id === planoSelecionado)?.aulasSemanais ?? planoAtual?.plano?.aulasSemanais ?? 0;
  const ativosCount = fixos.data?.length ?? 0;
  const podeAdicionar = ativosCount < aulasSemanais;

  const horariosDoDia = useMemo(
    () => (horarios.data ?? []).filter((h) => h.ativo && h.diaSemana === diaSel),
    [horarios.data, diaSel],
  );
  const idsFixosAtivos = new Set((fixos.data ?? []).map((f) => f.horarioId));

  const primeiroNome = aluno?.nome.split(' ')[0] ?? '';

  const salvarPlano = () => {
    if (!aluno || !planoSelecionado) return;
    const modalidadeId = planoAtual?.modalidade?.id ?? modalidades.data?.[0]?.id;
    if (!modalidadeId) return;
    atualizarPlano.mutate({ id: aluno.id, payload: { planoId: planoSelecionado, modalidadeId } });
  };

  const adicionarHorario = (horarioId: string) => {
    if (!aluno) return;
    criarFixo.mutate({ usuarioId: aluno.id, payload: { horarioId, dataFim: dataFimDe(duracaoSel) } });
  };

  return (
    <AppModal visible={!!aluno} onClose={onClose} title={aluno ? `Plano e horário fixo — ${primeiroNome}` : ''}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Plano semanal */}
        <Text style={styles.sectionTitle}>Plano semanal</Text>
        <View style={styles.chips}>
          {planos.data?.map((p) => {
            const sel = planoSelecionado === p.id;
            return (
              <Pressable key={p.id} style={[styles.chip, sel && styles.chipSel]} onPress={() => setPlanoSel(p.id)}>
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{p.nome}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          title="Salvar plano"
          size="sm"
          variant="outline"
          fullWidth={false}
          loading={atualizarPlano.isPending}
          disabled={!planoSelecionado || planoSelecionado === planoAtual?.plano?.id}
          onPress={salvarPlano}
          style={styles.savePlano}
        />
        {ativosCount > aulasSemanais ? (
          <Text style={styles.aviso}>
            Este aluno tem {ativosCount} horários fixos ativos, acima do limite do plano selecionado ({aulasSemanais}x/semana).
            Eles continuam agendando normalmente — remova algum manualmente se quiser reduzir.
          </Text>
        ) : null}

        {/* Horários fixos */}
        <Text style={styles.sectionTitle}>
          Horários fixos ({ativosCount}/{aulasSemanais})
        </Text>
        {fixos.isLoading ? (
          <Loading />
        ) : !fixos.data || fixos.data.length === 0 ? (
          <Text style={styles.empty}>Nenhum horário fixo cadastrado.</Text>
        ) : (
          fixos.data.map((f) => (
            <View key={f.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowMain}>
                  {DIAS_PT[f.horario.diaSemana]} • {f.horario.horaInicio} — {nomeModalidade(f.horario.modalidade.nome)}
                </Text>
                <Text style={styles.rowSub}>
                  {f.dataFim ? `Até ${formatDate(f.dataFim, 'DD/MM/YYYY')}` : 'Sem prazo'}
                </Text>
              </View>
              <Pressable style={styles.revoke} hitSlop={6} onPress={() => removerFixo.mutate(f.id)}>
                <Icon name="trash-outline" size={16} color={LC.danger} />
              </Pressable>
            </View>
          ))
        )}

        {/* Adicionar horário fixo */}
        <Text style={styles.subTitle}>Adicionar horário fixo</Text>
        <View style={styles.chips}>
          {DIAS_ORDEM.map((dia) => {
            const sel = diaSel === dia;
            return (
              <Pressable key={dia} style={[styles.chip, sel && styles.chipSel]} onPress={() => setDiaSel(dia)}>
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{DIAS_PT[dia]}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chips}>
          {horariosDoDia.length === 0 ? (
            <Text style={styles.empty}>Sem horários cadastrados nesse dia.</Text>
          ) : (
            horariosDoDia.map((h) => {
              const jaAtivo = idsFixosAtivos.has(h.id);
              return (
                <Pressable
                  key={h.id}
                  style={[styles.chip, jaAtivo && styles.chipDisabled]}
                  disabled={jaAtivo || !podeAdicionar || criarFixo.isPending}
                  onPress={() => adicionarHorario(h.id)}
                >
                  <Text style={styles.chipText}>
                    {h.horaInicio} — {nomeModalidade(h.modalidade.nome)}
                    {jaAtivo ? ' (fixo)' : ''}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
        {!podeAdicionar ? (
          <Text style={styles.aviso}>Limite de horários fixos atingido para o plano atual ({aulasSemanais}x/semana).</Text>
        ) : null}

        <Text style={styles.subTitle}>Duração</Text>
        <View style={styles.chips}>
          {DURACOES.map((d) => {
            const sel = duracaoSel === d.key;
            return (
              <Pressable key={d.key} style={[styles.chip, sel && styles.chipSel]} onPress={() => setDuracaoSel(d.key)}>
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 460 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: LC.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4, marginBottom: 10 },
  subTitle: { fontSize: 13, fontWeight: '700', color: LC.textPrimary, marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: LC.radius.full, backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  chipTextSel: { color: LC.primary },
  savePlano: { marginTop: 12, alignSelf: 'flex-start' },
  aviso: { fontSize: 12, color: LC.danger, marginTop: 8, lineHeight: 17 },
  empty: { fontSize: 13, color: LC.textSecondary, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: LC.border },
  rowMain: { fontSize: 13, fontWeight: '700', color: LC.textPrimary },
  rowSub: { fontSize: 12, color: LC.textSecondary, marginTop: 1 },
  revoke: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
});
