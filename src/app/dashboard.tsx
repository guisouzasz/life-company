import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AnelProgresso } from '../components/ui/anel-progresso';
import { Toque, EntraSubindo } from '../components/ui/motion';
import { primeiroNome as soPrimeiroNome } from '../services/nome';
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

  // O cadastro é todo em caixa alta; "Olá, MARINA!" grita com a aluna.
  const primeiroNome = nome ? soPrimeiroNome(nome) : 'Aluno';
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
        {/*
          Saudação e saldo da semana num bloco escuro só.
          Eram duas coisas separadas — um título preto no branco e, abaixo, um
          card com o plano. Juntando, a primeira dobra da tela responde de uma
          vez as duas perguntas de quem abre o app: "quantas aulas ainda tenho
          esta semana" e "qual é a próxima". O anel mostra o saldo antes de a
          pessoa ler o número.
        */}
        <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>{STUDIO_NOME}</Text>
              <Text style={s.greeting}>Olá, {primeiroNome}!</Text>
            </View>
            <Toque escala={0.9} style={s.bell} onPress={() => router.push('/notificacoes')} hitSlop={8}>
              <Icon name="notifications-outline" size={21} color="#fff" />
              <View style={s.bellDot} />
            </Toque>
          </View>

          {saldo.data ? (
            <View style={s.saldoBloco}>
              <AnelProgresso
                fracao={saldo.data.total > 0 ? saldo.data.usadas / saldo.data.total : 0}
                tamanho={92}
                espessura={8}
                cor={LC.primaryMid}
                trilho="rgba(255,255,255,0.18)"
                corDoFuro="#08494D"
              >
                <Text style={s.anelNum}>{saldo.data.total - saldo.data.usadas}</Text>
                <Text style={s.anelLabel}>restam</Text>
              </AnelProgresso>

              <View style={{ flex: 1 }}>
                <Text style={s.saldoLabel}>Saldo da semana</Text>
                <Text style={s.saldoCount}>
                  {saldo.data.usadas} de {saldo.data.total} aulas usadas
                </Text>
                <Text style={s.saldoRenova}>Renova em {endOfIsoWeekFormatted()}</Text>
                <Toque escala={0.94} style={s.linkRow} onPress={() => router.push('/meu-plano')} hitSlop={6}>
                  <Text style={s.linkText}>{saldo.data.plano}</Text>
                  <Icon name="chevron-forward" size={15} color="#fff" />
                </Toque>
              </View>
            </View>
          ) : null}
        </LinearGradient>

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
  // ── Bloco escuro do topo ──────────────────────────────────────────
  hero: { paddingBottom: 26, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, marginBottom: 18 },
  header: { ...LC.coluna, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 58, paddingBottom: 20 },
  kicker: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6,
  },
  greeting: { fontSize: 27, fontWeight: '800', color: '#fff', letterSpacing: -0.7 },
  bell: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  bellDot: { position: 'absolute', top: 11, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FBBF24', borderWidth: 1.5, borderColor: '#0B5F63' },

  saldoBloco: {
    ...LC.coluna, flexDirection: 'row', alignItems: 'center', gap: 20,
    paddingHorizontal: 22,
  },
  /** O número grande dentro do anel: quantas aulas ainda cabem na semana. */
  anelNum: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  anelLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)', marginTop: -1,
  },
  saldoLabel: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  saldoCount: { fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 5 },
  saldoRenova: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 12,
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.13)',
    paddingLeft: 12, paddingRight: 8, paddingVertical: 6, borderRadius: LC.radius.full,
  },
  linkText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },

  block: { marginHorizontal: 16, marginBottom: 12 },
  metaLabel: { fontSize: 12, color: LC.textMuted, marginBottom: 3 },
  planRow: { flexDirection: 'row', alignItems: 'flex-start' },
  planNome: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  planSub: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: LC.border, marginVertical: 14 },
  saldoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nextCard: { borderRadius: LC.radius.xl, padding: 20, ...LC.shadowCard },
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
