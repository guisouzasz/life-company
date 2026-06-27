import { View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../constants/theme';

const NOTIFS = [
  { id: '1', tipo: 'alerta',    titulo: 'Sua aula começa em 1 hora',      sub: 'Funcional • Segunda • 19:00',       tempo: 'Agora',   lida: false },
  { id: '2', tipo: 'vaga',      titulo: 'Última vaga disponível',         sub: 'Pilates • Quarta • 08:00',           tempo: '2h',      lida: false },
  { id: '3', tipo: 'info',      titulo: 'Você ainda possui 2 aulas disponíveis esta semana', sub: '', tempo: '6h', lida: true },
  { id: '4', tipo: 'confirmado',titulo: 'Agendamento confirmado!',         sub: 'Funcional • Segunda • 19:00',       tempo: '1d',      lida: true },
  { id: '5', tipo: 'cancelado', titulo: 'Aula cancelada',                 sub: 'Academia • Sexta • 19:00',          tempo: '3d',      lida: true },
];

const TIPO_ICON: Record<string, string> = { alerta: '🔔', vaga: '⚡', info: '📋', confirmado: '✅', cancelado: '❌' };
const TIPO_BG:   Record<string, string> = { alerta: '#FEF3C7', vaga: '#DBEAFE', info: '#F1F5F9', confirmado: LC.successBg, cancelado: LC.dangerBg };

export default function Notificacoes() {
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹</Text></TouchableOpacity>
        <Text style={s.titulo}>Notificações</Text>
        <TouchableOpacity><Text style={s.marcarText}>Marcar lidas</Text></TouchableOpacity>
      </View>
      <View style={s.abas}>
        <TouchableOpacity style={[s.aba, s.abaSel]}><Text style={[s.abaText, s.abaTextSel]}>Todas</Text></TouchableOpacity>
        <TouchableOpacity style={s.aba}><Text style={s.abaText}>Não lidas</Text></TouchableOpacity>
      </View>
      <FlatList
        data={NOTIFS}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[s.card, !item.lida && s.cardNaoLida]}>
            <View style={[s.iconWrap, { backgroundColor: TIPO_BG[item.tipo] }]}>
              <Text style={s.icon}>{TIPO_ICON[item.tipo]}</Text>
            </View>
            <View style={s.info}>
              <Text style={[s.titulo2, !item.lida && { fontWeight: '700' }]}>{item.titulo}</Text>
              {item.sub ? <Text style={s.sub}>{item.sub}</Text> : null}
            </View>
            <Text style={s.tempo}>{item.tempo}</Text>
            {!item.lida && <View style={s.dot} />}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20, gap: 12 },
  back: { fontSize: 28, color: LC.textPrimary, lineHeight: 28, marginRight: 4 },
  titulo: { flex: 1, fontSize: 20, fontWeight: '700', color: LC.textPrimary },
  marcarText: { fontSize: 13, color: LC.primary, fontWeight: '600' },
  abas: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LC.border, paddingHorizontal: 20, backgroundColor: LC.bgCard },
  aba: { paddingVertical: 12, marginRight: 24 },
  abaSel: { borderBottomWidth: 2, borderBottomColor: LC.primary },
  abaText: { fontSize: 14, fontWeight: '600', color: LC.textMuted },
  abaTextSel: { color: LC.primary },
  card: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, ...LC.shadow },
  cardNaoLida: { borderLeftWidth: 3, borderLeftColor: LC.primary },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  titulo2: { fontSize: 14, color: LC.textPrimary, lineHeight: 20 },
  sub: { fontSize: 12, color: LC.textMuted, marginTop: 2 },
  tempo: { fontSize: 11, color: LC.textMuted, alignSelf: 'flex-start', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LC.primary, alignSelf: 'center' },
});
