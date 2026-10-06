import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Avatar } from '../../components/ui/avatar';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useRelatorioFrequencia } from '../../services/relatorios/relatorios.queries';
import type { AlunoFrequencia } from '../../services/relatorios/relatorios.types';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { formatDate } from '../../services/date';

/**
 * Os números já vêm calculados da API, pela regra do estúdio: aula marcada e
 * não cancelada conta como dada quando termina — não existe chamada. Antes a
 * tela contava a chamada, que ninguém fazia, e todo mundo aparecia com zero.
 */
function resumo(aluno: AlunoFrequencia) {
  return {
    presencas: aluno.presencas ?? 0,
    canceladas: aluno.canceladas ?? 0,
    faltas: aluno.faltas ?? 0,
    reposicoes: aluno.reposicoes ?? 0,
    pct: aluno.assiduidade ?? null,
    ultima: aluno.ultimaAula ? formatDate(aluno.ultimaAula, 'DD/MM') : null,
  };
}

export default function AdminFrequencia() {
  const frequencia = useRelatorioFrequencia();
  const isDesktop = useIsDesktop();

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={isDesktop ? s.deskHeader : s.header}>
        <Text style={s.title}>Frequência</Text>
        <Text style={s.subtitle}>
          Últimos 30 dias. Aula marcada e não cancelada no prazo conta como presença.
        </Text>
      </View>

      {frequencia.isLoading ? (
        <Loading />
      ) : frequencia.isError ? (
        <ErrorState onRetry={() => frequencia.refetch()} />
      ) : !frequencia.data || frequencia.data.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="Sem alunos ativos" description="A frequência de cada aluno aparece aqui." />
      ) : isDesktop ? (
        // ── Desktop: tabela ──────────────────────────────────────────
        <ScrollView contentContainerStyle={s.deskScroll} showsVerticalScrollIndicator={false}>
          <Card style={s.tabela} padding={0}>
            <View style={[s.tRow, s.tHead]}>
              <Text style={[s.tCol, s.tColAluno, s.tHeadText]}>Aluno</Text>
              <Text style={[s.tCol, s.tColPlano, s.tHeadText]}>Plano</Text>
              <Text style={[s.tCol, s.tColNum, s.tHeadText]}>Aulas feitas</Text>
              <Text style={[s.tCol, s.tColNum, s.tHeadText]}>Canceladas</Text>
              <Text style={[s.tCol, s.tColNum, s.tHeadText]}>Última</Text>
              <Text style={[s.tCol, s.tColPct, s.tHeadText]}>Assiduidade</Text>
            </View>
            {frequencia.data.map((aluno) => {
              const { presencas, canceladas, pct, ultima } = resumo(aluno);
              const plano = aluno.usuarioPlanos?.[0];
              return (
                <View key={aluno.id} style={s.tRow}>
                  <View style={[s.tCol, s.tColAluno, s.tAlunoWrap]}>
                    <Avatar nome={aluno.nome} size={34} />
                    <Text style={s.tNome} numberOfLines={1}>{aluno.nome}</Text>
                  </View>
                  <Text style={[s.tCol, s.tColPlano, s.tTexto]} numberOfLines={1}>
                    {plano?.plano?.nome ?? '—'}
                  </Text>
                  <Text style={[s.tCol, s.tColNum, s.tTexto, { color: LC.success, fontWeight: '700' }]}>{presencas}</Text>
                  <Text style={[s.tCol, s.tColNum, s.tTexto, canceladas > 0 && { color: LC.warningFg, fontWeight: '700' }]}>{canceladas}</Text>
                  <Text style={[s.tCol, s.tColNum, s.tTexto]}>{ultima ?? '—'}</Text>
                  <View style={[s.tCol, s.tColPct, s.tPctWrap]}>
                    <View style={s.tTrack}>
                      <View style={[s.tFill, { width: `${pct ?? 0}%` }]} />
                    </View>
                    <Text style={s.tPct}>{pct != null ? `${pct}%` : '—'}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
          <View style={{ height: 24 }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {frequencia.data.map((aluno) => {
            const { presencas, canceladas, faltas, reposicoes, pct, ultima } = resumo(aluno);
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
                    <Text style={s.statText}>
                      {presencas} {presencas === 1 ? 'aula feita' : 'aulas feitas'}
                      {reposicoes > 0 ? ` (${reposicoes} de reposição)` : ''}
                    </Text>
                  </View>
                  <View style={s.statItem}>
                    <View style={[s.dot, { backgroundColor: LC.warning }]} />
                    <Text style={s.statText}>
                      {canceladas} {canceladas === 1 ? 'cancelada' : 'canceladas'} no prazo
                    </Text>
                  </View>
                  {faltas > 0 ? (
                    <View style={s.statItem}>
                      <View style={[s.dot, { backgroundColor: LC.danger }]} />
                      <Text style={s.statText}>{faltas} {faltas === 1 ? 'falta' : 'faltas'}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.ultima}>{ultima ? `Última aula: ${ultima}` : 'Nenhuma aula nos últimos 30 dias'}</Text>
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
  deskHeader: { paddingTop: 24, paddingBottom: 16 },
  deskScroll: { paddingBottom: 16 },

  // ── Tabela desktop ──────────────────────────────────────────────
  tabela: { overflow: 'hidden' },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: LC.border },
  tHead: { backgroundColor: LC.bg, paddingVertical: 12 },
  tHeadText: { fontSize: 12, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tCol: { paddingHorizontal: 4 },
  tColAluno: { flex: 3 },
  tColPlano: { flex: 2 },
  tColNum: { flex: 1.2, textAlign: 'center' as const },
  tColPct: { flex: 3 },
  tAlunoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary, flex: 1 },
  tTexto: { fontSize: 13, color: LC.textSecondary },
  tPctWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: LC.border, overflow: 'hidden' },
  tFill: { height: '100%', borderRadius: 3, backgroundColor: LC.primary },
  tPct: { width: 44, fontSize: 13, fontWeight: '800', color: LC.primary, textAlign: 'right' },
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
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 6, marginTop: 12 },
  ultima: { fontSize: 12, color: LC.textMuted, marginTop: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statText: { fontSize: 12, color: LC.textSecondary, fontWeight: '600' },
});
