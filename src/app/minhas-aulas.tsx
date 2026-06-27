import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { api, ApiError } from '../services/api';
import { LC } from '../constants/theme';
import { TabBar } from '../components/tab-bar';
import { formatDate } from '../services/date';

export default function MinhasAulas() {
  const { accessToken, logout } = useAuthStore();
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    try {
      const data = await api.get('/agendamentos/meus', accessToken!);
      setAgendamentos(data);
    } catch (e) { if (e instanceof ApiError && e.status === 401) logout(); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const cancelar = (id: string) => {
    Alert.alert('Cancelar aula', 'Tem certeza?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim', style: 'destructive', onPress: async () => {
        try { await api.patch(`/agendamentos/${id}/cancelar`, undefined, accessToken!); carregar(); }
        catch (e) { Alert.alert('Erro', String(e instanceof ApiError ? e.message : e)); }
      }},
    ]);
  };

  const MOD_ICON: Record<string, string> = { Funcional: '🤸', Pilates: '🧘', Academia: '🏋️' };
  const MOD_COLOR: Record<string, string> = { Funcional: '#E8F5FF', Pilates: '#F0FDF4', Academia: '#FEF3C7' };
  const DIAS_PT: Record<string, string> = { SEGUNDA: 'Segunda', TERCA: 'Terça', QUARTA: 'Quarta', QUINTA: 'Quinta', SEXTA: 'Sexta' };

  if (loading) return <View style={s.center}><ActivityIndicator color={LC.primary} size="large" /></View>;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <View style={s.header}>
        <Text style={s.titulo}>Minhas Aulas</Text>
      </View>
      <FlatList
        data={agendamentos}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>Nenhuma aula agendada</Text>
            <TouchableOpacity onPress={() => router.push('/agendamento')}>
              <Text style={s.emptyLink}>Agendar uma aula →</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const nome = item.horario?.modalidade?.nome || '';
          const icone = MOD_ICON[nome] || '📍';
          const cor = MOD_COLOR[nome] || LC.primaryLight;
          const dia = DIAS_PT[item.horario?.diaSemana] || '';
          return (
            <View style={s.card}>
              <View style={[s.iconWrap, { backgroundColor: cor }]}>
                <Text style={s.icon}>{icone}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.modalidade}>{nome}</Text>
                <Text style={s.dataTexto}>{dia} • {item.horario?.horaInicio} - {item.horario?.horaFim}</Text>
                <Text style={s.local}>Studio Life Company</Text>
              </View>
              <TouchableOpacity style={s.cancelBtn} onPress={() => cancelar(item.id)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
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
  header: { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: LC.bg },
  titulo: { fontSize: 22, fontWeight: '700', color: LC.textPrimary },
  card: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, ...LC.shadow },
  iconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 22 },
  info: { flex: 1 },
  modalidade: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  dataTexto: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  local: { fontSize: 12, color: LC.textMuted, marginTop: 1 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: LC.radius.full, borderWidth: 1.5, borderColor: LC.danger },
  cancelBtnText: { color: LC.danger, fontWeight: '600', fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: LC.textMuted, fontSize: 15 },
  emptyLink: { color: LC.primary, fontWeight: '600', marginTop: 8, fontSize: 14 },
});
