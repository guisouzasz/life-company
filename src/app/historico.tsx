import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { api, ApiError } from '../services/api';
import { LC } from '../constants/theme';
import { TabBar } from '../components/tab-bar';
import { formatDate } from '../services/date';

const STATUS_COLOR: Record<string, string> = { CONFIRMADO: LC.success, CANCELADO: LC.danger, REALIZADO: LC.info, FALTOU: LC.warning };
const STATUS_LABEL: Record<string, string> = { CONFIRMADO: 'Confirmada', CANCELADO: 'Cancelada', REALIZADO: 'Realizada', FALTOU: 'Faltou' };

export default function Historico() {
  const { accessToken, logout } = useAuthStore();
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const carregar = async (p = 1) => {
    try {
      const data = await api.get(`/agendamentos/historico?page=${p}`, accessToken!);
      if (p === 1) setHistorico(data); else setHistorico(prev => [...prev, ...data]);
      setHasMore(data.length === 20);
    } catch (e) { if (e instanceof ApiError && e.status === 401) logout(); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={LC.primary} /></View>;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <View style={s.header}>
        <Text style={s.titulo}>Histórico</Text>
        <TouchableOpacity style={s.periodoBtn}>
          <Text style={s.periodoText}>Este mês ▾</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={historico}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyText}>Nenhuma aula no histórico</Text></View>}
        onEndReached={() => { if (hasMore) { const p = page + 1; setPage(p); carregar(p); } }}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => {
          const presente = item.presenca?.compareceu;
          const temPresenca = item.presenca != null;
          return (
            <View style={s.card}>
              <View style={s.dateBubble}>
                <Text style={s.dateNum}>{formatDate(item.dataAula, 'DD')}</Text>
                <Text style={s.dateMes}>{formatDate(item.dataAula, 'MMM')}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.modalidade}>{item.horario?.modalidade?.nome}</Text>
                <Text style={s.dataTexto}>{item.horario?.horaInicio} • Professor Lucas</Text>
              </View>
              {temPresenca ? (
                <View style={[s.badge, { backgroundColor: presente ? LC.successBg : LC.dangerBg }]}>
                  <Text style={[s.badgeText, { color: presente ? LC.success : LC.danger }]}>
                    {presente ? 'Presença' : 'Falta'}
                  </Text>
                </View>
              ) : (
                <View style={[s.badge, { backgroundColor: (STATUS_COLOR[item.status] || '#eee') + '25' }]}>
                  <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
                </View>
              )}
            </View>
          );
        }}
      />
      <TabBar />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: LC.bg },
  titulo: { fontSize: 22, fontWeight: '700', color: LC.textPrimary },
  periodoBtn: { backgroundColor: LC.bgCard, borderRadius: LC.radius.md, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: LC.border },
  periodoText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  card: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, ...LC.shadow },
  dateBubble: { width: 44, height: 44, borderRadius: 12, backgroundColor: LC.primaryLight, justifyContent: 'center', alignItems: 'center' },
  dateNum: { fontSize: 16, fontWeight: '700', color: LC.primary },
  dateMes: { fontSize: 10, color: LC.primary, textTransform: 'uppercase', fontWeight: '600' },
  info: { flex: 1 },
  modalidade: { fontSize: 15, fontWeight: '600', color: LC.textPrimary },
  dataTexto: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: LC.radius.full },
  badgeText: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: LC.textMuted, fontSize: 15 },
});
