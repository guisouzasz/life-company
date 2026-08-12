import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { nomeModalidade } from '../../constants/assets';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Badge } from '../ui/badge';
import { Avatar } from '../ui/avatar';
import { Loading } from '../ui/states';
import { useAgendamentosDoHorario } from '../../services/agendamentos/agendamentos.queries';
import { useCancelarAgendamentoAdmin } from '../../services/agendamentos/agendamentos.mutations';
import type { HorarioAdmin } from '../../services/horarios/horarios.types';
import { ApiError } from '../../services/http';
import { formatDate, proximaDataDoDia } from '../../services/date';

/**
 * O mínimo que o modal precisa. Um HorarioAdmin completo satisfaz este tipo,
 * e as "aulas de hoje" do dashboard montam um objeto leve com os mesmos campos.
 */
export type HorarioDoModal = Pick<HorarioAdmin, 'id' | 'diaSemana' | 'horaInicio'> & {
  modalidade: { nome: string };
};

/**
 * Alunos agendados na PRÓXIMA ocorrência do horário (inclui hoje).
 * Cancelar pelo admin gera 1 crédito de reposição para o aluno.
 */
export function AlunosHorarioModal({ horario, onClose }: { horario: HorarioDoModal | null; onClose: () => void }) {
  const data = horario ? proximaDataDoDia(horario.diaSemana) : undefined;
  const agendamentos = useAgendamentosDoHorario(horario?.id, data, !!horario);
  const cancelar = useCancelarAgendamentoAdmin();

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fechar = () => {
    setConfirmandoId(null);
    setFeedback(null);
    onClose();
  };

  const cancelarAula = (id: string) => {
    cancelar.mutate(id, {
      onSuccess: (r) => {
        setConfirmandoId(null);
        setFeedback(r.mensagem);
      },
      onError: (e) => {
        setConfirmandoId(null);
        setFeedback(e instanceof ApiError ? e.message : 'Não foi possível cancelar.');
      },
    });
  };

  const titulo = horario
    ? `${DIAS_PT[horario.diaSemana]} ${horario.horaInicio} — ${nomeModalidade(horario.modalidade.nome)}`
    : '';

  return (
    <AppModal visible={!!horario} onClose={fechar} title={titulo}>
      {data ? <Text style={s.dataLabel}>Aula de {formatDate(data, 'dddd, DD/MM/YYYY')}</Text> : null}

      {feedback ? (
        <View style={s.feedback}>
          <Icon name="information-circle-outline" size={16} color={LC.primary} />
          <Text style={s.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      {agendamentos.isLoading ? (
        <View style={s.loading}>
          <Loading />
        </View>
      ) : !agendamentos.data || agendamentos.data.length === 0 ? (
        <Text style={s.empty}>Nenhum aluno agendado nesta aula.</Text>
      ) : (
        <ScrollView style={s.list}>
          {agendamentos.data.map((ag) => (
            <View key={ag.id} style={s.row}>
              <Avatar nome={ag.usuario.nome} size={34} />
              <View style={{ flex: 1 }}>
                <View style={s.rowNomeLinha}>
                  <Text style={s.rowNome}>{ag.usuario.nome}</Text>
                  {ag.reposicao ? <Badge label="Reposição" variant="info" /> : null}
                </View>
                <Text style={s.rowSub}>CPF {ag.usuario.cpf}</Text>
              </View>
              {confirmandoId === ag.id ? (
                <View style={s.confirmRow}>
                  <Button
                    title="Confirmar"
                    variant="danger"
                    size="sm"
                    fullWidth={false}
                    loading={cancelar.isPending}
                    onPress={() => cancelarAula(ag.id)}
                  />
                  <Button title="Voltar" variant="outline" size="sm" fullWidth={false} onPress={() => setConfirmandoId(null)} />
                </View>
              ) : (
                <Pressable style={s.cancelBtn} hitSlop={6} onPress={() => setConfirmandoId(ag.id)}>
                  <Icon name="trash-outline" size={16} color={LC.danger} />
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={s.hintRow}>
        <Icon name="ticket-outline" size={14} color={LC.textMuted} />
        <Text style={s.hint}>Cancelar pelo admin devolve 1 crédito de reposição ao aluno.</Text>
      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  dataLabel: { fontSize: 13, color: LC.textSecondary, marginBottom: 12 },
  feedback: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: LC.primaryLight, borderRadius: LC.radius.md,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
  },
  feedbackText: { flex: 1, fontSize: 13, color: LC.primaryDark, lineHeight: 18 },
  loading: { height: 80 },
  empty: { fontSize: 14, color: LC.textSecondary, textAlign: 'center', paddingVertical: 16 },
  list: { maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: LC.border },
  rowNomeLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  rowSub: { fontSize: 12, color: LC.textSecondary, marginTop: 1 },
  confirmRow: { flexDirection: 'row', gap: 6 },
  cancelBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: LC.border },
  hint: { flex: 1, fontSize: 12, color: LC.textMuted },
});
