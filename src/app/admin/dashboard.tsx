import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/auth';
import { LC, alternarTema, temaAtual } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Icon, type IconName } from '../../components/ui/icon';
import { Loading, ErrorState } from '../../components/ui/states';
import { useRelatorioDashboard } from '../../services/relatorios/relatorios.queries';
import { useResumoFinanceiro } from '../../services/financeiro/financeiro.queries';
import { useLogout } from '../../services/auth/auth.mutations';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { formatDate, getDiaSemanaKey } from '../../services/date';
import { nomeModalidade } from '../../constants/assets';
import type { RelatorioDashboard } from '../../services/relatorios/relatorios.types';

type StatDef = { label: string; value: number | string; icon: IconName; color: string; bg: string };
type AcaoDef = { label: string; desc: string; icon: IconName; route: string; color: string; bg: string };

const ACOES: AcaoDef[] = [
  { label: 'Alunos', desc: 'Gerenciar cadastros', icon: 'people-outline', route: '/admin/alunos', color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Horários', desc: 'Grade de aulas', icon: 'calendar-outline', route: '/admin/horarios', color: LC.primary, bg: LC.primaryLight },
  { label: 'Financeiro', desc: 'Mensalidades e recebimentos', icon: 'wallet-outline', route: '/admin/financeiro', color: '#15803D', bg: LC.successBg },
  { label: 'Frequência', desc: 'Presenças e faltas', icon: 'stats-chart-outline', route: '/admin/frequencia', color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Novo aluno', desc: 'Cadastrar e gerar link', icon: 'person-add-outline', route: '/admin/novo-aluno', color: LC.info, bg: LC.infoBg },
];

// ── Blocos reutilizados nos dois layouts ─────────────────────────────

function AulasPorDiaChart({ d }: { d?: RelatorioDashboard }) {
  const dados = d?.aulasPorDia ?? [];
  const max = Math.max(1, ...dados.map((x) => x.total));
  const diaAtual = getDiaSemanaKey(new Date());

  return (
    <Card style={s.chartCard} padding={18}>
      <Text style={s.blockTitle}>Agendamentos por dia</Text>
      <Text style={s.blockSub}>Esta semana</Text>
      {dados.length === 0 ? (
        <Text style={s.blockEmpty}>Sem dados ainda.</Text>
      ) : (
        <View style={s.chartArea}>
          {dados.map((item) => {
            const hoje = item.dia === diaAtual;
            return (
              <View key={item.dia} style={s.chartCol}>
                <Text style={[s.chartValue, hoje && s.chartValueHoje]}>{item.total}</Text>
                <View style={s.chartBarTrack}>
                  <View
                    style={[
                      s.chartBar,
                      { height: `${Math.max((item.total / max) * 100, item.total > 0 ? 8 : 3)}%` },
                      hoje ? s.chartBarHoje : null,
                    ]}
                  />
                </View>
                <Text style={[s.chartDia, hoje && s.chartDiaHoje]}>{DIAS_PT[item.dia]?.slice(0, 3)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function AulasHojeCard({ d }: { d?: RelatorioDashboard }) {
  const aulas = d?.aulasHoje ?? [];
  return (
    <Card style={s.hojeCard} padding={18}>
      <Text style={s.blockTitle}>Aulas de hoje</Text>
      <Text style={s.blockSub}>{aulas.length > 0 ? `${aulas.length} horários na grade` : ' '}</Text>
      {aulas.length === 0 ? (
        <View style={s.hojeEmpty}>
          <Icon name="cafe-outline" size={26} color={LC.textMuted} />
          <Text style={s.blockEmpty}>Sem aulas hoje.</Text>
        </View>
      ) : (
        aulas.map((a) => {
          const lotado = a.agendados >= a.capacidade;
          const pct = a.capacidade > 0 ? (a.agendados / a.capacidade) * 100 : 0;
          return (
            <View key={a.horarioId} style={s.hojeRow}>
              <Text style={s.hojeHora}>{a.horaInicio}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.hojeModalidade}>{a.modalidade}</Text>
                <View style={s.hojeTrack}>
                  <View style={[s.hojeFill, { width: `${pct}%` }, lotado && { backgroundColor: LC.danger }]} />
                </View>
              </View>
              <Text style={s.hojeVagas}>{a.agendados}/{a.capacidade}</Text>
              <Badge label={lotado ? 'Lotado' : 'Disponível'} variant={lotado ? 'danger' : 'success'} />
            </View>
          );
        })
      )}
    </Card>
  );
}

/** Hero mobile: o que vai acontecer nas próximas horas (substitui a taxa de ocupação). */
function ProximasAulasHero({ d }: { d?: RelatorioDashboard }) {
  const agora = formatDate(new Date(), 'HH:mm');
  const proximas = (d?.aulasHoje ?? []).filter((a) => a.horaFim > agora).slice(0, 3);

  return (
    <View style={s.ocupacaoCard}>
      <View style={s.ocupacaoHead}>
        <Text style={s.ocupacaoLabel}>Próximas aulas</Text>
        <Text style={s.ocupacaoWeek}>Hoje</Text>
      </View>

      {proximas.length === 0 ? (
        <Text style={s.heroVazio}>Sem mais aulas hoje. Bom descanso! 🌙</Text>
      ) : (
        proximas.map((a) => (
          <View key={a.horarioId} style={s.heroAulaRow}>
            <Text style={s.heroAulaHora}>{a.horaInicio}</Text>
            <Text style={s.heroAulaModalidade} numberOfLines={1}>{nomeModalidade(a.modalidade)}</Text>
            <View style={s.heroAulaVagas}>
              <Icon name="people" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={s.heroAulaVagasText}>{a.agendados}/{a.capacidade}</Text>
            </View>
          </View>
        ))
      )}

      <Pressable style={s.heroAgendaBtn} onPress={() => router.push('/admin/horarios' as any)}>
        <Text style={s.heroAgendaBtnText}>Ver agenda</Text>
        <Icon name="arrow-forward" size={15} color={LC.primaryDark} />
      </Pressable>
    </View>
  );
}

/** Pendências acionáveis: reposições, primeiro acesso e cancelamentos de ontem. */
function AtencaoSection({ d }: { d?: RelatorioDashboard }) {
  const reposicoes = d?.reposicoesPendentes;
  const acesso = d?.aguardandoAcesso;
  const cancelados = d?.canceladosOntem ?? [];

  const temAlgo = (reposicoes?.total ?? 0) > 0 || (acesso?.total ?? 0) > 0 || cancelados.length > 0;
  if (!temAlgo) return null;

  return (
    <>
      <Text style={s.sectionTitle}>Precisa de atenção</Text>

      {reposicoes && reposicoes.total > 0 ? (
        <Pressable onPress={() => router.push('/admin/alunos' as any)} style={({ pressed }) => [pressed && s.pressed]}>
          <Card style={s.atCard} padding={14}>
            <View style={[s.atIcon, { backgroundColor: LC.warningBg }]}>
              <Icon name="ticket-outline" size={18} color={LC.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.atTitulo}>
                {reposicoes.total} {reposicoes.total === 1 ? 'reposição para agendar' : 'reposições para agendar'}
              </Text>
              <Text style={s.atSub} numberOfLines={1}>
                {reposicoes.alunos.map((a) => (a.creditos > 1 ? `${a.nome} (${a.creditos})` : a.nome)).join(', ')}
              </Text>
            </View>
            <Icon name="chevron-forward" size={16} color={LC.textMuted} />
          </Card>
        </Pressable>
      ) : null}

      {acesso && acesso.total > 0 ? (
        <Pressable onPress={() => router.push('/admin/alunos' as any)} style={({ pressed }) => [pressed && s.pressed]}>
          <Card style={s.atCard} padding={14}>
            <View style={[s.atIcon, { backgroundColor: LC.infoBg }]}>
              <Icon name="key-outline" size={18} color={LC.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.atTitulo}>
                {acesso.total} {acesso.total === 1 ? 'aluno aguardando primeiro acesso' : 'alunos aguardando primeiro acesso'}
              </Text>
              <Text style={s.atSub} numberOfLines={1}>{acesso.nomes.join(', ')}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={LC.textMuted} />
          </Card>
        </Pressable>
      ) : null}

      {cancelados.length > 0 ? (
        <Card style={s.atCard} padding={14}>
          <View style={[s.atIcon, { backgroundColor: LC.dangerBg }]}>
            <Icon name="close-circle-outline" size={18} color={LC.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.atTitulo}>
              Ontem: {cancelados.length} {cancelados.length === 1 ? 'aula cancelada' : 'aulas canceladas'}
            </Text>
            <Text style={s.atSub} numberOfLines={2}>
              {cancelados.map((c) => `${c.nome} (${c.horaInicio} ${nomeModalidade(c.modalidade)})`).join(', ')}
            </Text>
          </View>
        </Card>
      ) : null}
    </>
  );
}

function FinanceiroCard() {
  const resumo = useResumoFinanceiro();
  const d = resumo.data;
  return (
    <Pressable onPress={() => router.push('/admin/financeiro' as any)} style={({ pressed }) => [pressed && s.pressed]}>
      <Card style={s.finCard} padding={18}>
        <View style={s.finHead}>
          <Text style={s.blockTitle}>Financeiro do mês</Text>
          <Icon name="chevron-forward" size={16} color={LC.textMuted} />
        </View>
        {resumo.isLoading ? (
          <Text style={s.blockEmpty}>Carregando…</Text>
        ) : !d ? (
          <View style={s.finAlerta}>
            <Icon name="cloud-offline-outline" size={14} color={LC.textMuted} />
            <Text style={[s.finAlertaText, { color: LC.textSecondary }]}>Sem conexão — toque para abrir</Text>
          </View>
        ) : (
          <>
            <View style={s.finRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.finValor, { color: LC.success }]}>{d.pagos}</Text>
                <Text style={s.finLabel}>{d.pagos === 1 ? 'Pagou' : 'Pagaram'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.finValor}>{d.aVencer}</Text>
                <Text style={s.finLabel}>A vencer</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.finValor, d.atrasados > 0 && { color: LC.danger }]}>{d.atrasados}</Text>
                <Text style={s.finLabel}>{d.atrasados === 1 ? 'Atrasado' : 'Atrasados'}</Text>
              </View>
            </View>
            {d.atrasados > 0 ? (
              <View style={s.finAlerta}>
                <Icon name="alert-circle" size={14} color={LC.danger} />
                <Text style={s.finAlertaText}>
                  {d.atrasados} {d.atrasados === 1 ? 'aluno precisa' : 'alunos precisam'} de atenção
                </Text>
              </View>
            ) : (
              <View style={s.finAlerta}>
                <Icon name="checkmark-circle" size={14} color={LC.success} />
                <Text style={[s.finAlertaText, { color: LC.success }]}>Nenhum atraso</Text>
              </View>
            )}
          </>
        )}
      </Card>
    </Pressable>
  );
}

// ── Tela ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const nome = useAuthStore((s) => s.nome);
  const relatorio = useRelatorioDashboard();
  const logout = useLogout();
  const isDesktop = useIsDesktop();

  const onRefresh = useCallback(() => relatorio.refetch(), [relatorio]);

  if (relatorio.isLoading) {
    return (
      <View style={s.root}>
        <Loading />
        <TabBar isAdmin />
      </View>
    );
  }

  const d = relatorio.data;

  const statsMobile: StatDef[] = [
    { label: 'Total de alunos', value: d?.totalAlunos ?? 0, icon: 'people', color: '#4F46E5', bg: '#EEF2FF' },
    { label: 'Alunos ativos', value: d?.alunosAtivos ?? 0, icon: 'checkmark-circle', color: '#15803D', bg: LC.successBg },
    { label: 'Aulas na semana', value: d?.aulasSemana ?? 0, icon: 'calendar', color: '#B45309', bg: '#FEF3C7' },
    { label: 'Presenças', value: d?.presencas ?? 0, icon: 'hand-left', color: '#1D4ED8', bg: LC.infoBg },
    { label: 'Faltas', value: d?.faltas ?? 0, icon: 'close-circle', color: '#B91C1C', bg: LC.dangerBg },
  ];

  const statsDesktop: StatDef[] = [
    { label: 'Alunos ativos', value: d?.alunosAtivos ?? 0, icon: 'people', color: '#4F46E5', bg: '#EEF2FF' },
    { label: 'Aulas na semana', value: d?.aulasSemana ?? 0, icon: 'calendar', color: '#B45309', bg: '#FEF3C7' },
    { label: 'Presenças', value: d?.presencas ?? 0, icon: 'checkmark-circle', color: '#15803D', bg: LC.successBg },
    { label: 'Faltas', value: d?.faltas ?? 0, icon: 'close-circle', color: '#B91C1C', bg: LC.dangerBg },
    { label: 'Ocupação', value: `${d?.ocupacao ?? 0}%`, icon: 'trending-up', color: LC.primary, bg: LC.primaryLight },
  ];

  // ── Desktop: painel ────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.deskScroll} showsVerticalScrollIndicator={false}>
          <View style={s.deskHeader}>
            <View>
              <Text style={s.deskTitle}>Dashboard</Text>
              <Text style={s.deskSub}>Olá, {nome?.split(' ')[0] || 'Admin'} — visão geral do estúdio</Text>
            </View>
          </View>

          {relatorio.isError ? (
            <ErrorState message="Não foi possível carregar o painel." onRetry={() => relatorio.refetch()} />
          ) : (
            <>
              <View style={s.deskStatsRow}>
                {statsDesktop.map((stat) => (
                  <Card key={stat.label} style={s.deskStatCard} padding={16}>
                    <View style={[s.statIcon, { backgroundColor: stat.bg }]}>
                      <Icon name={stat.icon} size={20} color={stat.color} />
                    </View>
                    <Text style={s.statValue}>{stat.value}</Text>
                    <Text style={s.statLabel}>{stat.label}</Text>
                  </Card>
                ))}
              </View>

              <View style={s.deskRow}>
                <View style={{ flex: 3 }}>
                  <AulasPorDiaChart d={d} />
                </View>
                <View style={{ flex: 2, gap: GAP }}>
                  <FinanceiroCard />
                  <AulasHojeCard d={d} />
                </View>
              </View>
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Mobile: layout atual + blocos novos ────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[LC.primary]} tintColor={LC.primary} />}
      >
        {/* Hero */}
        <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroTitle}>Painel Admin</Text>
              <Text style={s.heroSub}>Olá, {nome?.split(' ')[0] || 'Admin'}</Text>
            </View>
            <View style={s.heroBtns}>
              <Pressable style={s.logoutBtn} onPress={alternarTema} hitSlop={8}>
                <Icon name={temaAtual === 'escuro' ? 'sunny-outline' : 'moon-outline'} size={20} color="#fff" />
              </Pressable>
              <Pressable style={s.logoutBtn} onPress={() => logout.mutate()} hitSlop={8}>
                <Icon name="log-out-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          {relatorio.isError ? null : <ProximasAulasHero d={d} />}
        </LinearGradient>

        {/* Conteúdo */}
        <View style={s.body}>
          {relatorio.isError ? (
            <ErrorState message="Não foi possível carregar o painel." onRetry={() => relatorio.refetch()} />
          ) : (
            <>
              <AtencaoSection d={d} />

              <Text style={s.sectionTitle}>Visão geral</Text>
              <View style={s.grid}>
                {statsMobile.map((stat) => (
                  <Card key={stat.label} style={s.statCard} padding={16}>
                    <View style={[s.statIcon, { backgroundColor: stat.bg }]}>
                      <Icon name={stat.icon} size={20} color={stat.color} />
                    </View>
                    <Text style={s.statValue}>{stat.value}</Text>
                    <Text style={s.statLabel}>{stat.label}</Text>
                  </Card>
                ))}
              </View>

              <Text style={s.sectionTitle}>Movimento da semana</Text>
              <AulasPorDiaChart d={d} />
              <View style={{ height: GAP }} />
              <AulasHojeCard d={d} />
              <View style={{ height: GAP }} />
              <FinanceiroCard />

              <Text style={s.sectionTitle}>Gestão rápida</Text>
              <View style={s.acoes}>
                {ACOES.map((a) => (
                  <Pressable
                    key={a.label}
                    onPress={() => router.push(a.route as any)}
                    style={({ pressed }) => [s.acaoPressable, pressed && s.pressed]}
                  >
                    <Card style={s.acaoCard} padding={16}>
                      <View style={[s.acaoIcon, { backgroundColor: a.bg }]}>
                        <Icon name={a.icon} size={22} color={a.color} />
                      </View>
                      <Text style={s.acaoLabel}>{a.label}</Text>
                      <Text style={s.acaoDesc}>{a.desc}</Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
      <TabBar isAdmin />
    </View>
  );
}

const GAP = 12;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { paddingBottom: 16 },

  // ── Desktop ─────────────────────────────────────────────────────
  deskScroll: { paddingTop: 24, paddingBottom: 16 },
  deskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  deskTitle: { fontSize: 24, fontWeight: '800', color: LC.textPrimary },
  deskSub: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  deskStatsRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  deskStatCard: { flex: 1 },
  deskRow: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start' },

  // Blocos (chart + aulas hoje)
  chartCard: { width: '100%' },
  hojeCard: { width: '100%' },
  blockTitle: { fontSize: 15, fontWeight: '800', color: LC.textPrimary },
  blockSub: { fontSize: 12, color: LC.textMuted, marginTop: 2, marginBottom: 12 },
  blockEmpty: { fontSize: 13, color: LC.textSecondary, paddingVertical: 8 },
  chartArea: { height: 180, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  chartCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  chartValue: { fontSize: 12, fontWeight: '700', color: LC.textSecondary, marginBottom: 4 },
  chartValueHoje: { color: LC.primary },
  chartBarTrack: { flex: 1, width: '100%', maxWidth: 44, justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 8, backgroundColor: LC.primarySoft },
  chartBarHoje: { backgroundColor: LC.primary },
  chartDia: { fontSize: 11, fontWeight: '600', color: LC.textMuted, marginTop: 6 },
  chartDiaHoje: { color: LC.primary, fontWeight: '800' },

  // Financeiro
  finCard: { width: '100%' },
  finHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  finRow: { flexDirection: 'row', gap: 12 },
  finValor: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  finLabel: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  finAlerta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: LC.border },
  finAlertaText: { fontSize: 12, fontWeight: '700', color: LC.danger },

  hojeEmpty: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  hojeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: LC.border },
  hojeHora: { width: 44, fontSize: 13, fontWeight: '800', color: LC.textPrimary },
  hojeModalidade: { fontSize: 13, fontWeight: '600', color: LC.textPrimary, marginBottom: 4 },
  hojeTrack: { height: 5, borderRadius: 3, backgroundColor: LC.border, overflow: 'hidden' },
  hojeFill: { height: '100%', borderRadius: 3, backgroundColor: LC.primary },
  hojeVagas: { fontSize: 12, fontWeight: '700', color: LC.textSecondary, width: 30, textAlign: 'right' },

  // ── Mobile (layout original) ────────────────────────────────────
  hero: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 44, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  heroBtns: { flexDirection: 'row', gap: 8 },
  logoutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  ocupacaoCard: { marginTop: 22, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: LC.radius.lg, padding: 18 },
  ocupacaoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ocupacaoLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  ocupacaoWeek: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  ocupacaoValue: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#fff' },
  ocupacaoMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 10 },

  // Hero: próximas aulas
  heroVazio: { color: 'rgba(255,255,255,0.85)', fontSize: 14, paddingVertical: 10 },
  heroAulaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.14)' },
  heroAulaHora: { color: '#fff', fontSize: 15, fontWeight: '800', width: 52 },
  heroAulaModalidade: { flex: 1, color: 'rgba(255,255,255,0.95)', fontSize: 14, fontWeight: '600' },
  heroAulaVagas: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroAulaVagasText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  heroAgendaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: LC.radius.md, paddingVertical: 11, marginTop: 14,
  },
  heroAgendaBtnText: { color: LC.primaryDark, fontSize: 14, fontWeight: '800' },

  // Precisa de atenção
  atCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  atIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  atTitulo: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  atSub: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  body: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: LC.textPrimary, marginBottom: 12, marginTop: 8, paddingHorizontal: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  statCard: { width: `${(100 - 4) / 2}%`, flexGrow: 1, minWidth: 150 },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: '800', color: LC.textPrimary },
  statLabel: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  acaoPressable: { width: `${(100 - 4) / 2}%`, flexGrow: 1, minWidth: 150 },
  acaoCard: { width: '100%', height: '100%' },
  acaoIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  acaoLabel: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  acaoDesc: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
