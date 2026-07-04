import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { LC } from '../constants/theme';
import { Icon, type IconName } from './ui/icon';

type Tab = {
  label: string;
  route: string;
  icon: IconName;
  iconActive: IconName;
  activeRoutes: string[];
};

const TABS: Tab[] = [
  { label: 'Início', route: '/dashboard', icon: 'home-outline', iconActive: 'home', activeRoutes: ['/dashboard'] },
  { label: 'Agenda', route: '/agendamento', icon: 'calendar-outline', iconActive: 'calendar', activeRoutes: ['/agendamento', '/minhas-aulas'] },
  { label: 'Histórico', route: '/historico', icon: 'time-outline', iconActive: 'time', activeRoutes: ['/historico'] },
  { label: 'Perfil', route: '/perfil', icon: 'person-outline', iconActive: 'person', activeRoutes: ['/perfil', '/meu-plano', '/notificacoes'] },
];

const ADMIN_TABS: Tab[] = [
  { label: 'Início', route: '/admin/dashboard', icon: 'home-outline', iconActive: 'home', activeRoutes: ['/admin/dashboard'] },
  { label: 'Alunos', route: '/admin/alunos', icon: 'people-outline', iconActive: 'people', activeRoutes: ['/admin/alunos', '/admin/novo-aluno'] },
  { label: 'Horários', route: '/admin/horarios', icon: 'calendar-outline', iconActive: 'calendar', activeRoutes: ['/admin/horarios'] },
  { label: 'Frequência', route: '/admin/frequencia', icon: 'stats-chart-outline', iconActive: 'stats-chart', activeRoutes: ['/admin/frequencia'] },
];

export function TabBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? ADMIN_TABS : TABS;

  return (
    <View style={s.bar}>
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
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: LC.bgCard,
    borderTopWidth: 1,
    borderTopColor: LC.border,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 12,
    paddingHorizontal: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 11, color: LC.textMuted, fontWeight: '500' },
  labelActive: { color: LC.primary, fontWeight: '700' },
});
