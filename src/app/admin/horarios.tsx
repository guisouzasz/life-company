import { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { LC } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { iconePorModalidade, nomeModalidade } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { AlunosHorarioModal } from '../../components/admin/alunos-horario-modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useHorarios } from '../../services/horarios/horarios.queries';
import { useBloquearHorario } from '../../services/horarios/horarios.mutations';
import type { HorarioAdmin } from '../../services/horarios/horarios.types';
import type { DiaSemana } from '../../services/agendamentos/agendamentos.types';
import { ApiError } from '../../services/http';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { getDiaSemanaKey } from '../../services/date';

const ORDEM: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];

export default function AdminHorarios() {
  const isDesktop = useIsDesktop();
  const horarios = useHorarios();
  const bloquear = useBloquearHorario();
  const [alvo, setAlvo] = useState<HorarioAdmin | null>(null);
  const [alunosDe, setAlunosDe] = useState<HorarioAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const map = new Map<DiaSemana, HorarioAdmin[]>();
    (horarios.data ?? []).forEach((h) => {
      if (!map.has(h.diaSemana)) map.set(h.diaSemana, []);
      map.get(h.diaSemana)!.push(h);
    });
    return ORDEM.filter((d) => map.has(d)).map((d) => [d, map.get(d)!] as const);
  }, [horarios.data]);

  const confirmarBloqueio = () => {
    if (!alvo) return;
    bloquear.mutate(alvo.id, {
      onSuccess: () => setAlvo(null),
      onError: (e) => {
        setAlvo(null);
        setErro(e instanceof ApiError ? e.message : 'Não foi possível bloquear.');
      },
    });
  };

  const modais = (
    <>
      <ConfirmModal
        visible={!!alvo}
        title="Bloquear horário"
        message={alvo ? `Bloquear ${nomeModalidade(alvo.modalidade.nome)} às ${alvo.horaInicio}? Ele deixará de aceitar agendamentos.` : ''}
        confirmLabel="Bloquear"
        cancelLabel="Voltar"
        destructive
        loading={bloquear.isPending}
        onConfirm={confirmarBloqueio}
        onCancel={() => setAlvo(null)}
      />
      <InfoModal visible={!!erro} title="Erro" message={erro ?? ''} onClose={() => setErro(null)} />
      <AlunosHorarioModal horario={alunosDe} onClose={() => setAlunosDe(null)} />
    </>
  );

  const estadoBase = horarios.isLoading ? (
    <Loading />
  ) : horarios.isError ? (
    <ErrorState onRetry={() => horarios.refetch()} />
  ) : grupos.length === 0 ? (
    <EmptyState icon="calendar-outline" title="Nenhum horário ativo" description="Os horários cadastrados aparecerão aqui." />
  ) : null;

  // ── Desktop: grade semanal (5 colunas) ─────────────────────────────
  if (isDesktop) {
    const diaAtual = getDiaSemanaKey(new Date());
    return (
      <View style={s.root}>
        <View style={s.deskHeader}>
          <Text style={s.title}>Horários</Text>
          <Text style={s.subtitle}>Grade semanal — clique numa aula para ver os alunos e cancelar</Text>
        </View>

        {estadoBase ?? (
          <ScrollView contentContainerStyle={s.deskScroll} showsVerticalScrollIndicator={false}>
            <View style={s.gradeRow}>
              {ORDEM.map((dia) => {
                const itens = grupos.find(([d]) => d === dia)?.[1] ?? [];
                const hoje = dia === diaAtual;
                return (
                  <View key={dia} style={s.gradeCol}>
                    <View style={[s.gradeColHead, hoje && s.gradeColHeadHoje]}>
                      <Text style={[s.gradeColTitle, hoje && s.gradeColTitleHoje]}>{DIAS_PT[dia]}</Text>
                      {hoje ? <Text style={s.hojeTag}>hoje</Text> : null}
                    </View>
                    {itens.length === 0 ? (
                      <Text style={s.gradeVazio}>Sem aulas</Text>
                    ) : (
                      itens.map((h) => {
                        const pct = h.capacidadeMaxima > 0 ? (h.agendados / h.capacidadeMaxima) * 100 : 0;
                        const lotado = h.agendados >= h.capacidadeMaxima;
                        return (
                          <Pressable key={h.id} accessibilityRole="button" onPress={() => setAlunosDe(h)} style={({ pressed }) => [pressed && s.pressed]}>
                            <Card style={s.slotCard} padding={12}>
                              <View style={s.slotTop}>
                                <Text style={s.slotHora}>{h.horaInicio}</Text>
                                <Pressable
                                  style={s.slotBlock}
                                  onPress={(e) => {
                                    e?.stopPropagation?.();
                                    setAlvo(h);
                                  }}
                                  hitSlop={6}
                                >
                                  <Icon name="lock-closed-outline" size={14} color={LC.danger} />
                                </Pressable>
                              </View>
                              <Text style={s.slotModalidade} numberOfLines={1}>{nomeModalidade(h.modalidade.nome)}</Text>
                              <View style={s.slotTrack}>
                                <View style={[s.slotFill, { width: `${pct}%` }, lotado && { backgroundColor: LC.danger }]} />
                              </View>
                              <Text style={s.slotVagas}>{h.agendados}/{h.capacidadeMaxima} agendados</Text>
                            </Card>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                );
              })}
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
        {modais}
      </View>
    );
  }

  // ── Mobile: lista agrupada (layout atual) + toque abre alunos ──────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Horários</Text>
        <Text style={s.subtitle}>Toque numa aula para ver os alunos</Text>
      </View>

      {estadoBase ?? (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {grupos.map(([dia, itens]) => (
            <View key={dia} style={s.group}>
              <Text style={s.groupTitle}>{DIAS_PT[dia]}</Text>
              {itens.map((h) => (
                <Pressable key={h.id} accessibilityRole="button" onPress={() => setAlunosDe(h)} style={({ pressed }) => [pressed && s.pressed]}>
                  <Card style={s.card} padding={14}>
                    <View style={s.iconWrap}>
                      <Icon name={iconePorModalidade(h.modalidade.nome)} size={18} color={LC.primary} />
                    </View>
                    <View style={s.info}>
                      <Text style={s.modalidade}>{nomeModalidade(h.modalidade.nome)}</Text>
                      <Text style={s.meta}>
                        {h.horaInicio} - {h.horaFim} • {h.agendados}/{h.capacidadeMaxima} ocupação
                      </Text>
                    </View>
                    <Pressable
                      style={s.blockBtn}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        setAlvo(h);
                      }}
                      hitSlop={6}
                    >
                      <Icon name="lock-closed-outline" size={18} color={LC.danger} />
                    </Pressable>
                  </Card>
                </Pressable>
              ))}
            </View>
          ))}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
      <TabBar isAdmin />
      {modais}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  deskHeader: { paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 16 },
  pressed: { opacity: 0.8 },

  // ── Grade desktop ───────────────────────────────────────────────
  deskScroll: { paddingBottom: 16 },
  gradeRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  gradeCol: { flex: 1, gap: 8 },
  gradeColHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: LC.radius.md, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border,
  },
  gradeColHeadHoje: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  gradeColTitle: { fontSize: 13, fontWeight: '800', color: LC.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  gradeColTitleHoje: { color: LC.primary },
  hojeTag: { fontSize: 10, fontWeight: '700', color: LC.primary, backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 1, borderRadius: LC.radius.full },
  gradeVazio: { fontSize: 12, color: LC.textMuted, textAlign: 'center', paddingVertical: 12 },
  slotCard: { width: '100%' },
  slotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotHora: { fontSize: 15, fontWeight: '800', color: LC.textPrimary },
  slotBlock: { width: 26, height: 26, borderRadius: 13, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
  slotModalidade: { fontSize: 12, fontWeight: '600', color: LC.textSecondary, marginTop: 2 },
  slotTrack: { height: 5, borderRadius: 3, backgroundColor: LC.border, overflow: 'hidden', marginTop: 8 },
  slotFill: { height: '100%', borderRadius: 3, backgroundColor: LC.primary },
  slotVagas: { fontSize: 11, color: LC.textMuted, marginTop: 5 },

  // ── Lista mobile ────────────────────────────────────────────────
  group: { marginBottom: 10 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  modalidade: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  meta: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  blockBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
});
