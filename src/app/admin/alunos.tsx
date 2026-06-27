import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { api, ApiError } from '../../services/api';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';

export default function AdminAlunos() {
  const { accessToken, logout } = useAuthStore();
  const [alunos, setAlunos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  const carregar = async (b?: string) => {
    try { const data = await api.get(`/usuarios${b ? `?busca=${b}` : ''}`, accessToken!); setAlunos(data); }
    catch (e) { if (e instanceof ApiError && e.status === 401) logout(); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const gerarLink = async (id: string) => {
    try {
      const data = await api.post(`/usuarios/${id}/gerar-link`, {}, accessToken!);
      Alert.alert('🔗 Link gerado!', data.link);
    } catch (e) { Alert.alert('Erro', String(e instanceof ApiError ? e.message : e)); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={LC.primary} /></View>;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹</Text></TouchableOpacity>
        <Text style={s.titulo}>Alunos ({alunos.length})</Text>
      </View>
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.search} placeholder="Buscar por nome, CPF ou e-mail..." placeholderTextColor={LC.textMuted}
          value={busca} onChangeText={t => { setBusca(t); carregar(t); }}
        />
      </View>
      <FlatList
        data={alunos}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyText}>Nenhum aluno encontrado</Text></View>}
        renderItem={({ item }) => {
          const plano = item.usuarioPlanos?.[0];
          return (
            <View style={s.card}>
              <View style={s.cardMain}>
                <View style={[s.avatar, { backgroundColor: item.ativo ? LC.primaryLight : '#F1F5F9' }]}>
                  <Text style={[s.avatarText, { color: item.ativo ? LC.primary : LC.textMuted }]}>{item.nome.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>{item.nome}</Text>
                  <Text style={s.email}>{item.email}</Text>
                  {plano && <Text style={s.plano}>{plano.modalidade?.nome} • {plano.plano?.nome}</Text>}
                </View>
                <View style={[s.badge, { backgroundColor: item.ativo ? LC.successBg : LC.dangerBg }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: item.ativo ? LC.success : LC.danger }}>{item.ativo ? 'Ativo' : 'Inativo'}</Text>
                </View>
              </View>
              {!item.ativo && (
                <TouchableOpacity style={s.linkBtn} onPress={() => gerarLink(item.id)}>
                  <Text style={s.linkBtnText}>🔗 Gerar link de acesso</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
      <TouchableOpacity style={s.fab} onPress={() => router.push('/admin/novo-aluno')}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
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
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: LC.bgCard, borderRadius: LC.radius.md, borderWidth: 1, borderColor: LC.border, paddingHorizontal: 12, marginBottom: 4 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  search: { flex: 1, padding: 13, fontSize: 14, color: LC.textPrimary },
  card: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 14, marginBottom: 10, ...LC.shadow },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', fontSize: 18 },
  nome: { fontSize: 15, fontWeight: '600', color: LC.textPrimary },
  email: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  plano: { fontSize: 11, color: LC.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: LC.radius.full },
  linkBtn: { marginTop: 10, backgroundColor: '#EEF2FF', borderRadius: LC.radius.md, padding: 10, alignItems: 'center' },
  linkBtnText: { color: '#4F46E5', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: LC.textMuted, fontSize: 14 },
  fab: { position: 'absolute', bottom: 88, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: LC.primary, justifyContent: 'center', alignItems: 'center', ...LC.shadowStrong },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
