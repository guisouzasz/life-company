import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { LC } from '../constants/theme';
import { Icon, type IconName } from './ui/icon';
import { useIsDesktop } from '../hooks/use-is-desktop';

export type Tab = {
  label: string;
  route: string;
  icon: IconName;
  iconActive: IconName;
  activeRoutes: string[];
};

const TABS: Tab[] = [
  { label: 'Início', route: '/dashboard', icon: 'home-outline', iconActive: 'home', activeRoutes: ['/dashboard'] },
  { label: 'Agenda', route: '/agendamento', icon: 'calendar-outline', iconActive: 'calendar', activeRoutes: ['/agendamento', '/minhas-aulas'] },
  { label: 'Treinos', route: '/meus-treinos', icon: 'barbell-outline', iconActive: 'barbell', activeRoutes: ['/meus-treinos'] },
  { label: 'Histórico', route: '/historico', icon: 'time-outline', iconActive: 'time', activeRoutes: ['/historico'] },
  { label: 'Perfil', route: '/perfil', icon: 'person-outline', iconActive: 'person', activeRoutes: ['/perfil', '/meu-plano', '/notificacoes'] },
];

export const PROF_TABS: Tab[] = [
  { label: 'Agenda', route: '/professor/agenda', icon: 'calendar-outline', iconActive: 'calendar', activeRoutes: ['/professor/agenda'] },
  { label: 'Treinos', route: '/professor/treinos', icon: 'barbell-outline', iconActive: 'barbell', activeRoutes: ['/professor/treinos', '/professor/treinos-aluno'] },
  { label: 'Perfil', route: '/professor/perfil', icon: 'person-outline', iconActive: 'person', activeRoutes: ['/professor/perfil'] },
];

export const ADMIN_TABS: Tab[] = [
  { label: 'Início', route: '/admin/dashboard', icon: 'home-outline', iconActive: 'home', activeRoutes: ['/admin/dashboard'] },
  { label: 'Alunos', route: '/admin/alunos', icon: 'people-outline', iconActive: 'people', activeRoutes: ['/admin/alunos', '/admin/novo-aluno', '/admin/professores', '/admin/treinos-aluno'] },
  // A aba é a AGENDA da semana, que é o uso diário; a grade de horários
  // (criar/editar turma) vive dentro dela, no botão "Gerenciar horários".
  // Uma sexta aba deixaria os rótulos ilegíveis na barra do celular.
  { label: 'Agenda', route: '/admin/agenda', icon: 'calendar-outline', iconActive: 'calendar', activeRoutes: ['/admin/agenda', '/admin/horarios'] },
  { label: 'Financeiro', route: '/admin/financeiro', icon: 'wallet-outline', iconActive: 'wallet', activeRoutes: ['/admin/financeiro'] },
  { label: 'Frequência', route: '/admin/frequencia', icon: 'stats-chart-outline', iconActive: 'stats-chart', activeRoutes: ['/admin/frequencia'] },
];

export function TabBar({ isAdmin = false, isProfessor = false }: { isAdmin?: boolean; isProfessor?: boolean }) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const tabs = isAdmin ? ADMIN_TABS : isProfessor ? PROF_TABS : TABS;

  // No painel desktop a navegação do admin mora na sidebar (admin-shell).
  if (isAdmin && isDesktop) return null;

  return (
    <View style={s.bar}>
      <View style={s.barInner}>
      {tabs.map((tab) => {
        const active = tab.activeRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
        return (
          <Pressable
            key={tab.route}
            style={s.tab}
            onPress={() => router.replace(tab.route as any)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Icon
              name={active ? tab.iconActive : tab.icon}
              size={24}
              color={active ? LC.primary : LC.textMuted}
            />
            <Text style={[s.label, active && s.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // A barra branca ocupa a largura toda; só os itens ficam na coluna central.
  barInner: { flexDirection: 'row', ...LC.coluna },
  bar: {
    backgroundColor: LC.bgCard,
    borderTopWidth: 1,
    borderTopColor: LC.border,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 12,
    paddingHorizontal: 4,
    ...(Platform.select({
      web: { boxShadow: '0px -4px 14px rgba(15, 23, 42, 0.05)' },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 12,
      },
    }) as object),
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 11, color: LC.textMuted, fontWeight: '500' },
  labelActive: { color: LC.primary, fontWeight: '700' },
});
