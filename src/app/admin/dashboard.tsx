import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { api, ApiError } from '../../services/api';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';

export default function AdminDashboard() {
  const { accessToken, nome, logout } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try { const data = await api.get('/relatorios/dashboard', accessToken!); setStats(data); }
    catch (e) { if (e instanceof ApiError && e.status === 401) logout(); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { carregar(); }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={LC.primary} /></View>;

  const STATS = [
    { label: 'Total de alunos',  value: stats?.totalAlunos,  color: '#6366F1', bg: '#EEF2FF', icon: '👥' },
    { label: 'Alunos ativos',    value: stats?.alunosAtivos,  color: LC.success, bg: LC.successBg, icon: '✅' },
    { label: 'Aulas na semana',  value: stats?.aulasSemana,   color: '#F59E0B', bg: '#FEF3C7', icon: '📅' },
    { label: 'Taxa de ocupação', value: `${stats?.ocupacao}%`, color: LC.primary, bg: LC.primaryLight, icon: '📊' },
    { label: 'Presenças',        value: stats?.presencas,     color: LC.info, bg: LC.infoBg, icon: '🙋' },
    { label: 'Faltas',           value: stats?.faltas,        color: LC.danger, bg: LC.dangerBg, icon: '❌' },
  ];

  const ACOES = [
    { label: '👥\nAlunos',      route: '/admin/alunos' },
    { label: '🗓️\nHorários',    route: '/admin/horarios' },
    { label: '📈\nFrequência',   route: '/admin/frequencia' },
    { label: '➕\nNovo aluno',   route: '/admin/novo-aluno' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={[LC.primary]} />} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Painel Admin 👋</Text>
            <Text style={s.sub}>Olá, {nome?.split(' ')[0]}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={s.logoutBtn}>
            <Text style={s.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Grid de stats */}
        <View style={s.grid}>
          {STATS.map(stat => (
            <View key={stat.label} style={[s.statCard, { backgroundColor: stat.bg }]}>
              <Text style={s.statIcon}>{stat.icon}</Text>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value ?? '—'}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Ações rápidas */}
        <Text style={s.sectionTit}>Gestão rápida</Text>
        <View style={s.acoes}>
          {ACOES.map(a => (
            <TouchableOpacity key={a.label} style={s.acaoCard} onPress={() => router.push(a.route as any)} activeOpacity={0.8}>
              <Text style={s.acaoText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
      <TabBar isAdmin />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: LC.bg },
  greeting: { fontSize: 20, fontWeight: '700', color: LC.textPrimary },
  sub: { fontSize: 13, color: LC.textSecondary },
  logoutBtn: { backgroundColor: LC.dangerBg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: LC.radius.full },
  logoutText: { color: LC.danger, fontWeight: '700', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginBottom: 4 },
  statCard: { width: '47%', borderRadius: LC.radius.lg, padding: 16, marginLeft: 4 },
  statIcon: { fontSize: 22, marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: '700' },
  statLabel: { fontSize: 12, color: LC.textSecondary, marginTop: 3 },
  sectionTit: { fontSize: 16, fontWeight: '700', color: LC.textPrimary, paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  acaoCard: { width: '47%', backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 20, alignItems: 'center', marginLeft: 4, ...LC.shadow },
  acaoText: { fontSize: 14, fontWeight: '600', color: LC.textPrimary, textAlign: 'center', lineHeight: 22 },
});
