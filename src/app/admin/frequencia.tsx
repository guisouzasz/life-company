import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Avatar } from '../../components/ui/avatar';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useRelatorioFrequencia } from '../../services/relatorios/relatorios.queries';
import type { AlunoFrequencia } from '../../services/relatorios/relatorios.types';

function resumo(aluno: AlunoFrequencia) {
  const presencas = aluno.agendamentos.filter((a) => a.presenca?.compareceu).length;
  const faltas = aluno.agendamentos.filter((a) => a.presenca && !a.presenca.compareceu).length;
  const avaliadas = presencas + faltas;
  const pct = avaliadas > 0 ? Math.round((presencas / avaliadas) * 100) : null;
  return { presencas, faltas, pct };
}

export default function AdminFrequencia() {
  const frequencia = useRelatorioFrequencia();

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Frequência</Text>
        <Text style={s.subtitle}>Presenças e faltas por aluno</Text>
      </View>

      {frequencia.isLoading ? (
        <Loading />
      ) : frequencia.isError ? (
        <ErrorState onRetry={() => frequencia.refetch()} />
      ) : !frequencia.data || frequencia.data.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="Sem dados de frequência" description="Os registros de presença aparecerão aqui." />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {frequencia.data.map((aluno) => {
            const { presencas, faltas, pct } = resumo(aluno);
            const plano = aluno.usuarioPlanos?.[0];
            return (
              <Card key={aluno.id} style={s.card} padding={16}>
                <View style={s.top}>
                  <Avatar nome={aluno.nome} size={44} />
                  <View style={s.info}>
                    <Text style={s.nome}>{aluno.nome}</Text>
                    {plano ? (
                      <Text style={s.plano}>
                        {plano.plano ? `${plano.plano.nome} • ` : ''}Todas as modalidades
                      </Text>
                    ) : null}
                  </View>
                  <Text style={s.pct}>{pct != null ? `${pct}%` : '—'}</Text>
                </View>

                {pct != null ? (
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${pct}%` }]} />
                  </View>
                ) : null}

                <View style={s.statsRow}>
                  <View style={s.statItem}>
                    <View style={[s.dot, { backgroundColor: LC.success }]} />
                    <Text style={s.statText}>{presencas} presenças</Text>
                  </View>
                  <View style={s.statItem}>
                    <View style={[s.dot, { backgroundColor: LC.danger }]} />
                    <Text style={s.statText}>{faltas} faltas</Text>
                  </View>
                </View>
              </Card>
            );
          })}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
      <TabBar isAdmin />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 16 },
  card: { marginBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  plano: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  pct: { fontSize: 20, fontWeight: '800', color: LC.primary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: LC.border, overflow: 'hidden', marginTop: 14 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: LC.primary },
  statsRow: { flexDirection: 'row', gap: 18, marginTop: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statText: { fontSize: 12, color: LC.textSecondary, fontWeight: '600' },
});
