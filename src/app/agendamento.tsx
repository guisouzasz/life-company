import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useAuthStore } from '../store/auth';
import { api, ApiError } from '../services/api';
import { LC } from '../constants/theme';
import { TabBar } from '../components/tab-bar';
import { getProximosDiasUteis } from '../services/date';

export default function Agendamento() {
  const { accessToken } = useAuthStore();
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [modalSel, setModalSel] = useState<any>(null);
  const [diaSel, setDiaSel] = useState<any>(null);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [agendando, setAgendando] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<any>(null);
  const dias = getProximosDiasUteis(10);

  useEffect(() => {
    api.get('/modalidades', accessToken!)
      .then(data => { setModalidades(data); if (data.length) setModalSel(data[0]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalSel || !diaSel) return;
    setLoading(true);
    api.get(`/horarios/vagas?modalidadeId=${modalSel.id}&data=${diaSel.data}`, accessToken!)
      .then(data => setHorarios(data.filter((h: any) => h.diaSemana === diaSel.diaSemana)))
      .catch(() => setHorarios([]))
      .finally(() => setLoading(false));
  }, [modalSel, diaSel]);

  const agendar = async (horario: any) => {
    setAgendando(horario.id);
    try {
      await api.post('/agendamentos', { horarioId: horario.id, dataAula: diaSel.data }, accessToken!);
      setDetalhe(null);
      Alert.alert('✅ Agendado!', `${modalSel.nome} — ${diaSel.diaNome} ${diaSel.diaNum}/${diaSel.mesNome} às ${horario.horaInicio}`, [
        { text: 'Ver minhas aulas', onPress: () => router.push('/minhas-aulas') },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (e) {
      Alert.alert('Erro', String(e instanceof ApiError ? e.message : e));
    } finally { setAgendando(null); }
  };

  // Tela de detalhe
  if (detalhe) {
    const lotado = detalhe.vagas <= 0;
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={LC.primaryDark} />
        <View style={s.detalheHero}>
          <TouchableOpacity onPress={() => setDetalhe(null)} style={s.detalheBack}>
            <Text style={s.detalheBackText}>‹</Text>
          </TouchableOpacity>
          <View style={s.detalheHeroContent}>
            <View style={[s.vagasBadge, { backgroundColor: lotado ? LC.dangerBg : 'rgba(255,255,255,0.2)' }]}>
              <Text style={[s.vagasText, { color: lotado ? LC.danger : '#fff' }]}>
                {detalhe.vagas}/{detalhe.capacidadeMaxima} vaga{detalhe.vagas !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={s.detalheHora}>{detalhe.horaInicio} às {detalhe.horaFim}</Text>
            <Text style={s.detalheNome}>{modalSel?.nome}</Text>
          </View>
        </View>
        <ScrollView style={s.detalheBody}>
          {[
            { label: 'Professor', value: 'Lucas' },
            { label: 'Local', value: 'Studio Life Company' },
            { label: 'Vagas', value: `${detalhe.vagas} de ${detalhe.capacidadeMaxima} disponível${detalhe.vagas !== 1 ? 'eis' : ''}` },
            { label: 'Nível', value: 'Todos os níveis' },
            { label: 'Descrição', value: 'Aula dinâmica que combina força, resistência e condicionamento físico funcional.' },
          ].map(row => (
            <View key={row.label} style={s.detalheRow}>
              <Text style={s.detalheKey}>{row.label}</Text>
              <Text style={s.detalheVal}>{row.value}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={[s.agendarGrandeBtn, lotado && { backgroundColor: LC.border }]}
            onPress={() => !lotado && agendar(detalhe)}
            disabled={lotado || !!agendando}
          >
            {agendando === detalhe.id
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.agendarGrandeBtnText, lotado && { color: LC.textMuted }]}>
                  {lotado ? 'Horário lotado' : 'Agendar aula'}
                </Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <View style={s.header}>
        <Text style={s.headerTitle}>Agenda</Text>
        <TouchableOpacity style={s.calIcon}><Text>📅</Text></TouchableOpacity>
      </View>
      {/* Dias */}
      <View style={s.calHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.daysRow}>
          {dias.map(d => (
            <TouchableOpacity key={d.data} style={[s.dayBtn, diaSel?.data === d.data && s.dayBtnSel]} onPress={() => setDiaSel(d)}>
              <Text style={[s.dayNome, diaSel?.data === d.data && s.dayTextSel]}>{d.diaNome}</Text>
              <Text style={[s.dayNum, diaSel?.data === d.data && s.dayTextSel]}>{d.diaNum}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {/* Modalidades */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.modScroll} contentContainerStyle={s.modRow}>
        {modalidades.map(m => (
          <TouchableOpacity key={m.id} style={[s.modChip, modalSel?.id === m.id && s.modChipSel]} onPress={() => setModalSel(m)}>
            <Text style={[s.modText, modalSel?.id === m.id && s.modTextSel]}>
              {m.nome === 'Funcional' ? '🤸 ' : m.nome === 'Pilates' ? '🧘 ' : '🏋️ '}{m.nome}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Horários */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {!diaSel ? (
          <View style={s.emptyBox}><Text style={s.emptyText}>Selecione um dia para ver os horários</Text></View>
        ) : loading ? (
          <ActivityIndicator color={LC.primary} style={{ marginTop: 40 }} />
        ) : horarios.length === 0 ? (
          <View style={s.emptyBox}><Text style={s.emptyText}>Nenhum horário disponível</Text></View>
        ) : (
          horarios.map(h => {
            const lotado = h.vagas <= 0;
            return (
              <TouchableOpacity key={h.id} style={[s.horarioCard, lotado && s.horarioLotado]} onPress={() => setDetalhe(h)} activeOpacity={0.8}>
                <View style={s.horarioLeft}>
                  <View>
                    <Text style={[s.horarioHora, lotado && { color: LC.textMuted }]}>{h.horaInicio}</Text>
                    <Text style={s.horarioHoraFim}>até {h.horaFim}</Text>
                  </View>
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <Text style={[s.horarioNome, lotado && { color: LC.textMuted }]}>{modalSel?.nome}</Text>
                    <Text style={s.horarioProf}>Professor Lucas</Text>
                    <Text style={s.horarioLocal}>Studio Life Company</Text>
                  </View>
                </View>
                <View style={s.horarioRight}>
                  <View style={s.vagasRow}>
                    <Text style={s.vagasIcon}>👥</Text>
                    <Text style={[s.vagasCount, lotado && { color: LC.danger }]}>{h.agendados}/{h.capacidadeMaxima}</Text>
                  </View>
                  {!lotado && (
                    <TouchableOpacity style={s.agendarBtn} onPress={() => agendar(h)} disabled={!!agendando}>
                      {agendando === h.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.agendarBtnText}>Agendar</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      <TabBar />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: LC.bg },
  headerTitle: { fontSize: 22, fontWeight: '700', color: LC.textPrimary },
  calIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: LC.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: LC.border },
  calHeader: { backgroundColor: LC.bgCard, borderBottomWidth: 1, borderBottomColor: LC.border, paddingBottom: 12 },
  daysRow: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },
  dayBtn: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: LC.radius.md, minWidth: 52, borderWidth: 1.5, borderColor: 'transparent' },
  dayBtnSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  dayNome: { fontSize: 11, fontWeight: '600', color: LC.textSecondary, textTransform: 'capitalize', marginBottom: 3 },
  dayNum: { fontSize: 17, fontWeight: '700', color: LC.textPrimary },
  dayTextSel: { color: '#fff' },
  modScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: LC.border },
  modRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  modChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: LC.radius.full, backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border },
  modChipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  modText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  modTextSel: { color: LC.primary },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: LC.textMuted, fontSize: 14 },
  horarioCard: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...LC.shadow },
  horarioLotado: { backgroundColor: '#FEF2F2', opacity: 0.75 },
  horarioLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  horarioHora: { fontSize: 16, fontWeight: '700', color: LC.textPrimary },
  horarioHoraFim: { fontSize: 11, color: LC.textMuted },
  horarioNome: { fontSize: 14, fontWeight: '600', color: LC.textPrimary },
  horarioProf: { fontSize: 12, color: LC.textSecondary },
  horarioLocal: { fontSize: 11, color: LC.textMuted },
  horarioRight: { alignItems: 'flex-end', gap: 6 },
  vagasRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  vagasIcon: { fontSize: 12 },
  vagasCount: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },
  agendarBtn: { backgroundColor: LC.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: LC.radius.full },
  agendarBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  detalheHero: { height: 240, backgroundColor: LC.primaryDark, justifyContent: 'flex-end' },
  detalheBack: { position: 'absolute', top: 52, left: 20, zIndex: 1 },
  detalheBackText: { color: '#fff', fontSize: 28 },
  detalheHeroContent: { padding: 24 },
  vagasBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: LC.radius.full, marginBottom: 8 },
  vagasText: { fontSize: 13, fontWeight: '600' },
  detalheHora: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  detalheNome: { fontSize: 26, fontWeight: '700', color: '#fff' },
  detalheBody: { backgroundColor: LC.bgCard, flex: 1, padding: 24 },
  detalheRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: LC.border },
  detalheKey: { fontSize: 14, color: LC.textSecondary, fontWeight: '500' },
  detalheVal: { fontSize: 14, color: LC.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },
  agendarGrandeBtn: { backgroundColor: LC.primary, borderRadius: LC.radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 28, marginBottom: 20 },
  agendarGrandeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
