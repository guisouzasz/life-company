import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { LC } from '../constants/theme';
import { TabBar } from '../components/tab-bar';

export default function Perfil() {
  const { nome, logout } = useAuthStore();

  const confirmarSaida = () => {
    Alert.alert('Sair da conta', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { logout(); router.replace('/'); } },
    ]);
  };

  const inicial = nome?.charAt(0).toUpperCase() || '?';

  const MENU = [
    { label: 'Dados pessoais', icon: '👤', action: () => {} },
    { label: 'Alterar senha',  icon: '🔒', action: () => {} },
    { label: 'Notificações',   icon: '🔔', action: () => router.push('/notificacoes') },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={s.header}>
          <Text style={s.titulo}>Meu perfil</Text>
        </View>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatarWrap}>
            <Text style={s.avatarText}>{inicial}</Text>
            <TouchableOpacity style={s.editBadge}><Text style={{ fontSize: 12 }}>✏️</Text></TouchableOpacity>
          </View>
          <Text style={s.nomeText}>{nome}</Text>
        </View>
        {/* Info cards */}
        <View style={s.infoCard}>
          {[
            { label: 'Nome', value: nome || '—' },
            { label: 'E-mail', value: '—' },
            { label: 'Telefone', value: '—' },
          ].map((row, i, arr) => (
            <View key={row.label} style={[s.infoRow, i < arr.length - 1 && s.infoRowBorder]}>
              <Text style={s.infoLabel}>{row.label}</Text>
              <Text style={s.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>
        {/* Menu */}
        <View style={s.menuCard}>
          {MENU.map((item, i) => (
            <TouchableOpacity key={item.label} style={[s.menuItem, i < MENU.length - 1 && s.menuItemBorder]} onPress={item.action}>
              <Text style={s.menuIcon}>{item.icon}</Text>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Sair */}
        <TouchableOpacity style={s.logoutBtn} onPress={confirmarSaida}>
          <Text style={s.logoutIcon}>↩</Text>
          <Text style={s.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
      <TabBar />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20 },
  titulo: { fontSize: 22, fontWeight: '700', color: LC.textPrimary },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: LC.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: LC.bgCard, borderWidth: 2, borderColor: LC.bg, justifyContent: 'center', alignItems: 'center' },
  nomeText: { fontSize: 18, fontWeight: '700', color: LC.textPrimary },
  infoCard: { marginHorizontal: 16, backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, marginBottom: 12, ...LC.shadow },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  infoLabel: { fontSize: 14, color: LC.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: LC.textPrimary },
  menuCard: { marginHorizontal: 16, backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, marginBottom: 12, ...LC.shadow },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  menuIcon: { fontSize: 18, width: 24 },
  menuLabel: { flex: 1, fontSize: 15, color: LC.textPrimary, fontWeight: '500' },
  menuArrow: { fontSize: 20, color: LC.textMuted },
  logoutBtn: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: LC.radius.lg, borderWidth: 1.5, borderColor: LC.dangerBg, backgroundColor: LC.dangerBg },
  logoutIcon: { fontSize: 18, color: LC.danger },
  logoutText: { fontSize: 15, fontWeight: '700', color: LC.danger },
});
