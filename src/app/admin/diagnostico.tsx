import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Button } from '../../components/ui/button';
import { EmptyState, ErrorState } from '../../components/ui/states';
import { EsqueletoLista } from '../../components/ui/esqueleto';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { ApiError } from '../../services/http';
import { useVarreduraDeHorariosFixos, useRestaurarHorariosFixos } from '../../services/diagnostico/diagnostico.queries';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { formatDate } from '../../services/date';
import type { Achado, ItemDoAchado } from '../../services/diagnostico/diagnostico.types';

/**
 * Conferência dos horários fixos — só para o dono.
 *
 * A mesma varredura do `npm run auditoria:fixos`, para quem não vai abrir um
 * terminal. Ela existe porque o problema que ela acha não aparece sozinho: um
 * aluno ocupando vaga numa turma de onde saiu só se descobre abrindo cadastro
 * por cadastro, e ninguém faz isso com trinta alunos.
 *
 * Não roda ao abrir a tela, de propósito: a conferência varre todos os fixos e
 * todas as aulas de duas semanas. É para apertar quando se está investigando,
 * não a cada vez que alguém passa pela aba.
 *
 * Quase tudo aqui é só leitura: cada achado diz o que fazer, e o conserto
 * acontece na tela do aluno, onde a dona vê o contexto todo.
 *
 * A exceção é devolver os horários fixos desligados. Ela existe porque esse
 * estrago não tem outra saída pela tela — a combinação está apagada, então
 * nenhuma aula nova nasce e não há nada em que tocar para trazê-la de volta.
 * Vem com confirmação e só mexe em quem está marcado como treinando.
 */

function ItemDoAchadoLinha({ item }: { item: ItemDoAchado }) {
  /*
    Quando o achado é sobre uma pessoa, o toque leva ao cadastro dela.
    Sem isso a lista vira uma lição de casa: ler trinta nomes numa tela,
    decorar, e ir procurar um por um na busca da aba Alunos.
  */
  if (!item.usuarioId) {
    return (
      <View style={s.item}>
        <Text style={s.itemTexto}>{item.texto}</Text>
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [s.item, s.itemTocavel, pressed && s.itemPressed]}
      onPress={() => router.push(`/admin/alunos?busca=${encodeURIComponent(item.texto.split(' — ')[0])}`)}
      accessibilityLabel={`Abrir o cadastro de ${item.texto.split(' — ')[0]}`}
    >
      <Text style={[s.itemTexto, s.itemTextoLink]}>{item.texto}</Text>
      <Icon name="chevron-forward" size={15} color={LC.textMuted} />
    </Pressable>
  );
}

function CartaoDoAchado({ achado, onAgir }: { achado: Achado; onAgir?: () => void }) {
  const grave = achado.gravidade === 'grave';
  return (
    <Card style={[s.cartao, grave ? s.cartaoGrave : s.cartaoAtencao]} padding={0}>
      <View style={s.cartaoTopo}>
        <Icon
          name={grave ? 'alert-circle' : 'information-circle-outline'}
          size={18}
          color={grave ? LC.danger : LC.warningFg}
        />
        <Text style={[s.cartaoTitulo, grave && { color: LC.dangerFg }]}>{achado.titulo}</Text>
      </View>
      <View style={s.itens}>
        {achado.itens.map((i, n) => (
          <ItemDoAchadoLinha key={`${achado.tipo}-${n}`} item={i} />
        ))}
      </View>
      <View style={s.oQueFazer}>
        <Icon name="arrow-forward" size={13} color={LC.textSecondary} />
        <Text style={s.oQueFazerTexto}>{achado.oQueFazer}</Text>
      </View>
      {achado.acao && onAgir ? (
        <View style={s.acaoBox}>
          <Button title="Devolver os horários fixos" onPress={onAgir} />
        </View>
      ) : null}
    </Card>
  );
}

