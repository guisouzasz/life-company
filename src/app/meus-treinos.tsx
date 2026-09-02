import { useMemo } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../constants/theme';
import { nomeCurto } from '../services/nome';
import { nomeModalidade } from '../constants/assets';
import { TabBar } from '../components/tab-bar';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Badge } from '../components/ui/badge';
import { Loading, EmptyState, ErrorState } from '../components/ui/states';
import { useMeusTreinos, useMeuTreinoDia } from '../services/treinos/treinos.queries';
import { useMinhasCargas } from '../services/cargas/cargas.queries';
import type { ExercicioTreino, Treino } from '../services/treinos/treinos.types';
import { formatDate } from '../services/date';

/** 22.5 → "22,5" | 20 → "20" */
const kgFmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');

/**
 * Exercícios na ordem que o professor montou, quebrados por grupo muscular
 * (o backend já devolve ordenado por `ordem`).
 */
function porGrupo(exercicios: ExercicioTreino[]): { grupo: string; itens: ExercicioTreino[] }[] {
  const blocos: { grupo: string; itens: ExercicioTreino[] }[] = [];
  for (const e of exercicios) {
    const grupo = e.grupo ?? '';
    let bloco = blocos.find((b) => b.grupo === grupo);
    if (!bloco) {
      bloco = { grupo, itens: [] };
      blocos.push(bloco);
    }
    bloco.itens.push(e);
  }
  return blocos;
}

/**
 * Treinos do aluno logado: o treino de hoje (Funcional/Pilates, que o professor
 * escreve para a aula do dia) e as fichas montadas para ele — musculação com
 * séries/repetições/carga e a evolução de peso já registrada.
 */
