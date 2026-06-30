import { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { LC } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { iconePorModalidade } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useHorarios } from '../../services/horarios/horarios.queries';
import { useBloquearHorario } from '../../services/horarios/horarios.mutations';
import type { HorarioAdmin } from '../../services/horarios/horarios.types';
import type { DiaSemana } from '../../services/agendamentos/agendamentos.types';
import { ApiError } from '../../services/http';

const ORDEM: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];

export default function AdminHorarios() {
  const horarios = useHorarios();
  const bloquear = useBloquearHorario();
  const [alvo, setAlvo] = useState<HorarioAdmin | null>(null);
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

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Horários</Text>
        <Text style={s.subtitle}>Grade de aulas ativas</Text>
      </View>

      {horarios.isLoading ? (
        <Loading />
      ) : horarios.isError ? (
        <ErrorState onRetry={() => horarios.refetch()} />
      ) : grupos.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nenhum horário ativo" description="Os horários cadastrados aparecerão aqui." />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {grupos.map(([dia, itens]) => (
            <View key={dia} style={s.group}>
              <Text style={s.groupTitle}>{DIAS_PT[dia]}</Text>
              {itens.map((h) => (
                <Card key={h.id} style={s.card} padding={14}>
                  <View style={s.iconWrap}>
                    <Icon name={iconePorModalidade(h.modalidade.nome)} size={18} color={LC.primary} />
                  </View>
                  <View style={s.info}>
                    <Text style={s.modalidade}>{h.modalidade.nome}</Text>
                    <Text style={s.meta}>
                      {h.horaInicio} - {h.horaFim} • {h.agendados}/{h.capacidadeMaxima} ocupação
                    </Text>
                  </View>
                  <Pressable style={s.blockBtn} onPress={() => setAlvo(h)} hitSlop={6}>
                    <Icon name="lock-closed-outline" size={18} color={LC.danger} />
                  </Pressable>
                </Card>
              ))}
            </View>
          ))}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
      <TabBar isAdmin />

      <ConfirmModal
        visible={!!alvo}
        title="Bloquear horário"
        message={alvo ? `Bloquear ${alvo.modalidade.nome} às ${alvo.horaInicio}? Ele deixará de aceitar agendamentos.` : ''}
        confirmLabel="Bloquear"
        cancelLabel="Voltar"
        destructive
        loading={bloquear.isPending}
        onConfirm={confirmarBloqueio}
        onCancel={() => setAlvo(null)}
      />
      <InfoModal visible={!!erro} title="Erro" message={erro ?? ''} onClose={() => setErro(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 16 },
  group: { marginBottom: 10 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  modalidade: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  meta: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  blockBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
});
