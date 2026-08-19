import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LC } from '../../constants/theme';
import { STUDIO_NOME } from '../../constants/app';
import { Assets } from '../../constants/assets';
import { Icon } from '../ui/icon';
import { Input } from '../ui/input';
import { Avatar } from '../ui/avatar';
import { ConfirmModal } from '../ui/modal';
import { ADMIN_TABS } from '../tab-bar';
import { useAuthStore } from '../../store/auth';
import { useLogout } from '../../services/auth/auth.mutations';
import { formatDate } from '../../services/date';

/**
 * Casca do painel admin no desktop: sidebar fixa (logo, navegação, novo aluno,
 * logout) + topbar com busca de alunos + área de conteúdo centralizada.
 * No mobile este componente não é usado (ver admin/_layout.tsx).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const nome = useAuthStore((s) => s.nome);
  const logout = useLogout();
  const [busca, setBusca] = useState('');
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  const buscar = () => {
    const q = busca.trim();
    if (!q) return;
    setBusca('');
    // replace (não push): buscar já estando em Alunos não empilha outra tela
    router.replace({ pathname: '/admin/alunos', params: { busca: q } });
  };

  return (
    <View style={s.root}>
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <View style={s.sidebar}>
        <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoBox}>
          <Image source={Assets.logoColor} style={s.logo} resizeMode="contain" />
          <Text style={s.studioName}>{STUDIO_NOME}</Text>
        </LinearGradient>

        <Pressable style={({ pressed }) => [s.novoAluno, pressed && s.pressed]} onPress={() => router.push('/admin/novo-aluno')}>
          <Icon name="add" size={18} color="#fff" />
          <Text style={s.novoAlunoText}>Novo aluno</Text>
        </Pressable>

        <View style={s.nav}>
          {ADMIN_TABS.map((tab) => {
            const active = tab.activeRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
            return (
              <Pressable
                key={tab.route}
                style={({ pressed }) => [s.navItem, active && s.navItemActive, pressed && s.pressed]}
                onPress={() => router.replace(tab.route as any)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Icon name={active ? tab.iconActive : tab.icon} size={20} color={active ? LC.primary : LC.textSecondary} />
                <Text style={[s.navLabel, active && s.navLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.footer}>
          <Avatar nome={nome ?? 'Admin'} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={s.footerNome} numberOfLines={1}>{nome ?? 'Admin'}</Text>
            <Text style={s.footerRole}>Administrador</Text>
          </View>
          <Pressable onPress={() => setConfirmarSaida(true)} hitSlop={8} style={s.logoutBtn}>
            <Icon name="log-out-outline" size={18} color={LC.danger} />
          </Pressable>
        </View>
      </View>

      {/* ── Coluna direita ──────────────────────────────────────── */}
      <View style={s.main}>
        <View style={s.topbar}>
          <View style={s.searchWrap}>
            <Input
              placeholder="Buscar aluno por nome, CPF ou e-mail"
              value={busca}
              onChangeText={setBusca}
              onSubmitEditing={buscar}
              returnKeyType="search"
              autoCapitalize="none"
              leftIcon={<Icon name="search-outline" size={18} color={LC.textMuted} />}
            />
          </View>
          <Text style={s.hoje}>{formatDate(new Date(), 'dddd, DD MMMM YYYY')}</Text>
        </View>

        <View style={s.contentArea}>
          <View style={s.content}>{children}</View>
        </View>
      </View>

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
  root: { flex: 1, flexDirection: 'row', backgroundColor: LC.bg },

  sidebar: { width: 250, backgroundColor: LC.bgCard, borderRightWidth: 1, borderRightColor: LC.border },
  logoBox: { alignItems: 'center', paddingVertical: 22, gap: 4 },
  logo: { width: 110, height: 64 },
  studioName: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6, textTransform: 'uppercase' },

  novoAluno: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 14, marginTop: 16, paddingVertical: 11,
    borderRadius: LC.radius.md, backgroundColor: LC.primary,
  },
  novoAlunoText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  nav: { flex: 1, marginTop: 18, paddingHorizontal: 10, gap: 2 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: LC.radius.md },
  navItemActive: { backgroundColor: LC.primaryLight },
  navLabel: { fontSize: 14, fontWeight: '600', color: LC.textSecondary },
  navLabelActive: { color: LC.primary, fontWeight: '700' },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderTopWidth: 1, borderTopColor: LC.border,
  },
  footerNome: { fontSize: 13, fontWeight: '700', color: LC.textPrimary },
  footerRole: { fontSize: 11, color: LC.textMuted },
  logoutBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },

  main: { flex: 1 },
  topbar: {
    height: 64, flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 24, backgroundColor: LC.bgCard,
    borderBottomWidth: 1, borderBottomColor: LC.border,
  },
  searchWrap: { flex: 1, maxWidth: 420 },
  hoje: { marginLeft: 'auto', fontSize: 13, color: LC.textSecondary, textTransform: 'capitalize' },

  contentArea: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 1160, alignSelf: 'center', paddingHorizontal: 24 },

  pressed: { opacity: 0.75 },
});
