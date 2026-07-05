import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { corPorModalidade, iconePorModalidade, nomeModalidade } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon, type IconName } from '../../components/ui/icon';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { AlunosHorarioModal } from '../../components/admin/alunos-horario-modal';
import { HorarioFormModal } from '../../components/admin/horario-form-modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useHorariosAdmin } from '../../services/horarios/horarios.queries';
import { useExcluirHorario } from '../../services/horarios/horarios.mutations';
import { useModalidades } from '../../services/modalidades/modalidades.queries';
import type { HorarioAdmin } from '../../services/horarios/horarios.types';
import type { Modalidade } from '../../services/agendamentos/agendamentos.types';
import type { DiaSemana } from '../../services/agendamentos/agendamentos.types';
import { ApiError } from '../../services/http';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { getDiaSemanaKey } from '../../services/date';

const DIAS: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
const DIAS_CURTO: Record<string, string> = { SEGUNDA: 'Seg', TERCA: 'Ter', QUARTA: 'Qua', QUINTA: 'Qui', SEXTA: 'Sex' };

type Periodo = 'TODOS' | 'MANHA' | 'TARDE' | 'NOITE';
const PERIODOS: { key: Periodo; label: string; icon: IconName }[] = [
  { key: 'TODOS', label: 'Todos', icon: 'apps-outline' },
  { key: 'MANHA', label: 'Manhã', icon: 'sunny-outline' },
  { key: 'TARDE', label: 'Tarde', icon: 'partly-sunny-outline' },
  { key: 'NOITE', label: 'Noite', icon: 'moon-outline' },
];

/** Manhã 05:00–11:59 • Tarde 12:00–17:59 • Noite 18:00–23:00 (filtro visual). */
function periodoDe(horaInicio: string): Exclude<Periodo, 'TODOS'> {
  if (horaInicio < '12:00') return 'MANHA';
  if (horaInicio < '18:00') return 'TARDE';
  return 'NOITE';
}

function diaPadrao(): DiaSemana {
  const hoje = getDiaSemanaKey(new Date());
  return (DIAS as string[]).includes(hoje) ? (hoje as DiaSemana) : 'SEGUNDA';
}

