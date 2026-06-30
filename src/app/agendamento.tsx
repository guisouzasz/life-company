import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LC } from '../constants/theme';
import { STUDIO_NOME } from '../constants/app';
import { iconePorModalidade } from '../constants/assets';
import { TabBar } from '../components/tab-bar';
import { Icon } from '../components/ui/icon';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AppModal, InfoModal } from '../components/ui/modal';
import { Loading, EmptyState } from '../components/ui/states';
import { useModalidades } from '../services/modalidades/modalidades.queries';
import { useVagas } from '../services/horarios/horarios.queries';
import { useCriarAgendamento } from '../services/agendamentos/agendamentos.mutations';
import type { Modalidade } from '../services/agendamentos/agendamentos.types';
import type { HorarioVaga } from '../services/horarios/horarios.types';
import { getProximosDiasUteis } from '../services/date';
import { ApiError } from '../services/http';

type Dia = ReturnType<typeof getProximosDiasUteis>[number];

export default function Agendamento() {
  const dias = useMemo(() => getProximosDiasUteis(14), []);
  const modalidades = useModalidades();
  const [modalSel, setModalSel] = useState<Modalidade | null>(null);
  const [diaSel, setDiaSel] = useState<Dia>(dias[0]);
  const [detalhe, setDetalhe] = useState<HorarioVaga | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erroAg, setErroAg] = useState<string | null>(null);
  const criar = useCriarAgendamento();

  useEffect(() => {
    if (!modalSel && modalidades.data?.length) setModalSel(modalidades.data[0]);
  }, [modalidades.data, modalSel]);

  const vagas = useVagas(modalSel?.id, diaSel?.data);
  const horariosDoDia = (vagas.data ?? []).filter((h) => h.diaSemana === diaSel?.diaSemana);

  const agendar = (horario: HorarioVaga) => {
    criar.mutate(
      { horarioId: horario.id, dataAula: diaSel.data },
      {
        onSuccess: () => {
          setDetalhe(null);
          setSucesso(`${horario.modalidade.nome} • ${diaSel.diaNome} ${diaSel.diaNum} às ${horario.horaInicio}`);
        },
        onError: (e) => setErroAg(e instanceof ApiError ? e.message : 'Não foi possível agendar.'),
      },
    );
  };

  const feedbackModais = (
    <>
      <AppModal visible={!!sucesso} onClose={() => setSucesso(null)} title="Aula agendada!">
        <Text style={s.modalMsg}>{sucesso}</Text>
        <View style={s.modalActions}>
          <Button title="Fechar" variant="outline" onPress={() => setSucesso(null)} style={{ flex: 1 }} />
          <Button
            title="Minhas aulas"
            onPress={() => {
              setSucesso(null);
              router.push('/minhas-aulas');
            }}
            style={{ flex: 1 }}
          />
        </View>
      </AppModal>
      <InfoModal visible={!!erroAg} title="Não foi possível agendar" message={erroAg ?? ''} onClose={() => setErroAg(null)} />
    </>
  );

  // ── Detalhes da Aula ───────────────────────────────────────────────
  if (detalhe) {
    const lotado = detalhe.vagas <= 0;
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.detHero}>
          <Pressable style={s.detBack} onPress={() => setDetalhe(null)} hitSlop={8}>
            <Icon name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View style={s.detIconCircle}>
            <Icon name={iconePorModalidade(detalhe.modalidade.nome)} size={30} color="#fff" />
          </View>
        </LinearGradient>

        <View style={s.detSheet}>
          <View style={s.detTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.detHora}>
                {detalhe.horaInicio} às {detalhe.horaFim}
              </Text>
              <Text style={s.detModalidade}>{detalhe.modalidade.nome}</Text>
            </View>
            <Badge label={`${detalhe.vagas}/${detalhe.capacidadeMaxima} vaga${detalhe.vagas === 1 ? '' : 's'}`} variant={lotado ? 'danger' : 'primary'} />
          </View>

          <ScrollView style={s.detBody} showsVerticalScrollIndicator={false}>
            <DetRow label="Horário" value={`${detalhe.horaInicio} - ${detalhe.horaFim}`} />
            <DetRow label="Modalidade" value={detalhe.modalidade.nome} />
            <DetRow label="Local" value={STUDIO_NOME} />
            <DetRow label="Vagas" value={`${detalhe.vagas} de ${detalhe.capacidadeMaxima} ${detalhe.vagas === 1 ? 'disponível' : 'disponíveis'}`} last />
          </ScrollView>

          <Button
            title={lotado ? 'Horário lotado' : 'Agendar aula'}
            size="lg"
            disabled={lotado}
            loading={criar.isPending}
            onPress={() => agendar(detalhe)}
            style={s.detBtn}
          />
        </View>
        {feedbackModais}
      </View>
    );
  }

  // ── Agenda ─────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Agenda</Text>
        <Text style={s.subtitle}>Escolha um dia e reserve sua aula</Text>
      </View>

      {/* Dias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.daysRow}>
        {dias.map((d) => {
          const sel = diaSel?.data === d.data;
          return (
            <Pressable key={d.data} style={[s.dayBtn, sel && s.dayBtnSel]} onPress={() => setDiaSel(d)}>
              <Text style={[s.dayNome, sel && s.daySelText]}>{d.diaNome}</Text>
              <Text style={[s.dayNum, sel && s.daySelText]}>{d.diaNum}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Modalidades */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.modScroll} contentContainerStyle={s.modRow}>
        {modalidades.data?.map((m) => {
          const sel = modalSel?.id === m.id;
          return (
            <Pressable key={m.id} style={[s.modChip, sel && s.modChipSel]} onPress={() => setModalSel(m)}>
              <Icon name={iconePorModalidade(m.nome)} size={15} color={sel ? LC.primary : LC.textSecondary} />
              <Text style={[s.modText, sel && s.modTextSel]}>{m.nome}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Horários */}
      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {vagas.isLoading || modalidades.isLoading ? (
          <Loading />
        ) : horariosDoDia.length === 0 ? (
          <EmptyState icon="time-outline" title="Sem horários neste dia" description="Tente outro dia ou modalidade." />
        ) : (
          horariosDoDia.map((h) => {
            const lotado = h.vagas <= 0;
            return (
              <Pressable
                key={h.id}
                style={({ pressed }) => [s.slot, lotado && s.slotLotado, pressed && s.pressed]}
                onPress={() => setDetalhe(h)}
              >
                <View style={s.slotTime}>
                  <Text style={[s.slotHora, lotado && s.mutedText]}>{h.horaInicio}</Text>
                  <Text style={s.slotHoraFim}>{h.horaFim}</Text>
                </View>
                <View style={s.slotInfo}>
                  <Text style={[s.slotModalidade, lotado && s.mutedText]}>{h.modalidade.nome}</Text>
                  <View style={s.slotMetaRow}>
                    <Icon name="people-outline" size={13} color={lotado ? LC.danger : LC.textMuted} />
                    <Text style={[s.slotMeta, lotado && { color: LC.danger }]}>
                      {h.agendados}/{h.capacidadeMaxima}
                    </Text>
                    <Text style={s.slotStudio}>{STUDIO_NOME}</Text>
                  </View>
                </View>
                {lotado ? (
                  <Badge label="Lotada" variant="danger" />
                ) : (
                  <Button title="Agendar" size="sm" fullWidth={false} onPress={() => setDetalhe(h)} style={s.slotBtn} />
                )}
              </Pressable>
            );
          })
        )}
        <View style={{ height: 8 }} />
      </ScrollView>
      <TabBar />
      {feedbackModais}
    </View>
  );
}

function DetRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.detRow, !last && s.detRowBorder]}>
      <Text style={s.detKey}>{label}</Text>
      <Text style={s.detVal}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  daysRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  dayBtn: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: LC.radius.md, minWidth: 54, backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border },
  dayBtnSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  dayNome: { fontSize: 11, fontWeight: '700', color: LC.textSecondary, textTransform: 'capitalize', marginBottom: 4 },
  dayNum: { fontSize: 17, fontWeight: '800', color: LC.textPrimary },
  daySelText: { color: '#fff' },
  modScroll: { flexGrow: 0, marginTop: 6 },
  modRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  modChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: LC.radius.full, backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border },
  modChipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  modText: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
  modTextSel: { color: LC.primary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 6 },
  slot: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, borderWidth: 1, borderColor: LC.border, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, ...LC.shadow },
  slotLotado: { backgroundColor: '#FEF6F6', opacity: 0.85 },
  slotTime: { alignItems: 'center', minWidth: 52, borderRightWidth: 1, borderRightColor: LC.border, paddingRight: 12 },
  slotHora: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  slotHoraFim: { fontSize: 11, color: LC.textMuted, marginTop: 1 },
  slotInfo: { flex: 1 },
  slotModalidade: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  slotMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  slotMeta: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },
  slotStudio: { fontSize: 11, color: LC.textMuted, marginLeft: 4 },
  slotBtn: { paddingHorizontal: 16 },
  mutedText: { color: LC.textMuted },
  pressed: { opacity: 0.85 },
  // Detalhe
  detHero: { height: 200, paddingTop: 52, alignItems: 'center', justifyContent: 'center' },
  detBack: { position: 'absolute', top: 52, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  detIconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  detSheet: { flex: 1, backgroundColor: LC.bg, marginTop: -24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 24 },
  detTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  detHora: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  detModalidade: { fontSize: 15, color: LC.textSecondary, marginTop: 2 },
  detBody: { flex: 1, marginTop: 8 },
  detRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  detRowBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  detKey: { fontSize: 14, color: LC.textSecondary },
  detVal: { fontSize: 14, fontWeight: '700', color: LC.textPrimary, flexShrink: 1, textAlign: 'right' },
  detBtn: { marginVertical: 16 },
  modalMsg: { fontSize: 15, color: LC.textPrimary, marginBottom: 18, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 10 },
});
