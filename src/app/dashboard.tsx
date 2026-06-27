import { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useAuthStore } from '../store/auth';
import { api, ApiError } from '../services/api';
import { LC } from '../constants/theme';
import { TabBar } from '../components/tab-bar';
import { formatDate, formatRelative, endOfIsoWeekFormatted } from '../services/date';

const STATUS_COLOR: Record<string, string> = {
  CONFIRMADO: LC.success, CANCELADO: LC.danger, REALIZADO: LC.info, FALTOU: LC.warning,
};
const STATUS_LABEL: Record<string, string> = {
  CONFIRMADO: 'Confirmada', CANCELADO: 'Cancelada', REALIZADO: 'Realizada', FALTOU: 'Faltou',
};
const DIAS_PT: Record<string, string> = {
  SEGUNDA: 'Segunda', TERCA: 'Terça', QUARTA: 'Quarta', QUINTA: 'Quinta', SEXTA: 'Sexta',
};

export default function Dashboard() {
  const { accessToken, nome, logout } = useAuthStore();
  const [saldo, setSaldo] = useState<any>(null);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api.get('/usuarios/me/saldo', accessToken!),
        api.get('/agendamentos/meus', accessToken!),
      ]);
      setSaldo(s); setAgendamentos(a);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout();
    } finally { setLoading(false); setRefreshing(false); }
  }, [accessToken]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleCancelar = (id: string) => {
    Alert.alert('Cancelar aula', 'Deseja cancelar este agendamento?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim, cancelar', style: 'destructive', onPress: async () => {
        try { await api.patch(`/agendamentos/${id}/cancelar`, undefined, accessToken!); carregar(); }
        catch (e) { Alert.alert('Erro', String(e instanceof ApiError ? e.message : e)); }
      }},
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={LC.primary} /></View>;

  const primeiroNome = nome?.split(' ')[0] || 'Aluno';
  const proxima = agendamentos[0];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={[LC.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Olá, {primeiroNome}! 👋</Text>
            <Text style={s.subGreeting}>Bem-vindo(a) ao seu espaço.</Text>
          </View>
          <TouchableOpacity style={s.notifBtn} onPress={() => router.push('/notificacoes')}>
            <Text style={s.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Card plano */}
        {saldo && (
          <View style={s.planCard}>
            <View style={s.planRow}>
              <View>
                <Text style={s.planMeta}>Plano atual</Text>
                <Text style={s.planNome}>{saldo.plano}</Text>
                <Text style={s.planSub}>{saldo.total} aulas por semana</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/meu-plano')}>
                <Text style={s.planLinkText}>Ver detalhes ›</Text>
              </TouchableOpacity>
            </View>
            <View style={s.saldoRow}>
              <Text style={s.saldoLabel}>Saldo da semana</Text>
              <Text style={s.saldoRenova}>Renova em {endOfIsoWeekFormatted()}</Text>
            </View>
            <Text style={s.saldoNum}>{saldo.usadas} de {saldo.total} aulas utilizadas</Text>
            <View style={s.dotsRow}>
              {Array.from({ length: saldo.total }).map((_, i) => (
                <View key={i} style={[s.dot, i < saldo.usadas ? s.dotUsed : s.dotFree]} />
              ))}
            </View>
          </View>
        )}

        {/* Próxima aula destaque */}
        {proxima && (
          <View style={s.nextCard}>
            <Text style={s.nextMeta}>Próxima aula</Text>
            <Text style={s.nextModalidade}>{proxima.horario?.modalidade?.nome}</Text>
            <Text style={s.nextText}>
              🕒 {DIAS_PT[proxima.horario?.diaSemana] || ''} • {proxima.horario?.horaInicio} - {proxima.horario?.horaFim}
            </Text>
            <View style={s.nextFooter}>
              <TouchableOpacity style={s.agendaBtn} onPress={() => router.push('/agendamento')}>
                <Text style={s.agendaBtnText}>Ver agenda</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Resumo */}
        <View style={s.resumoCard}>
          <View style={s.resumoItem}>
            <Text style={s.resumoNum}>{agendamentos.length}</Text>
            <Text style={s.resumoLabel}>Aulas feitas</Text>
          </View>
          <View style={s.resumoDivider} />
          <View style={s.resumoItem}>
            <Text style={s.resumoNum}>
              {agendamentos.length > 0
                ? `${Math.round((agendamentos.filter((a: any) => a.presenca?.compareceu).length / agendamentos.length) * 100)}%`
                : '—'}
            </Text>
            <Text style={s.resumoLabel}>Presença</Text>
          </View>
          <View style={s.resumoDivider} />
          <View style={s.resumoItem}>
            <Text style={s.resumoNum}>{saldo?.total ?? 0}x</Text>
            <Text style={s.resumoLabel}>Este mês</Text>
          </View>
        </View>

        {/* Lista */}
        {agendamentos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Próximas aulas</Text>
            {agendamentos.slice(0, 4).map((ag: any) => (
              <View key={ag.id} style={s.agCard}>
                <View style={s.agLeft}>
                  <View style={s.agIconWrap}>
                    <Text style={s.agIcon}>
                      {ag.horario?.modalidade?.nome === 'Pilates' ? '🧘'
                        : ag.horario?.modalidade?.nome === 'Funcional' ? '🤸' : '🏋️'}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.agModalidade}>{ag.horario?.modalidade?.nome}</Text>
                    <Text style={s.agData}>{formatRelative(ag.dataAula)} • {ag.horario?.horaInicio}</Text>
                    <Text style={s.agLocal}>Studio Life Company</Text>
                  </View>
                </View>
                <View style={s.agRight}>
                  <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[ag.status] + '20', borderColor: STATUS_COLOR[ag.status] }]}>
                    <Text style={[s.statusText, { color: STATUS_COLOR[ag.status] }]}>{STATUS_LABEL[ag.status]}</Text>
                  </View>
                  {ag.status === 'CONFIRMADO' && (
                    <TouchableOpacity onPress={() => handleCancelar(ag.id)}>
                      <Text style={s.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
      <TabBar />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: LC.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: LC.bg },
  greeting: { fontSize: 20, fontWeight: '700', color: LC.textPrimary },
  subGreeting: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: LC.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: LC.border },
  notifIcon: { fontSize: 18 },
  planCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 18, ...LC.shadow },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planMeta: { fontSize: 12, color: LC.textMuted, marginBottom: 3 },
  planNome: { fontSize: 17, fontWeight: '700', color: LC.textPrimary },
  planSub: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  planLinkText: { color: LC.primary, fontSize: 13, fontWeight: '600' },
  saldoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  saldoLabel: { fontSize: 13, fontWeight: '600', color: LC.textPrimary },
  saldoRenova: { fontSize: 12, color: LC.textMuted },
  saldoNum: { fontSize: 13, color: LC.textSecondary, marginBottom: 10 },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11 },
  dotUsed: { backgroundColor: LC.primary },
  dotFree: { backgroundColor: LC.border },
  nextCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: LC.primary, borderRadius: LC.radius.lg, padding: 18 },
  nextMeta: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  nextModalidade: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  nextText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 14 },
  nextFooter: { alignItems: 'flex-end' },
  agendaBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: LC.radius.full },
  agendaBtnText: { color: LC.primary, fontWeight: '700', fontSize: 13 },
  resumoCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', ...LC.shadow },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoNum: { fontSize: 22, fontWeight: '700', color: LC.textPrimary },
  resumoLabel: { fontSize: 11, color: LC.textMuted, marginTop: 2 },
  resumoDivider: { width: 1, height: 32, backgroundColor: LC.border },
  section: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: LC.textPrimary, marginBottom: 10 },
  agCard: { backgroundColor: LC.bgCard, borderRadius: LC.radius.md, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...LC.shadow },
  agLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  agIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: LC.primaryLight, justifyContent: 'center', alignItems: 'center' },
  agIcon: { fontSize: 20 },
  agModalidade: { fontSize: 14, fontWeight: '600', color: LC.textPrimary },
  agData: { fontSize: 12, color: LC.textSecondary, marginTop: 1 },
  agLocal: { fontSize: 11, color: LC.textMuted, marginTop: 1 },
  agRight: { alignItems: 'flex-end', gap: 4 },
  statusDot: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: LC.radius.full, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cancelText: { fontSize: 11, color: LC.danger, fontWeight: '500' },
});