export default function MeusTreinos() {
  const treinos = useMeusTreinos();
  const treinoDia = useMeuTreinoDia();
  const cargas = useMinhasCargas();

  const carregando = treinos.isLoading || treinoDia.isLoading;
  const recarregar = () => {
    treinos.refetch();
    treinoDia.refetch();
    cargas.refetch();
  };

  // Ficha ativa primeiro; as concluídas ficam no fim como histórico.
  const { ativos, concluidos } = useMemo(() => {
    const lista = treinos.data ?? [];
    return {
      ativos: lista.filter((t) => !t.concluido),
      concluidos: lista.filter((t) => t.concluido),
    };
  }, [treinos.data]);

  const evolucaoDe = (nome: string) => (cargas.data ?? []).find((e) => e.exercicio === nome) ?? null;

  const renderTreino = (t: Treino) => (
    <Card key={t.id} style={[s.card, t.concluido && s.cardConcluido]} padding={16}>
      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitulo}>{t.titulo}</Text>
          <Text style={s.cardMeta}>
            {t.modalidade ? `${nomeModalidade(t.modalidade.nome)} • ` : ''}
            com {nomeCurto(t.professor.nome)}
          </Text>
        </View>
        {t.concluido ? <Badge label="Concluída" variant="neutral" /> : <Badge label="Ativa" variant="success" />}
      </View>

      {t.frequencia || t.vencimento ? (
        <View style={s.metaRow}>
          {t.frequencia ? (
            <View style={s.metaItem}>
              <Icon name="repeat-outline" size={14} color={LC.textSecondary} />
              <Text style={s.metaText}>{t.frequencia}</Text>
            </View>
          ) : null}
          {t.vencimento ? (
            <View style={s.metaItem}>
              <Icon name="calendar-outline" size={14} color={LC.textSecondary} />
              <Text style={s.metaText}>vale até {formatDate(t.vencimento, 'DD/MM/YYYY')}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Funcional/Pilates: o professor escreve o treino em texto livre */}
      {t.conteudo ? <Text style={s.conteudo}>{t.conteudo}</Text> : null}

      {/* Musculação: exercícios agrupados por músculo, como na ficha */}
      {porGrupo(t.exercicios).map((bloco) => (
        <View key={bloco.grupo || 'sem-grupo'}>
          {bloco.grupo ? <Text style={s.grupoHeader}>{bloco.grupo}</Text> : null}
          {bloco.itens.map((e) => {
            const evo = evolucaoDe(e.nome);
            return (
              <View key={e.id} style={s.exLinha}>
                <View style={{ flex: 1 }}>
                  <Text style={s.exNome}>{e.nome}</Text>
                  {evo ? (
                    <View style={s.exEvoRow}>
                      <Icon
                        name={evo.evolucaoKg > 0 ? 'trending-up' : evo.evolucaoKg < 0 ? 'trending-down' : 'remove'}
                        size={12}
                        color={evo.evolucaoKg > 0 ? LC.success : evo.evolucaoKg < 0 ? LC.danger : LC.textMuted}
                      />
                      <Text style={s.exEvoText}>
                        {kgFmt(evo.atual)} kg
                        {evo.evolucaoKg !== 0 ? ` (${evo.evolucaoKg > 0 ? '+' : ''}${kgFmt(evo.evolucaoKg)})` : ''}
                      </Text>
                    </View>
                  ) : null}
                  {e.observacao ? <Text style={s.exObs}>{e.observacao}</Text> : null}
                </View>
                <Text style={s.exDetalhe}>
                  {e.series}x{e.repeticoes}
                  {e.carga ? ` • ${e.carga}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      {t.observacoes ? <Text style={s.obs}>{t.observacoes}</Text> : null}
    </Card>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Meus treinos</Text>
        <Text style={s.subtitle}>O que seu professor montou para você</Text>
      </View>

      {carregando ? (
        <Loading />
      ) : treinos.isError ? (
        <ErrorState onRetry={recarregar} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={recarregar} colors={[LC.primary]} tintColor={LC.primary} />
          }
        >
          {/* Treino de hoje: só aparece quando o aluno tem aula hoje e o
              professor já escreveu o treino da turma. */}
          {(treinoDia.data ?? []).map((td) => (
            <Card key={td.id} style={[s.card, s.cardHoje]} padding={16}>
              <View style={s.hojeHead}>
                <Icon name="today-outline" size={18} color={LC.primary} />
                <Text style={s.hojeTitulo}>Treino de hoje</Text>
                <Badge label={nomeModalidade(td.modalidade.nome)} variant="primary" />
              </View>
              <Text style={s.conteudo}>{td.conteudo}</Text>
              <Text style={s.cardMeta}>com {nomeCurto(td.professor.nome)}</Text>
            </Card>
          ))}

          {ativos.map(renderTreino)}

          {concluidos.length > 0 ? (
            <>
              <Text style={s.sectionTitle}>Fichas anteriores</Text>
              {concluidos.map(renderTreino)}
            </>
          ) : null}

          {ativos.length === 0 && concluidos.length === 0 && (treinoDia.data ?? []).length === 0 ? (
            <EmptyState
              icon="barbell-outline"
              title="Nenhum treino por aqui ainda"
              description="Quando seu professor montar sua ficha, ela aparece nesta tela."
            />
          ) : null}

          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TabBar />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  scroll: { ...LC.coluna, padding: 16, paddingTop: 8 },

  card: { marginBottom: 12 },
  cardConcluido: { opacity: 0.7 },
  cardHoje: { borderWidth: 1.5, borderColor: LC.primary },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  cardTitulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  cardMeta: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },

  hojeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hojeTitulo: { flex: 1, fontSize: 15, fontWeight: '800', color: LC.primary },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },

  conteudo: { fontSize: 14, color: LC.textPrimary, lineHeight: 22, paddingTop: 6 },

  grupoHeader: {
    fontSize: 12, fontWeight: '800', color: LC.primary, textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 12, marginBottom: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: LC.border,
  },
  exLinha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: LC.border,
  },
  exNome: { fontSize: 14, fontWeight: '600', color: LC.textPrimary },
  exObs: { fontSize: 11, color: LC.textMuted, marginTop: 2, fontStyle: 'italic' },
  exEvoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  exEvoText: { fontSize: 11, fontWeight: '700', color: LC.textSecondary },
  exDetalhe: { fontSize: 13, fontWeight: '700', color: LC.primary },

  obs: { fontSize: 12, color: LC.textMuted, marginTop: 10, fontStyle: 'italic' },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 10, marginBottom: 10,
  },
});
