import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { nomeModalidade } from '../../constants/assets';
import { AppModal } from '../ui/modal';
import { Icon } from '../ui/icon';
import { Badge } from '../ui/badge';
import { Avatar } from '../ui/avatar';
import { Loading } from '../ui/states';
import { useAgendamentosDoHorario } from '../../services/agendamentos/agendamentos.queries';
import { useMe } from '../../services/auth/auth.queries';
import type { HorarioVaga } from '../../services/horarios/horarios.types';
import { formatDate } from '../../services/date';

interface Props {
  aula: HorarioVaga | null;
  data?: string;
  onClose: () => void;
}

/**
 * Alunos de uma aula — visão do PROFESSOR (somente leitura).
 * Mostra quem é reposição e leva direto ao treino do aluno.
 */
export function AlunosAulaModal({ aula, data, onClose }: Props) {
  const agendamentos = useAgendamentosDoHorario(aula?.id, data, !!aula && !!data);

  // Funcional usa treino do DIA (não por aluno) → sem botão "Treinos" aqui
  const me = useMe();
  const treinoPorAluno = me.data?.modalidadeProfessor
    ? nomeModalidade(me.data.modalidadeProfessor.nome) !== 'Funcional'
    : true;

  const titulo = aula ? `${aula.horaInicio} — ${nomeModalidade(aula.modalidade.nome)}` : '';

  const verTreinos = (alunoId: string, nome: string) => {
    onClose();
    router.push({ pathname: '/professor/treinos-aluno' as any, params: { id: alunoId, nome } });
  };

  return (
    <AppModal visible={!!aula} onClose={onClose} title={titulo}>
      {data ? <Text style={s.dataLabel}>Aula de {formatDate(data, 'dddd, DD/MM/YYYY')}</Text> : null}

      {agendamentos.isLoading ? (
        <View style={{ height: 80 }}>
          <Loading />
        </View>
      ) : !agendamentos.data || agendamentos.data.length === 0 ? (
        <Text style={s.empty}>Nenhum aluno agendado nesta aula.</Text>
      ) : (
        <ScrollView style={s.list}>
          {agendamentos.data.map((ag) => (
            <View key={ag.id} style={s.row}>
              <Avatar nome={ag.usuario.nome} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowNome}>{ag.usuario.nome}</Text>
                {ag.reposicao ? (
                  <View style={{ marginTop: 3, alignSelf: 'flex-start' }}>
                    <Badge label="Reposição" variant="info" />
                  </View>
                ) : null}
              </View>
              {treinoPorAluno ? (
                <Pressable style={s.treinoBtn} hitSlop={6} onPress={() => verTreinos(ag.usuario.id, ag.usuario.nome)}>
                  <Icon name="barbell-outline" size={15} color={LC.primary} />
                  <Text style={s.treinoBtnText}>Treinos</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={s.hintRow}>
        <Icon name="eye-outline" size={14} color={LC.textMuted} />
        <Text style={s.hint}>Visualização da aula — alterações de agenda são feitas pela administração.</Text>
      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  dataLabel: { fontSize: 13, color: LC.textSecondary, marginBottom: 12 },
  empty: { fontSize: 14, color: LC.textSecondary, textAlign: 'center', paddingVertical: 16 },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: LC.border },
  rowNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  treinoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: LC.radius.full,
    backgroundColor: LC.primaryLight,
  },
  treinoBtnText: { fontSize: 12, fontWeight: '700', color: LC.primary },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: LC.border },
  hint: { flex: 1, fontSize: 12, color: LC.textMuted },
});