export default function AdminDiagnostico() {
  const isDesktop = useIsDesktop();
  /** A varredura só dispara quando o dono pede. */
  const [pediu, setPediu] = useState(false);
  const varredura = useVarreduraDeHorariosFixos(pediu);
  const restaurar = useRestaurarHorariosFixos();
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const r = varredura.data;

  const conteudo = (
    <>
      <View style={s.cabecalho}>
        <Text style={s.titulo}>Conferência dos horários fixos</Text>
        <Text style={s.subtitulo}>
          Procura aluno ocupando vaga onde não deveria, horário fixo que não está gerando aula e
          turma acima da capacidade. A conferência em si não muda nada — quando dá para consertar
          de uma vez, aparece um botão, e aí é você quem decide.
        </Text>
      </View>

      <Button
        title={varredura.isFetching ? 'Conferindo…' : pediu ? 'Conferir de novo' : 'Rodar a conferência'}
        onPress={() => (pediu ? varredura.refetch() : setPediu(true))}
        loading={varredura.isFetching}
        leftIcon={<Icon name="search" size={17} color="#fff" />}
        style={s.botao}
      />

      {!pediu ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="Ainda não conferi nada"
          description="Aperte o botão acima. Leva alguns segundos e não altera nada no estúdio."
        />
      ) : varredura.isLoading ? (
        <EsqueletoLista quantos={4} />
      ) : varredura.isError ? (
        <ErrorState
          message="Não consegui conferir. Tente de novo — se continuar, pode ser que esta conta não seja a de dono."
          onRetry={() => varredura.refetch()}
        />
      ) : r ? (
        <>
          <View style={s.resumo}>
            <Text style={s.resumoTexto}>
              {r.resumo.fixosAtivos} horário(s) fixo(s) ativo(s) · {r.resumo.turmasAtivas} turma(s)
              {'\n'}conferido em {formatDate(r.rodadaEm, 'DD/MM')} às {formatDate(r.rodadaEm, 'HH:mm')}
            </Text>
          </View>

          {r.achados.length === 0 ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Está tudo em ordem"
              description="Todo aluno com horário fixo está na turma dele."
            />
          ) : (
            <>
              <Text style={s.contagem}>
                {r.resumo.graves} problema(s) grave(s) · {r.resumo.atencao} ponto(s) de atenção
              </Text>
              {r.achados.map((a) => (
                <CartaoDoAchado
                  key={a.tipo}
                  achado={a}
                  onAgir={a.acao === 'restaurar-horarios-fixos' ? () => setConfirmando(true) : undefined}
                />
              ))}
            </>
          )}
        </>
      ) : null}
      <View style={{ height: isDesktop ? 32 : 90 }} />
    </>
  );

  return (
    <View style={s.tela}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={[s.scroll, isDesktop && s.scrollDesktop]} showsVerticalScrollIndicator={false}>
        {conteudo}
      </ScrollView>
      <TabBar isAdmin />

      {/*
        Confirmação porque isto escreve no banco e mexe em muita gente de uma
        vez. O texto diz o número exato antes de acontecer.
      */}
      <ConfirmModal
        visible={confirmando}
        title="Devolver os horários fixos?"
        message={
          'Todos os horários fixos desligados de alunos que TREINAM voltam a valer, ' +
          'e as aulas dos próximos dois meses são remarcadas na hora. ' +
          'Quem está marcado como "não treina mais" não é tocado.\n\n' +
          'Turma que já estiver cheia fica de fora — nessas, escolha quem entra pela Agenda.'
        }
        confirmLabel="Devolver"
        loading={restaurar.isPending}
        onConfirm={() =>
          restaurar.mutate(undefined, {
            onSuccess: (d) => {
              setConfirmando(false);
              setResultado(d.mensagem);
              // Roda a conferência de novo: o dono vê o resultado, não acredita nele.
              varredura.refetch();
            },
            onError: (e) => {
              setConfirmando(false);
              setResultado(e instanceof ApiError ? e.message : 'Não consegui devolver. Tente de novo.');
            },
          })
        }
        onCancel={() => setConfirmando(false)}
      />
      <InfoModal
        visible={!!resultado}
        title="Pronto"
        message={resultado ?? ''}
        onClose={() => setResultado(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: LC.bg },
  scroll: { padding: 16, paddingTop: 20 },
  scrollDesktop: { maxWidth: 900, width: '100%', alignSelf: 'center', padding: 24 },
  cabecalho: { marginBottom: 14 },
  titulo: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitulo: { fontSize: 13, color: LC.textSecondary, marginTop: 6, lineHeight: 19 },
  botao: { marginBottom: 18 },
  resumo: {
    backgroundColor: LC.primaryLight,
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  resumoTexto: { fontSize: 12, color: LC.textSecondary, lineHeight: 18 },
  contagem: { fontSize: 13, fontWeight: '700', color: LC.textPrimary, marginBottom: 10 },
  cartao: { marginBottom: 14, borderLeftWidth: 3, overflow: 'hidden' },
  cartaoGrave: { borderLeftColor: LC.danger },
  cartaoAtencao: { borderLeftColor: LC.warningFg },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, paddingBottom: 10 },
  cartaoTitulo: { flex: 1, fontSize: 14, fontWeight: '700', color: LC.textPrimary, lineHeight: 19 },
  itens: { paddingHorizontal: 14, gap: 2 },
  item: { paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTocavel: { borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -8 },
  itemPressed: { backgroundColor: LC.primaryLight },
  itemTexto: { flex: 1, fontSize: 13, color: LC.textSecondary, lineHeight: 18 },
  itemTextoLink: { color: LC.textPrimary },
  oQueFazer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    padding: 14, paddingTop: 12, marginTop: 8,
    borderTopWidth: 1, borderTopColor: LC.border,
  },
  oQueFazerTexto: { flex: 1, fontSize: 12, color: LC.textSecondary, lineHeight: 18 },
  acaoBox: { padding: 14, paddingTop: 0 },
});
