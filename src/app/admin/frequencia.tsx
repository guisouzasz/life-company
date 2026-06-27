import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { api, ApiError } from '../../services/api';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';

export default function AdminFrequencia() {
  const { accessToken, logout } = useAuthStore();
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/relatorios/frequencia', accessToken!)
      .then(setDados)
      .catch(e => { if (e instanceof ApiError && e.status === 401) logout(); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={LC.primary} /></View>;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹</Text></TouchableOpacity>
        <Text style={s.titulo}>Frequência</Text>
      </View>
      <FlatList
        data={dados}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        renderItem={({ item }) => {
          const total = item.agendamentos.length;
          const presentes = item.agendamentos.filter((a: any) => a.presenca?.compareceu).length;
          const taxa = total > 0 ? Math.round((presentes / total) * 100) : 0;
          const plano = item.usuarioPlanos?.[0];
          const cor = taxa >= 70 ? LC.success : taxa >= 40 ? LC.warning : LC.danger;
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.avatar, { backgroundColor: LC.primaryLight }]}>
                  <Text style={[s.avatarText, { color: LC.primary }]}>{item.nome.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>{item.nome}</Text>
                  {plano && <Text style={s.plano}>{plano.modalidade?.nome} • {plano.plano?.nome} • {plano.aulasUsadasSemana}/{plano.plano?.aulasSemanais} esta semana</Text>}
                </View>
                <Text style={[s.taxa, { color: cor }]}>{taxa}%</Text>
              </View>
              <View style={s.progBg}>
                <View style={[s.progFill, { width: `${taxa}%`, backgroundColor: cor }]} />
              </View>
              <Text style={s.progSub}>{presentes} presenças de {total} aulas</Text>
            </View>
          );
        }}
      />
      <TabBar isAdmin />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20 },
  back: { fontSize: 28, color: LC.textPrimary },
  titulo: { fontSize: 22, fontWeight: '700', color: LC.textPrimary },
  card: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 14, marginBottom: 10, ...LC.shadow },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', fontSize: 18 },
  nome: { fontSize: 15, fontWeight: '600', color: LC.textPrimary },
  plano: { fontSize: 11, color: LC.textMuted, marginTop: 2 },
  taxa: { fontSize: 22, fontWeight: '700' },
  progBg: { height: 6, backgroundColor: LC.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progFill: { height: '100%', borderRadius: 3 },
  progSub: { fontSize: 12, color: LC.textMuted },
});