export default function AdminHorarios() {
  const isDesktop = useIsDesktop();
  const horarios = useHorariosAdmin();
  const modalidades = useModalidades();
  const excluir = useExcluirHorario();

  const [modalidadeSel, setModalidadeSel] = useState<Modalidade | null>(null);
  const [diaSel, setDiaSel] = useState<DiaSemana>(diaPadrao());
  const [periodo, setPeriodo] = useState<Periodo>('TODOS');
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<HorarioAdmin | null>(null);
  const [excluindo, setExcluindo] = useState<HorarioAdmin | null>(null);
  const [alunosDe, setAlunosDe] = useState<HorarioAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const porModalidade = useMemo(() => {
    const map = new Map<string, HorarioAdmin[]>();
    (horarios.data ?? []).forEach((h) => {
      if (!map.has(h.modalidadeId)) map.set(h.modalidadeId, []);
      map.get(h.modalidadeId)!.push(h);
    });
    return map;
  }, [horarios.data]);

  const doDia = useMemo(() => {
    if (!modalidadeSel) return [];
    return (porModalidade.get(modalidadeSel.id) ?? [])
      .filter((h) => h.diaSemana === diaSel)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [porModalidade, modalidadeSel, diaSel]);

  const secoes = useMemo(() => {
    const grupos: { key: Exclude<Periodo, 'TODOS'>; label: string; icon: IconName; itens: HorarioAdmin[] }[] = [
      { key: 'MANHA', label: 'Manhã', icon: 'sunny-outline', itens: [] },
      { key: 'TARDE', label: 'Tarde', icon: 'partly-sunny-outline', itens: [] },
      { key: 'NOITE', label: 'Noite', icon: 'moon-outline', itens: [] },
    ];
    doDia.forEach((h) => grupos.find((g) => g.key === periodoDe(h.horaInicio))!.itens.push(h));
    return grupos.filter((g) => g.itens.length > 0 && (periodo === 'TODOS' || g.key === periodo));
  }, [doDia, periodo]);

  const confirmarExclusao = () => {
    if (!excluindo) return;
    excluir.mutate(excluindo.id, {
      onSuccess: () => setExcluindo(null),
      onError: (e) => {
        setExcluindo(null);
        setErro(e instanceof ApiError ? e.message : 'Não foi possível excluir.');
      },
    });
  };

  const modais = (
    <>
      <HorarioFormModal
        visible={formAberto || !!editando}
        horario={editando}
        modalidadeIdPadrao={modalidadeSel?.id}
        onClose={() => {
          setFormAberto(false);
          setEditando(null);
        }}
      />
      <ConfirmModal
        visible={!!excluindo}
        title="Excluir horário"
        message={
          excluindo
            ? `Tem certeza que deseja excluir ${nomeModalidade(excluindo.modalidade.nome)} de ${DIAS_CURTO[excluindo.diaSemana]} às ${excluindo.horaInicio}? As aulas já agendadas não são afetadas.`
            : ''
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        destructive
        loading={excluir.isPending}
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindo(null)}
      />
      <InfoModal visible={!!erro} title="Erro" message={erro ?? ''} onClose={() => setErro(null)} />
      <AlunosHorarioModal horario={alunosDe} onClose={() => setAlunosDe(null)} />
    </>
  );

  const estadoBase = horarios.isLoading || modalidades.isLoading ? (
    <Loading />
  ) : horarios.isError ? (
    <ErrorState onRetry={() => horarios.refetch()} />
  ) : null;

  // ── Nível 1: escolha da modalidade ─────────────────────────────────
  if (!modalidadeSel) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" />
        <View style={isDesktop ? s.deskHeader : s.header}>
          <Text style={s.title}>Horários</Text>
          <Text style={s.subtitle}>Escolha uma modalidade para gerenciar</Text>
        </View>

        {estadoBase ?? (
          <ScrollView contentContainerStyle={isDesktop ? s.deskScroll : s.scroll} showsVerticalScrollIndicator={false}>
            <View style={isDesktop ? s.modRowDesk : s.modCol}>
              {modalidades.data?.map((m) => {
                const cor = corPorModalidade(m.nome);
                const itens = porModalidade.get(m.id) ?? [];
                const ativos = itens.filter((h) => h.ativo).length;
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setModalidadeSel(m);
                      setPeriodo('TODOS');
                      setDiaSel(diaPadrao());
                    }}
                    style={({ pressed }) => [isDesktop ? s.modCardWrapDesk : null, pressed && s.pressed]}
                  >
                    <Card style={s.modCard} padding={18}>
                      <View style={[s.modIcon, { backgroundColor: cor + '1A' }]}>
                        <Icon name={iconePorModalidade(m.nome)} size={26} color={cor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.modNome}>{nomeModalidade(m.nome)}</Text>
                        <Text style={s.modMeta}>
                          {ativos} {ativos === 1 ? 'horário ativo' : 'horários ativos'}
                          {itens.length > ativos ? ` • ${itens.length - ativos} inativo${itens.length - ativos > 1 ? 's' : ''}` : ''}
                        </Text>
                      </View>
                      <Icon name="chevron-forward" size={18} color={LC.textMuted} />
                    </Card>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
        {!isDesktop && <TabBar isAdmin />}
        {modais}
      </View>
    );
  }

  // ── Nível 2: gestão da modalidade ──────────────────────────────────
  const cor = corPorModalidade(modalidadeSel.nome);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* Header com voltar + adicionar */}
      <View style={isDesktop ? s.deskHeader : s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} hitSlop={8} onPress={() => setModalidadeSel(null)}>
            <Icon name="arrow-back" size={20} color={LC.textPrimary} />
          </Pressable>
          <View style={[s.headerIcon, { backgroundColor: cor + '1A' }]}>
            <Icon name={iconePorModalidade(modalidadeSel.nome)} size={20} color={cor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{nomeModalidade(modalidadeSel.nome)}</Text>
            <Text style={s.subtitle}>{DIAS_CURTO[diaSel]} • toque numa aula para ver os alunos</Text>
          </View>
          {isDesktop ? (
            <Button
              title="Adicionar horário"
              size="sm"
              fullWidth={false}
              leftIcon={<Icon name="add" size={16} color="#fff" />}
              onPress={() => setFormAberto(true)}
            />
          ) : null}
        </View>
      </View>

      {estadoBase ?? (
        <ScrollView contentContainerStyle={isDesktop ? s.deskScroll : s.scroll} showsVerticalScrollIndicator={false}>
          {/* Filtro de dia */}
          <View style={s.filtros}>
            {DIAS.map((dia) => {
              const sel = diaSel === dia;
              return (
                <Pressable key={dia} style={[s.filtroChip, sel && s.filtroChipSel]} onPress={() => setDiaSel(dia)}>
                  <Text style={[s.filtroText, sel && s.filtroTextSel]}>{DIAS_CURTO[dia]}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Filtro de período */}
          <View style={s.filtros}>
            {PERIODOS.map((p) => {
              const sel = periodo === p.key;
              return (
                <Pressable key={p.key} style={[s.filtroChip, sel && s.filtroChipSel]} onPress={() => setPeriodo(p.key)}>
                  <Icon name={p.icon} size={14} color={sel ? LC.primary : LC.textMuted} />
                  <Text style={[s.filtroText, sel && s.filtroTextSel]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Seções por período */}
          {secoes.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="Nenhum horário aqui"
              description={`Sem horários de ${nomeModalidade(modalidadeSel.nome)} ${periodo === 'TODOS' ? '' : `à ${PERIODOS.find((p) => p.key === periodo)?.label.toLowerCase()} `}em ${DIAS_CURTO[diaSel]}. Use "Adicionar horário".`}
            />
          ) : (
            secoes.map((secao) => (
              <View key={secao.key} style={s.secao}>
                <View style={s.secaoHead}>
                  <Icon name={secao.icon} size={15} color={LC.textMuted} />
                  <Text style={s.secaoTitle}>{secao.label}</Text>
                  <Text style={s.secaoCount}>{secao.itens.length}</Text>
                </View>
                <View style={s.grid}>
                  {secao.itens.map((h) => {
                    const pct = h.capacidadeMaxima > 0 ? Math.min((h.agendados / h.capacidadeMaxima) * 100, 100) : 0;
                    const lotado = h.agendados >= h.capacidadeMaxima;
                    return (
                      <Pressable
                        key={h.id}
                        accessibilityRole="button"
                        onPress={() => setAlunosDe(h)}
                        style={({ pressed }) => [isDesktop ? s.cardWrapDesk : s.cardWrapMobile, pressed && s.pressed]}
                      >
                        <Card style={[s.slotCard, !h.ativo && s.slotInativo]} padding={14}>
                          <View style={s.slotTop}>
                            <Text style={s.slotHora}>{h.horaInicio} – {h.horaFim}</Text>
                            <Badge label={h.ativo ? 'Ativo' : 'Inativo'} variant={h.ativo ? 'success' : 'danger'} />
                          </View>
                          <View style={s.slotOcupacao}>
                            <Icon name="people-outline" size={14} color={LC.textSecondary} />
                            <Text style={s.slotOcupacaoText}>
                              {h.agendados}/{h.capacidadeMaxima} alunos
                            </Text>
                          </View>
                          <View style={s.slotTrack}>
                            <View style={[s.slotFill, { width: `${pct}%` }, lotado && { backgroundColor: LC.danger }]} />
                          </View>
                          <View style={s.slotAcoes}>
                            <Pressable
                              style={s.slotBtn}
                              hitSlop={4}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                setEditando(h);
                              }}
                            >
                              <Icon name="create-outline" size={15} color={LC.primary} />
                              <Text style={s.slotBtnText}>Editar</Text>
                            </Pressable>
                            <Pressable
                              style={s.slotBtnDanger}
                              hitSlop={4}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                setExcluindo(h);
                              }}
                            >
                              <Icon name="trash-outline" size={15} color={LC.danger} />
                            </Pressable>
                          </View>
                        </Card>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
          <View style={{ height: isDesktop ? 24 : 90 }} />
        </ScrollView>
      )}

      {/* FAB mobile */}
      {!isDesktop && (
        <Pressable style={s.fab} onPress={() => setFormAberto(true)}>
          <Icon name="add" size={26} color="#fff" />
        </Pressable>
      )}
      {!isDesktop && <TabBar isAdmin />}
      {modais}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  deskHeader: { paddingTop: 24, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingTop: 8 },
  deskScroll: { paddingBottom: 16 },
  pressed: { opacity: 0.85 },

  // ── Nível 1: modalidades ────────────────────────────────────────
  modCol: { gap: 12 },
  modRowDesk: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  modCardWrapDesk: { flexBasis: '32%', flexGrow: 1, minWidth: 260 },
  modCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  modNome: { fontSize: 17, fontWeight: '800', color: LC.textPrimary },
  modMeta: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },

  // ── Filtros ─────────────────────────────────────────────────────
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filtroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: LC.radius.full,
    backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border,
  },
  filtroChipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  filtroText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  filtroTextSel: { color: LC.primary, fontWeight: '700' },

  // ── Seções e cards ──────────────────────────────────────────────
  secao: { marginTop: 8, marginBottom: 6 },
  secaoHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 6 },
  secaoTitle: { fontSize: 13, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  secaoCount: {
    fontSize: 11, fontWeight: '700', color: LC.textSecondary, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, paddingHorizontal: 7, paddingVertical: 1, borderRadius: LC.radius.full,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardWrapDesk: { flexBasis: '23%', flexGrow: 1, minWidth: 200, maxWidth: 300 },
  cardWrapMobile: { flexBasis: '47%', flexGrow: 1 },
  slotCard: { width: '100%' },
  slotInativo: { opacity: 0.55 },
  slotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  slotHora: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  slotOcupacao: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  slotOcupacaoText: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },
  slotTrack: { height: 5, borderRadius: 3, backgroundColor: LC.border, overflow: 'hidden', marginTop: 6 },
  slotFill: { height: '100%', borderRadius: 3, backgroundColor: LC.primary },
  slotAcoes: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  slotBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: LC.radius.sm, backgroundColor: LC.primaryLight,
  },
  slotBtnText: { fontSize: 13, fontWeight: '700', color: LC.primary },
  slotBtnDanger: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: LC.dangerBg,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── FAB ─────────────────────────────────────────────────────────
  fab: {
    position: 'absolute', right: 20, bottom: 96, width: 56, height: 56, borderRadius: 28,
    backgroundColor: LC.primary, alignItems: 'center', justifyContent: 'center',
    ...LC.shadowStrong,
  },
});
