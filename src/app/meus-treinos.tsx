import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../constants/theme';
import { nomeModalidade } from '../constants/assets';
import { Header } from '../components/ui/header';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Loading, EmptyState, ErrorState } from '../components/ui/states';
import { useMeusTreinos, useMeuTreinoDia } from '../services/treinos/treinos.queries';
import { useMinhasCargas } from '../services/cargas/cargas.queries';
import { formatDate } from '../services/date';

/** 22.5 → "22,5" | 20 → "20" */
const kgFmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');

/** Treinos montados pelo professor para o aluno logado (somente leitura). */
export default function MeusTreinos() {
  const treinos = useMeusTreinos();
  const treinoDia = useMeuTreinoDia();
  const cargas = useMinhasCargas();
  const evolucaoDe = (nome: string) => (cargas.data ?? []).find((e) => e.exercicio === nome) ?? null;
  const temAlgo = (treinos.data?.length ?? 0) > 0 || (treinoDia.data?.length ?? 0) > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <Header title="Meus treinos" showBack />

      {treinos.isLoading || treinoDia.isLoading ? (
        <Loading />
      ) : treinos.isError ? (
        <ErrorState onRetry={() => treinos.refetch()} />
      ) : !temAlgo ? (
        <EmptyState
          icon="barbell-outline"
          title="Nenhum treino ainda"
          description="Quando o professor montar seu treino, ele aparece aqui."
        />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Treino do dia (Funcional): igual para todas as aulas de hoje */}
          {(treinoDia.data ?? []).map((td) => (
            <Card key={td.id} style={[s.card, s.cardHoje]} padding={16}>
              <View style={s.head}>
                <View style={[s.iconWrap, { backgroundColor: LC.primary }]}>
                  <Icon name="flame-outline" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.titulo}>Treino de hoje — {nomeModalidade(td.modalidade.nome)}</Text>
                  <Text style={s.meta}>Prof. {td.professor.nome.split(' ')[0]} • para todas as aulas de hoje</Text>
                </View>
              </View>
              <Text style={s.conteudoTexto}>{td.conteudo}</Text>
            </Card>
          ))}

          {(treinos.data ?? []).map((t) => (
            <Card key={t.id} style={s.card} padding={16}>
              <View style={s.head}>
                <View style={s.iconWrap}>
                  <Icon name="barbell-outline" size={20} color={LC.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.titulo}>{t.titulo}</Text>
                  <Text style={s.meta}>
                    {t.modalidade ? `${nomeModalidade(t.modalidade.nome)} • ` : ''}
                    Prof. {t.professor.nome.split(' ')[0]} • atualizado {formatDate(t.updatedAt, 'DD/MM/YYYY')}
                  </Text>
                </View>
              </View>

              {t.conteudo ? <Text style={s.conteudoTexto}>{t.conteudo}</Text> : null}

              {t.exercicios.map((e, i) => {
                const evo = evolucaoDe(e.nome);
                const grupoAnterior = i > 0 ? t.exercicios[i - 1].grupo : undefined;
                const mostraGrupo = !!e.grupo && e.grupo !== grupoAnterior;
                return (
                  <View key={e.id}>
                    {mostraGrupo ? <Text style={s.grupoHeader}>{e.grupo}</Text> : null}
                  <View style={s.exLinha}>
                    <Text style={s.exOrdem}>{i + 1}</Text>
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
                            Sua carga: {kgFmt(evo.atual)} kg
                            {evo.evolucaoKg > 0 ? ` • +${kgFmt(evo.evolucaoKg)} kg desde o início` : ''}
                          </Text>
                        </View>
                      ) : null}
                      {e.observacao ? <Text style={s.exObs}>{e.observacao}</Text> : null}
                    </View>
                    <Text style={s.exDetalhe}>
                      {e.series}x{e.repeticoes}{e.carga ? ` • ${e.carga}` : ''}
                    </Text>
                  </View>
                  </View>
                );
              })}

              {t.observacoes ? (
                <View style={s.obsBox}>
                  <Icon name="information-circle-outline" size={14} color={LC.textSecondary} />
                  <Text style={s.obsText}>{t.observacoes}</Text>
                </View>
              ) : null}
            </Card>
          ))}
          <View style={{ height: 16 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  card: { marginBottom: 12 },
  cardHoje: { borderWidth: 1.5, borderColor: LC.primary },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  meta: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  conteudoTexto: { fontSize: 14, color: LC.textPrimary, lineHeight: 22, paddingTop: 6, borderTopWidth: 1, borderTopColor: LC.border },
  exLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: LC.border },
  exOrdem: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border,
    textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '800', color: LC.textSecondary, overflow: 'hidden',
  },
  grupoHeader: {
    fontSize: 12, fontWeight: '800', color: LC.primary, textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 12, marginBottom: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: LC.border,
  },
  exNome: { fontSize: 14, fontWeight: '600', color: LC.textPrimary },
  exEvoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  exEvoText: { flex: 1, fontSize: 11, fontWeight: '700', color: LC.textSecondary },
  exObs: { fontSize: 11, color: LC.textMuted, marginTop: 1 },
  exDetalhe: { fontSize: 13, fontWeight: '800', color: LC.primary },
  obsBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12,
    backgroundColor: LC.bg, borderRadius: LC.radius.md, padding: 10,
  },
  obsText: { flex: 1, fontSize: 12, color: LC.textSecondary, lineHeight: 17 },
});
