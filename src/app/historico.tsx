import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../constants/theme';
import { iconePorModalidade, nomeModalidade } from '../constants/assets';
import { TabBar } from '../components/tab-bar';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Badge, type BadgeVariant } from '../components/ui/badge';
import { Loading, EmptyState, ErrorState } from '../components/ui/states';
import { useHistoricoPaginado } from '../services/agendamentos/agendamentos.queries';
import type { Agendamento } from '../services/agendamentos/agendamentos.types';
import { formatDate } from '../services/date';

/**
 * O selo de cada aula passada, pela regra do estúdio: não existe chamada —
 * aula marcada e não cancelada é presença (o histórico só traz dias que já
 * passaram). Falta só aparece se alguém registrou à mão.
 */
function badgeDoHistorico(ag: Agendamento): { label: string; variant: BadgeVariant } {
  if (ag.presenca?.compareceu === false || ag.status === 'FALTOU') return { label: 'Falta', variant: 'danger' };
  switch (ag.status) {
    case 'CONFIRMADO':
    case 'REALIZADO':
      return { label: ag.reposicao ? 'Presença · reposição' : 'Presença', variant: 'success' };
    case 'CANCELADO':
      // Dia fechado não foi cancelamento de ninguém: a academia não abriu.
      return ag.diaFechadoId
        ? { label: 'Academia fechada', variant: 'neutral' }
        : { label: 'Cancelada', variant: 'neutral' };
    default:
      return { label: ag.status, variant: 'neutral' };
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Historico() {
  const historico = useHistoricoPaginado();
  const aulas = useMemo(() => historico.data?.pages.flat() ?? [], [historico.data]);

  const grupos = useMemo(() => {
    const map = new Map<string, Agendamento[]>();
    aulas.forEach((ag) => {
      const chave = capitalize(formatDate(ag.dataAula, 'MMMM YYYY'));
      if (!map.has(chave)) map.set(chave, []);
      map.get(chave)!.push(ag);
    });
    return Array.from(map.entries());
  }, [aulas]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Histórico</Text>
        <Text style={s.subtitle}>Suas aulas anteriores</Text>
      </View>

      {historico.isLoading ? (
        <Loading />
      ) : historico.isError ? (
        <ErrorState onRetry={() => historico.refetch()} />
      ) : grupos.length === 0 ? (
        <EmptyState icon="time-outline" title="Nenhuma aula no histórico" description="Suas aulas realizadas aparecerão aqui." />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => historico.refetch()} colors={[LC.primary]} tintColor={LC.primary} />}
        >
          {grupos.map(([mes, itens]) => (
            <View key={mes} style={s.group}>
              <Text style={s.groupTitle}>{mes}</Text>
              {itens.map((ag) => {
                const badge = badgeDoHistorico(ag);
                return (
                  <Card key={ag.id} style={s.card} padding={14}>
                    <View style={s.iconWrap}>
                      <Icon name={iconePorModalidade(ag.horario.modalidade.nome)} size={18} color={LC.primary} />
                    </View>
                    <View style={s.info}>
                      <Text style={s.modalidade}>{nomeModalidade(ag.horario.modalidade.nome)}</Text>
                      <Text style={s.meta}>
                        {formatDate(ag.dataAula, 'DD/MM')} • {ag.horario.horaInicio}
                      </Text>
                    </View>
                    <Badge label={badge.label} variant={badge.variant} />
                  </Card>
                );
              })}
            </View>
          ))}
          {historico.hasNextPage ? (
            <Pressable
              style={({ pressed }) => [s.maisBtn, pressed && s.maisBtnPress]}
              onPress={() => historico.fetchNextPage()}
              disabled={historico.isFetchingNextPage}
              accessibilityRole="button"
            >
              <Text style={s.maisTexto}>
                {historico.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
              </Text>
            </Pressable>
          ) : null}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
      <TabBar />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { ...LC.coluna, padding: 16, paddingBottom: 16 },
  group: { marginBottom: 8 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  modalidade: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  meta: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  maisBtn: {
    alignItems: 'center', paddingVertical: 13, marginTop: 4,
    borderRadius: LC.radius.md, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border,
  },
  maisBtnPress: { opacity: 0.7 },
  maisTexto: { fontSize: 14, fontWeight: '700', color: LC.primary },
});
