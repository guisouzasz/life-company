import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { api } from '../../services/api';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';

const DIAS = ['SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA'];
const DIA_LABEL: Record<string, string> = { SEGUNDA:'Seg', TERCA:'Ter', QUARTA:'Qua', QUINTA:'Qui', SEXTA:'Sex' };
const MOD_ICON: Record<string, string> = { Funcional:'🤸', Pilates:'🧘', Academia:'🏋️' };

export default function AdminHorarios() {
  const { accessToken } = useAuthStore();
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [diaSel, setDiaSel] = useState('SEGUNDA');

  const carregar = async () => {
    try { const data = await api.get('/horarios', accessToken!); setHorarios(data); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const bloquear = async (id: string, ativo: boolean) => {
    Alert.alert(ativo ? 'Bloquear horário?' : 'Desbloquear horário?', 'Confirma a ação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => { await api.patch(`/horarios/${id}/bloquear`, {}, accessToken!); carregar(); } },
    ]);
  };

  const filtered = horarios.filter(h => h.diaSemana === diaSel);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={LC.primary} /></View>;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹</Text></TouchableOpacity>
        <Text style={s.titulo}>Horários</Text>
      </View>
      <View style={s.diasRow}>
        {DIAS.map(d => (
          <TouchableOpacity key={d} style={[s.diaBtn, diaSel === d && s.diaBtnSel]} onPress={() => setDiaSel(d)}>
            <Text style={[s.diaBtnText, diaSel === d && s.diaBtnTextSel]}>{DIA_LABEL[d]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={h => h.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyText}>Nenhum horário</Text></View>}
        renderItem={({ item }) => {
          const pct = Math.round((item.agendados / item.capacidadeMaxima) * 100);
          const nome = item.modalidade?.nome || '';
          return (
            <View style={[s.card, !item.ativo && { opacity: 0.55 }]}>
              <View style={[s.modIcon, { backgroundColor: item.ativo ? LC.primaryLight : '#F1F5F9' }]}>
                <Text style={s.modIconText}>{MOD_ICON[nome] || '📍'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.hora}>{item.horaInicio} – {item.horaFim}</Text>
                <Text style={s.modNome}>{nome}</Text>
                <View style={s.vagasRow}>
                  <View style={s.vagasBg}>
                    <View style={[s.vagasFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? LC.danger : pct >= 75 ? LC.warning : LC.success }]} />
                  </View>
                  <Text style={s.vagasText}>{item.agendados}/{item.capacidadeMaxima}</Text>
                </View>
              </View>
              <TouchableOpacity style={[s.blockBtn, { backgroundColor: item.ativo ? LC.dangerBg : LC.successBg }]} onPress={() => bloquear(item.id, item.ativo)}>
                <Text style={[s.blockText, { color: item.ativo ? LC.danger : LC.success }]}>{item.ativo ? '🔒' : '🔓'}</Text>
              </TouchableOpacity>
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
  diasRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  diaBtn: { flex: 1, paddingVertical: 10, borderRadius: LC.radius.md, alignItems: 'center', backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border },
  diaBtnSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  diaBtnText: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
  diaBtnTextSel: { color: '#fff' },
  card: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, ...LC.shadow },
  modIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  modIconText: { fontSize: 22 },
  hora: { fontSize: 16, fontWeight: '700', color: LC.textPrimary },
  modNome: { fontSize: 13, color: LC.textSecondary, marginTop: 2, marginBottom: 8 },
  vagasRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vagasBg: { flex: 1, height: 5, backgroundColor: LC.border, borderRadius: 3, overflow: 'hidden' },
  vagasFill: { height: '100%', borderRadius: 3 },
  vagasText: { fontSize: 12, fontWeight: '600', color: LC.textSecondary, minWidth: 32 },
  blockBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  blockText: { fontSize: 16 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: LC.textMuted, fontSize: 14 },
});
