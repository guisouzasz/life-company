import { useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../constants/theme';
import { STUDIO_NOME, DIAS_PT, DIAS_VALIDADE_CREDITO } from '../constants/app';
import { iconePorModalidade, nomeModalidade } from '../constants/assets';
import { TabBar } from '../components/tab-bar';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ConfirmModal, InfoModal } from '../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../components/ui/states';
import { useMeusAgendamentos } from '../services/agendamentos/agendamentos.queries';
import { useCancelarAgendamento } from '../services/agendamentos/agendamentos.mutations';
import type { Agendamento } from '../services/agendamentos/agendamentos.types';
import { podeCancelar, prazoLabel } from '../services/cancelamento';
import { ApiError } from '../services/http';
import { formatDate } from '../services/date';

export default function MinhasAulas() {
  const meus = useMeusAgendamentos();
  const cancelar = useCancelarAgendamento();
  const [alvo, setAlvo] = useState<Agendamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const confirmarCancelamento = () => {
    if (!alvo) return;
    cancelar.mutate(alvo.id, {
      onSuccess: () => setAlvo(null),
      onError: (e) => {
        setAlvo(null);
        setErro(e instanceof ApiError ? e.message : 'Não foi possível cancelar.');
      },
    });
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Minhas aulas</Text>
        <Text style={s.subtitle}>Seus próximos treinos agendados</Text>
      </View>

      {meus.isLoading ? (
        <Loading />
      ) : meus.isError ? (
        <ErrorState onRetry={() => meus.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => meus.refetch()} colors={[LC.primary]} tintColor={LC.primary} />}
        >
          {meus.data && meus.data.length > 0 ? (
            meus.data.map((ag) => {
              const liberado = podeCancelar(ag.dataAula, ag.horario.horaInicio);
              return (
                <Card key={ag.id} style={s.card} padding={16}>
                  <View style={s.dateBubble}>
                    <Text style={s.dateNum}>{formatDate(ag.dataAula, 'DD')}</Text>
                    <Text style={s.dateMes}>{formatDate(ag.dataAula, 'MMM')}</Text>
                  </View>
                  <View style={s.info}>
                    <View style={s.tituloRow}>
                      <Text style={s.modalidade}>{nomeModalidade(ag.horario.modalidade.nome)}</Text>
                      {ag.reposicao ? <Badge label="Reposição" variant="info" /> : null}
                    </View>
                    <View style={s.infoLine}>
                      <Icon name="time-outline" size={13} color={LC.textSecondary} />
                      <Text style={s.infoText}>
                        {DIAS_PT[ag.horario.diaSemana]} • {ag.horario.horaInicio} - {ag.horario.horaFim}
                      </Text>
                    </View>
                    <View style={s.infoLine}>
                      <Icon name="location-outline" size={13} color={LC.textMuted} />
                      <Text style={s.infoStudio}>{STUDIO_NOME}</Text>
                    </View>
                  </View>
                  {liberado ? (
                    <Button
                      title="Cancelar"
                      variant="danger-outline"
                      size="sm"
                      fullWidth={false}
                      onPress={() => setAlvo(ag)}
                      loading={cancelar.isPending && cancelar.variables === ag.id}
                      style={s.cancelBtn}
                    />
                  ) : (
                    <View style={s.prazoTag}>
                      <Text style={s.prazoText}>Prazo encerrado</Text>
                    </View>
                  )}
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhuma aula agendada"
              description="Reserve seu próximo treino na agenda."
              actionLabel="Ir para a agenda"
              onAction={() => router.push('/agendamento')}
            />
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
      <TabBar />

      <ConfirmModal
        visible={!!alvo}
        title="Cancelar aula"
        message={
          alvo
            ? `${nomeModalidade(alvo.horario.modalidade.nome)} • ${formatDate(alvo.dataAula, 'DD/MM')} às ${alvo.horario.horaInicio}.\n${prazoLabel(alvo.dataAula, alvo.horario.horaInicio)}.\n\n${
                alvo.reposicao
                  ? '⚠️ Esta é uma aula de reposição: ao cancelar, o crédito usado NÃO é devolvido.'
                  : `Cancelando dentro do prazo, você recebe 1 crédito de reposição (válido por ${DIAS_VALIDADE_CREDITO} dias).`
              }`
            : ''
        }
        confirmLabel="Cancelar aula"
        cancelLabel="Voltar"
        destructive
        loading={cancelar.isPending}
        onConfirm={confirmarCancelamento}
        onCancel={() => setAlvo(null)}
      />
      <InfoModal visible={!!erro} title="Não foi possível cancelar" message={erro ?? ''} onClose={() => setErro(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { ...LC.coluna, padding: 16, paddingBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  dateBubble: { width: 52, height: 52, borderRadius: 14, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  dateNum: { fontSize: 18, fontWeight: '800', color: LC.primary, lineHeight: 20 },
  dateMes: { fontSize: 10, fontWeight: '700', color: LC.primary, textTransform: 'uppercase' },
  info: { flex: 1, gap: 3 },
  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  modalidade: { fontSize: 16, fontWeight: '700', color: LC.textPrimary },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: 12, color: LC.textSecondary },
  infoStudio: { fontSize: 12, color: LC.textMuted },
  cancelBtn: { paddingHorizontal: 14 },
  prazoTag: { backgroundColor: LC.bg, borderRadius: LC.radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  prazoText: { fontSize: 11, fontWeight: '600', color: LC.textMuted },
});
