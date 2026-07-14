import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../constants/theme';
import { nomeModalidade } from '../constants/assets';
import { Header } from '../components/ui/header';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Loading, EmptyState, ErrorState } from '../components/ui/states';
import { useMeusTreinos } from '../services/treinos/treinos.queries';
import { formatDate } from '../services/date';

/** Treinos montados pelo professor para o aluno logado (somente leitura). */
export default function MeusTreinos() {
  const treinos = useMeusTreinos();

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <Header title="Meus treinos" showBack />

      {treinos.isLoading ? (
        <Loading />
      ) : treinos.isError ? (
        <ErrorState onRetry={() => treinos.refetch()} />
      ) : !treinos.data || treinos.data.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          title="Nenhum treino ainda"
          description="Quando o professor montar seu treino, ele aparece aqui."
        />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {treinos.data.map((t) => (
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

              {t.exercicios.map((e, i) => (
                <View key={e.id} style={s.exLinha}>
                  <Text style={s.exOrdem}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.exNome}>{e.nome}</Text>
                    {e.observacao ? <Text style={s.exObs}>{e.observacao}</Text> : null}
                  </View>
                  <Text style={s.exDetalhe}>
                    {e.series}x{e.repeticoes}{e.carga ? ` • ${e.carga}` : ''}
                  </Text>
                </View>
              ))}

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
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  meta: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  exLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: LC.border },
  exOrdem: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border,
    textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '800', color: LC.textSecondary, overflow: 'hidden',
  },
  exNome: { fontSize: 14, fontWeight: '600', color: LC.textPrimary },
  exObs: { fontSize: 11, color: LC.textMuted, marginTop: 1 },
  exDetalhe: { fontSize: 13, fontWeight: '800', color: LC.primary },
  obsBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12,
    backgroundColor: LC.bg, borderRadius: LC.radius.md, padding: 10,
  },
  obsText: { flex: 1, fontSize: 12, color: LC.textSecondary, lineHeight: 17 },
});
