import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/auth';
import { LC } from '../constants/theme';
import { STUDIO_NOME, DIAS_PT } from '../constants/app';
import { iconePorModalidade, nomeModalidade } from '../constants/assets';
import { TabBar } from '../components/tab-bar';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Button } from '../components/ui/button';
import { ConfirmModal, InfoModal } from '../components/ui/modal';
import { Loading } from '../components/ui/states';
import { SaldoDots } from '../components/ui/saldo-dots';
import { useSaldo } from '../services/usuarios/usuarios.queries';
import { useMeusAgendamentos, useHistorico } from '../services/agendamentos/agendamentos.queries';
import { useCancelarAgendamento } from '../services/agendamentos/agendamentos.mutations';
import type { Agendamento } from '../services/agendamentos/agendamentos.types';
import { podeCancelar, prazoLabel } from '../services/cancelamento';
import { ApiError } from '../services/http';
import { endOfIsoWeekFormatted, formatDate } from '../services/date';

export default function Dashboard() {
  const nome = useAuthStore((s) => s.nome);
  const saldo = useSaldo();
  const meus = useMeusAgendamentos();
  const historico = useHistorico();
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

  const onRefresh = useCallback(() => {
    saldo.refetch();
    meus.refetch();
    historico.refetch();
  }, [saldo, meus, historico]);

  if (saldo.isLoading || meus.isLoading) {
    return (
      <View style={s.root}>
        <Loading />
        <TabBar />
      </View>
    );
  }

  const primeiroNome = nome?.split(' ')[0] || 'Aluno';
  const proxima = meus.data?.[0];
  const hist = historico.data ?? [];
  const aulasFeitas = hist.filter((a) => a.status === 'REALIZADO' || a.presenca?.compareceu).length;
  const avaliadas = hist.filter((a) => a.status === 'REALIZADO' || a.status === 'FALTOU' || a.presenca).length;
  const presencaPct = avaliadas > 0 ? Math.round((aulasFeitas / avaliadas) * 100) : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[LC.primary]} tintColor={LC.primary} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Olá, {primeiroNome}!</Text>
            <Text style={s.greetingSub}>Bem-vindo(a) ao seu espaço.</Text>
          </View>
          <Pressable style={s.bell} onPress={() => router.push('/notificacoes')} hitSlop={8}>
            <Icon name="notifications-outline" size={22} color={LC.textPrimary} />
            <View style={s.bellDot} />
          </Pressable>
        </View>

        {/* Plano + saldo */}
        {saldo.data ? (
          <Card style={s.block} padding={18}>
            <View style={s.planRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.metaLabel}>Plano atual</Text>
                <Text style={s.planNome}>{saldo.data.plano}</Text>
                <Text style={s.planSub}>{saldo.data.total} aulas por semana</Text>
              </View>
              <Pressable style={s.linkRow} onPress={() => router.push('/meu-plano')} hitSlop={6}>
                <Text style={s.linkText}>Ver detalhes</Text>
                <Icon name="chevron-forward" size={16} color={LC.primary} />
              </Pressable>
            </View>

            <View style={s.divider} />

            <View style={s.saldoHead}>
              <Text style={s.saldoLabel}>Saldo da semana</Text>
              <Text style={s.saldoRenova}>Renova em {endOfIsoWeekFormatted()}</Text>
            </View>
            <Text style={s.saldoCount}>
              {saldo.data.usadas} de {saldo.data.total} aulas utilizadas
            </Text>
            <SaldoDots usadas={saldo.data.usadas} total={saldo.data.total} />
          </Card>
        ) : null}

        {/* Próxima aula */}
        {proxima ? (
          <LinearGradient colors={LC.gradientCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.block, s.nextCard]}>
            <View style={s.nextHead}>
              <Text style={s.nextLabel}>Próxima aula</Text>
              <View style={s.nextIcon}>
                <Icon name={iconePorModalidade(proxima.horario.modalidade.nome)} size={20} color="#fff" />
              </View>
            </View>
            <Text style={s.nextModalidade}>{nomeModalidade(proxima.horario.modalidade.nome)}</Text>
            <View style={s.nextInfoRow}>
              <Icon name="time-outline" size={15} color="rgba(255,255,255,0.85)" />
              <Text style={s.nextInfo}>
                {DIAS_PT[proxima.horario.diaSemana]} • {proxima.horario.horaInicio} - {proxima.horario.horaFim}
              </Text>
            </View>
            <View style={s.nextInfoRow}>
              <Icon name="location-outline" size={15} color="rgba(255,255,255,0.85)" />
              <Text style={s.nextInfo}>{STUDIO_NOME}</Text>
            </View>
            <Button title="Ver agenda" variant="light" size="sm" fullWidth={false} onPress={() => router.push('/agendamento')} style={s.nextBtn} />
          </LinearGradient>
        ) : (
          <Card style={s.block} padding={20}>
            <Text style={s.noNextTitle}>Nenhuma aula agendada</Text>
            <Text style={s.noNextSub}>Reserve seu próximo treino na agenda.</Text>
            <Button title="Ver agenda" variant="outline" fullWidth={false} onPress={() => router.push('/agendamento')} style={{ marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 20 }} />
          </Card>
        )}

        {/* Resumo */}
        <View style={s.sectionTitleRow}>
          <Text style={s.sectionTitle}>Resumo do mês</Text>
        </View>
        <Card style={s.block} padding={4}>
          <View style={s.statsRow}>
            <Stat value={String(aulasFeitas)} label="Aulas feitas" />
            <View style={s.statDivider} />
            <Stat value={presencaPct != null ? `${presencaPct}%` : '—'} label="Presença" />
            <View style={s.statDivider} />
            <Stat value={String(meus.data?.length ?? 0)} label="Próximas" />
          </View>
        </Card>

        {/* Aulas agendadas */}
        {meus.data && meus.data.length > 0 ? (
          <View style={s.listSection}>
            <View style={s.sectionTitleRow}>
              <Text style={s.sectionTitle}>Minhas aulas agendadas</Text>
            </View>
            {meus.data.slice(0, 4).map((ag) => {
              // Reposição não se cancela (Termo de Normas, seção 3) — mostrar
              // o botão só levaria o aluno a um erro vindo da API.
              const liberado = !ag.reposicao && podeCancelar(ag.dataAula, ag.horario.horaInicio);
              return (
                <Card key={ag.id} style={s.aulaCard} padding={14}>
                  <View style={s.aulaIcon}>
                    <Icon name={iconePorModalidade(ag.horario.modalidade.nome)} size={20} color={LC.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.aulaModalidade}>{nomeModalidade(ag.horario.modalidade.nome)}</Text>
                    <Text style={s.aulaInfo}>
                      {formatDate(ag.dataAula, 'ddd, DD/MM')} • {ag.horario.horaInicio} - {ag.horario.horaFim}
                    </Text>
                    <Text style={s.aulaStudio}>{STUDIO_NOME}</Text>
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
                      <Text style={s.prazoText}>{ag.reposicao ? 'Reposição' : 'Prazo encerrado'}</Text>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        ) : null}

        <View style={{ height: 16 }} />
      </ScrollView>
      <TabBar />

      <ConfirmModal
        visible={!!alvo}
        title="Cancelar aula"
        message={
          alvo
            ? `${nomeModalidade(alvo.horario.modalidade.nome)} • ${formatDate(alvo.dataAula, 'DD/MM')} às ${alvo.horario.horaInicio}.\n${prazoLabel(alvo.dataAula, alvo.horario.horaInicio)}.`
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { ...LC.coluna, paddingBottom: 16 },
  header: { ...LC.coluna, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  greeting: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  greetingSub: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  bell: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  bellDot: { position: 'absolute', top: 11, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: LC.danger, borderWidth: 1.5, borderColor: LC.bgCard },
  block: { marginHorizontal: 16, marginBottom: 12 },
  metaLabel: { fontSize: 12, color: LC.textMuted, marginBottom: 3 },
  planRow: { flexDirection: 'row', alignItems: 'flex-start' },
  planNome: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  planSub: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { color: LC.primary, fontSize: 13, fontWeight: '700' },
  divider: { height: 1, backgroundColor: LC.border, marginVertical: 14 },
  saldoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  saldoLabel: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  saldoRenova: { fontSize: 12, color: LC.textMuted },
  saldoCount: { fontSize: 13, color: LC.textSecondary, marginBottom: 12 },
  nextCard: { borderRadius: LC.radius.lg, padding: 18 },
  nextHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  nextIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  nextModalidade: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 6, marginBottom: 10 },
  nextInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  nextInfo: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  nextBtn: { marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 18 },
  noNextTitle: { fontSize: 16, fontWeight: '700', color: LC.textPrimary },
  noNextSub: { fontSize: 13, color: LC.textSecondary, marginTop: 4 },
  sectionTitleRow: { paddingHorizontal: 20, marginTop: 4, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  statLabel: { fontSize: 11, color: LC.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 34, backgroundColor: LC.border },
  listSection: { marginTop: 4 },
  aulaCard: { marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aulaIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  aulaModalidade: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  aulaInfo: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  aulaStudio: { fontSize: 11, color: LC.textMuted, marginTop: 1 },
  cancelBtn: { paddingHorizontal: 14 },
  prazoTag: { backgroundColor: LC.bg, borderRadius: LC.radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  prazoText: { fontSize: 11, fontWeight: '600', color: LC.textMuted },
});
