import { TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { LC } from '../constants/theme';

const TABS = [
  { label: 'Início',    route: '/dashboard',   icon: '⌂',  activeRoutes: ['/dashboard'] },
  { label: 'Agenda',    route: '/agendamento', icon: '▦',  activeRoutes: ['/agendamento', '/minhas-aulas'] },
  { label: 'Histórico', route: '/historico',   icon: '↺',  activeRoutes: ['/historico'] },
  { label: 'Perfil',    route: '/perfil',      icon: '◯',  activeRoutes: ['/perfil', '/meu-plano', '/notificacoes'] },
];

const ADMIN_TABS = [
  { label: 'Início',     route: '/admin/dashboard',  icon: '⌂',  activeRoutes: ['/admin/dashboard'] },
  { label: 'Alunos',     route: '/admin/alunos',     icon: '◉',  activeRoutes: ['/admin/alunos', '/admin/novo-aluno'] },
  { label: 'Horários',   route: '/admin/horarios',   icon: '▦',  activeRoutes: ['/admin/horarios'] },
  { label: 'Frequência', route: '/admin/frequencia', icon: '↺',  activeRoutes: ['/admin/frequencia'] },
];

export function TabBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? ADMIN_TABS : TABS;

  return (
    <View style={s.bar}>
      {tabs.map(tab => {
        const active = tab.activeRoutes.some(r => pathname === r || pathname.startsWith(r + '/'));
        return (
          <TouchableOpacity
            key={tab.route}
            style={s.tab}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <View style={[s.iconWrap, active && s.iconWrapActive]}>
              <Text style={[s.icon, active && s.iconActive]}>{tab.icon}</Text>
            </View>
            <Text style={[s.label, active && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
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
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: {
    width: 44, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  iconWrapActive: { backgroundColor: LC.primaryLight },
  icon: { fontSize: 17, color: LC.textMuted },
  iconActive: { color: LC.primary },
  label: { fontSize: 10, color: LC.textMuted, fontWeight: '500' },
  labelActive: { color: LC.primary, fontWeight: '700' },
});
