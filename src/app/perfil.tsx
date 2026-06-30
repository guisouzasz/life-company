import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { LC } from '../constants/theme';
import { TabBar } from '../components/tab-bar';
import { Avatar } from '../components/ui/avatar';
import { Card } from '../components/ui/card';
import { Icon, type IconName } from '../components/ui/icon';
import { ConfirmModal, InfoModal } from '../components/ui/modal';
import { useMe } from '../services/auth/auth.queries';
import { useSaldo } from '../services/usuarios/usuarios.queries';
import { useLogout } from '../services/auth/auth.mutations';

export default function Perfil() {
  const nome = useAuthStore((s) => s.nome);
  const me = useMe();
  const saldo = useSaldo();
  const logout = useLogout();
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [emBreve, setEmBreve] = useState(false);

  const menu: { label: string; icon: IconName; onPress: () => void }[] = [
    { label: 'Dados pessoais', icon: 'person-outline', onPress: () => setEmBreve(true) },
    { label: 'Alterar senha', icon: 'lock-closed-outline', onPress: () => setEmBreve(true) },
    { label: 'Notificações', icon: 'notifications-outline', onPress: () => router.push('/notificacoes') },
  ];

  const info: { label: string; value: string }[] = [
    { label: 'Nome', value: nome || '—' },
    { label: 'E-mail', value: me.data?.email || '—' },
    { label: 'Plano', value: saldo.data ? `${saldo.data.plano} • ${saldo.data.modalidade}` : '—' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Meu perfil</Text>
        </View>

        {/* Avatar */}
        <View style={s.avatarSection}>
          <View>
            <Avatar nome={nome} size={88} />
            <Pressable style={s.editBadge} onPress={() => setEmBreve(true)} hitSlop={6}>
              <Icon name="create-outline" size={14} color={LC.primary} />
            </Pressable>
          </View>
          <Text style={s.nome}>{nome}</Text>
          {me.data?.email ? <Text style={s.email}>{me.data.email}</Text> : null}
        </View>

        {/* Info */}
        <Card style={s.card} padding={4}>
          {info.map((row, i) => (
            <View key={row.label} style={[s.infoRow, i < info.length - 1 && s.rowBorder]}>
              <Text style={s.infoLabel}>{row.label}</Text>
              <Text style={s.infoValue} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
        </Card>

        {/* Menu */}
        <Card style={s.card} padding={4}>
          {menu.map((item, i) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [s.menuRow, i < menu.length - 1 && s.rowBorder, pressed && s.pressed]}
              onPress={item.onPress}
            >
              <View style={s.menuIcon}>
                <Icon name={item.icon} size={18} color={LC.primary} />
              </View>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Icon name="chevron-forward" size={18} color={LC.textMuted} />
            </Pressable>
          ))}
        </Card>

        {/* Sair */}
        <Pressable style={({ pressed }) => [s.logout, pressed && s.pressed]} onPress={() => setConfirmarSaida(true)}>
          <Icon name="log-out-outline" size={20} color={LC.danger} />
          <Text style={s.logoutText}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
      <TabBar />

      <ConfirmModal
        visible={confirmarSaida}
        title="Sair da conta"
        message="Deseja realmente sair?"
        confirmLabel="Sair"
        destructive
        loading={logout.isPending}
        onConfirm={() => logout.mutate()}
        onCancel={() => setConfirmarSaida(false)}
      />
      <InfoModal
        visible={emBreve}
        title="Disponível em breve"
        message="Para alterar seus dados, fale com a recepção do studio."
        onClose={() => setEmBreve(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { paddingBottom: 20 },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  editBadge: {
    position: 'absolute', bottom: 0, right: -2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: LC.bgCard, borderWidth: 2, borderColor: LC.bg, alignItems: 'center', justifyContent: 'center',
  },
  nome: { fontSize: 19, fontWeight: '800', color: LC.textPrimary, marginTop: 12 },
  email: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  card: { marginHorizontal: 16, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  infoLabel: { fontSize: 14, color: LC.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '700', color: LC.textPrimary, flexShrink: 1, textAlign: 'right' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: LC.textPrimary },
  logout: {
    marginHorizontal: 16, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: LC.radius.lg, backgroundColor: LC.dangerBg,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: LC.danger },
  pressed: { opacity: 0.7 },
});
