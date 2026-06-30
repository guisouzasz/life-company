import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/auth';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon, type IconName } from '../../components/ui/icon';
import { Loading, ErrorState } from '../../components/ui/states';
import { useRelatorioDashboard } from '../../services/relatorios/relatorios.queries';
import { useLogout } from '../../services/auth/auth.mutations';

type StatDef = { label: string; value: number | string; icon: IconName; color: string; bg: string };
type AcaoDef = { label: string; desc: string; icon: IconName; route: string; color: string; bg: string };

const ACOES: AcaoDef[] = [
  { label: 'Alunos', desc: 'Gerenciar cadastros', icon: 'people-outline', route: '/admin/alunos', color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Horários', desc: 'Grade de aulas', icon: 'calendar-outline', route: '/admin/horarios', color: LC.primary, bg: LC.primaryLight },
  { label: 'Frequência', desc: 'Presenças e faltas', icon: 'stats-chart-outline', route: '/admin/frequencia', color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Novo aluno', desc: 'Cadastrar e gerar link', icon: 'person-add-outline', route: '/admin/novo-aluno', color: LC.info, bg: LC.infoBg },
];

export default function AdminDashboard() {
  const nome = useAuthStore((s) => s.nome);
  const relatorio = useRelatorioDashboard();
  const logout = useLogout();

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

  const stats: StatDef[] = [
    { label: 'Total de alunos', value: d?.totalAlunos ?? 0, icon: 'people', color: '#4F46E5', bg: '#EEF2FF' },
    { label: 'Alunos ativos', value: d?.alunosAtivos ?? 0, icon: 'checkmark-circle', color: '#15803D', bg: LC.successBg },
    { label: 'Aulas na semana', value: d?.aulasSemana ?? 0, icon: 'calendar', color: '#B45309', bg: '#FEF3C7' },
    { label: 'Presenças', value: d?.presencas ?? 0, icon: 'hand-left', color: '#1D4ED8', bg: LC.infoBg },
    { label: 'Faltas', value: d?.faltas ?? 0, icon: 'close-circle', color: '#B91C1C', bg: LC.dangerBg },
  ];

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
            <Pressable style={s.logoutBtn} onPress={() => logout.mutate()} hitSlop={8}>
              <Icon name="log-out-outline" size={20} color="#fff" />
            </Pressable>
          </View>

          {relatorio.isError ? null : (
            <View style={s.ocupacaoCard}>
              <View style={s.ocupacaoHead}>
                <Text style={s.ocupacaoLabel}>Taxa de ocupação</Text>
                <Text style={s.ocupacaoWeek}>Esta semana</Text>
              </View>
              <Text style={s.ocupacaoValue}>{d?.ocupacao ?? 0}%</Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.min(d?.ocupacao ?? 0, 100)}%` }]} />
              </View>
              <Text style={s.ocupacaoMeta}>
                {d?.presencas ?? 0} presenças em {d?.aulasSemana ?? 0} aulas confirmadas
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Conteúdo */}
        <View style={s.body}>
          {relatorio.isError ? (
            <ErrorState message="Não foi possível carregar o painel." onRetry={() => relatorio.refetch()} />
          ) : (
            <>
              <Text style={s.sectionTitle}>Visão geral</Text>
              <View style={s.grid}>
                {stats.map((stat) => (
                  <Card key={stat.label} style={s.statCard} padding={16}>
                    <View style={[s.statIcon, { backgroundColor: stat.bg }]}>
                      <Icon name={stat.icon} size={20} color={stat.color} />
                    </View>
                    <Text style={s.statValue}>{stat.value}</Text>
                    <Text style={s.statLabel}>{stat.label}</Text>
                  </Card>
                ))}
              </View>

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
  hero: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 44, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  logoutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  ocupacaoCard: { marginTop: 22, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: LC.radius.lg, padding: 18 },
  ocupacaoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ocupacaoLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  ocupacaoWeek: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  ocupacaoValue: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#fff' },
  ocupacaoMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 10 },
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
