import { Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../constants/theme';
import { STUDIO_NOME, DIAS_PT } from '../constants/app';
import { iconePorModalidade } from '../constants/assets';
import { TabBar } from '../components/tab-bar';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Button } from '../components/ui/button';
import { Loading, EmptyState, ErrorState } from '../components/ui/states';
import { useMeusAgendamentos } from '../services/agendamentos/agendamentos.queries';
import { useCancelarAgendamento } from '../services/agendamentos/agendamentos.mutations';
import { ApiError } from '../services/http';
import { formatDate } from '../services/date';

export default function MinhasAulas() {
  const meus = useMeusAgendamentos();
  const cancelar = useCancelarAgendamento();

  const confirmarCancelamento = (id: string) => {
    Alert.alert('Cancelar aula', 'Tem certeza que deseja cancelar este agendamento?', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar aula',
        style: 'destructive',
        onPress: () =>
          cancelar.mutate(id, {
            onError: (e) => Alert.alert('Não foi possível cancelar', e instanceof ApiError ? e.message : 'Tente novamente.'),
          }),
      },
    ]);
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
            meus.data.map((ag) => (
              <Card key={ag.id} style={s.card} padding={16}>
                <View style={s.dateBubble}>
                  <Text style={s.dateNum}>{formatDate(ag.dataAula, 'DD')}</Text>
                  <Text style={s.dateMes}>{formatDate(ag.dataAula, 'MMM')}</Text>
                </View>
                <View style={s.info}>
                  <Text style={s.modalidade}>{ag.horario.modalidade.nome}</Text>
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
                <Button
                  title="Cancelar"
                  variant="danger-outline"
                  size="sm"
                  fullWidth={false}
                  onPress={() => confirmarCancelamento(ag.id)}
                  loading={cancelar.isPending && cancelar.variables === ag.id}
                  style={s.cancelBtn}
                />
              </Card>
            ))
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  dateBubble: { width: 52, height: 52, borderRadius: 14, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  dateNum: { fontSize: 18, fontWeight: '800', color: LC.primary, lineHeight: 20 },
  dateMes: { fontSize: 10, fontWeight: '700', color: LC.primary, textTransform: 'uppercase' },
  info: { flex: 1, gap: 3 },
  modalidade: { fontSize: 16, fontWeight: '700', color: LC.textPrimary },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: 12, color: LC.textSecondary },
  infoStudio: { fontSize: 12, color: LC.textMuted },
  cancelBtn: { paddingHorizontal: 14 },
});
