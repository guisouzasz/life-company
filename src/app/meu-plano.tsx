import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { api, ApiError } from '../services/api';
import { LC } from '../constants/theme';
import { TabBar } from '../components/tab-bar';
import { endOfIsoWeekFormatted } from '../services/date';

export default function MeuPlano() {
  const { accessToken, logout } = useAuthStore();
  const [saldo, setSaldo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/usuarios/me/saldo', accessToken!)
      .then(setSaldo)
      .catch(e => { if (e instanceof ApiError && e.status === 401) logout(); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: LC.bg }}><ActivityIndicator color={LC.primary} /></View>;

  const usadas = saldo?.usadas || 0;
  const total = saldo?.total || 1;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹</Text></TouchableOpacity>
        <Text style={s.titulo}>Meu plano</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.planCard}>
          <View style={s.planTop}>
            <View>
              <Text style={s.planNome}>{saldo?.plano}</Text>
              <Text style={s.planSub}>{total} aulas por semana</Text>
              <Text style={s.planRenova}>Renova em {endOfIsoWeekFormatted()}</Text>
            </View>
            <View style={s.ativoBadge}><Text style={s.ativoText}>Ativo</Text></View>
          </View>
          <View style={s.saldoBox}>
            <Text style={s.saldoTit}>Saldo da semana</Text>
            <Text style={s.saldoNum}>{usadas} de {total} aulas utilizadas</Text>
            <View style={s.dots}>
              {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={[s.dot, i < usadas ? s.dotUsed : s.dotFree]} />
              ))}
            </View>
          </View>
        </View>
        <View style={s.detCard}>
          <Text style={s.detTit}>Detalhes do plano</Text>
          {[
            { label: 'Modalidade', value: saldo?.modalidade },
            { label: 'Frequência', value: `${total}x por semana` },
            { label: 'Vigência', value: '01/06/2026 à 30/06/2026' },
            { label: 'Status', value: 'Ativo', color: LC.success },
          ].map((row, i, arr) => (
            <View key={row.label} style={[s.detRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: LC.border }]}>
              <Text style={s.detLabel}>{row.label}</Text>
              <Text style={[s.detValue, row.color ? { color: row.color, fontWeight: '700' } : {}]}>{row.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <TabBar />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20 },
  back: { fontSize: 28, color: LC.textPrimary },
  titulo: { fontSize: 22, fontWeight: '700', color: LC.textPrimary },
  planCard: { backgroundColor: LC.primary, borderRadius: LC.radius.xl, padding: 20, marginBottom: 14 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  planNome: { fontSize: 20, fontWeight: '700', color: '#fff' },
  planSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  planRenova: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  ativoBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: LC.radius.full },
  ativoText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  saldoBox: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: LC.radius.md, padding: 14 },
  saldoTit: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  saldoNum: { fontSize: 14, color: '#fff', fontWeight: '600', marginBottom: 10 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 24, height: 24, borderRadius: 12 },
  dotUsed: { backgroundColor: '#fff' },
  dotFree: { backgroundColor: 'rgba(255,255,255,0.3)' },
  detCard: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 18, ...LC.shadow },
  detTit: { fontSize: 15, fontWeight: '700', color: LC.textPrimary, marginBottom: 12 },
  detRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 },
  detLabel: { fontSize: 14, color: LC.textSecondary },
  detValue: { fontSize: 14, fontWeight: '600', color: LC.textPrimary },
});
