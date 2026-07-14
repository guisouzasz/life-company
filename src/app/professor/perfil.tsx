import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../store/auth';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Avatar } from '../../components/ui/avatar';
import { Card } from '../../components/ui/card';
import { Icon, type IconName } from '../../components/ui/icon';
import { ConfirmModal } from '../../components/ui/modal';
import { useMe } from '../../services/auth/auth.queries';
import { useLogout } from '../../services/auth/auth.mutations';

/** Perfil do professor: dados básicos, tema e sair. */
export default function ProfessorPerfil() {
  const nome = useAuthStore((s) => s.nome);
  const me = useMe();
  const logout = useLogout();
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  const menu: { label: string; icon: IconName; onPress: () => void }[] = [];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Meu perfil</Text>
        </View>

        <View style={s.avatarSection}>
          <Avatar nome={nome} size={88} />
          <Text style={s.nome}>{nome}</Text>
          <View style={s.tag}>
            <Icon name="school-outline" size={13} color={LC.primary} />
            <Text style={s.tagText}>Professor</Text>
          </View>
          {me.data?.email ? <Text style={s.email}>{me.data.email}</Text> : null}
        </View>

        {menu.length > 0 ? (
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
        ) : null}

        <Pressable style={({ pressed }) => [s.logout, pressed && s.pressed]} onPress={() => setConfirmarSaida(true)}>
          <Icon name="log-out-outline" size={20} color={LC.danger} />
          <Text style={s.logoutText}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
      <TabBar isProfessor />

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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { paddingBottom: 20 },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  nome: { fontSize: 19, fontWeight: '800', color: LC.textPrimary, marginTop: 12 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    backgroundColor: LC.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: LC.radius.full,
  },
  tagText: { fontSize: 12, fontWeight: '700', color: LC.primary },
  email: { fontSize: 13, color: LC.textSecondary, marginTop: 6 },
  card: { marginHorizontal: 16, marginBottom: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: LC.textPrimary },
  logout: {
    marginHorizontal: 16, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: LC.radius.lg, backgroundColor: LC.dangerBg,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: LC.danger },
  pressed: { opacity: 0.7 },
});
