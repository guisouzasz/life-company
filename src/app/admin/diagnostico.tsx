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
 * Quase tudo aqui é leitura: cada achado diz o que fazer, e o conserto
 * acontece na tela do aluno, onde a dona vê o contexto todo.
 *
 * A exceção é devolver horário fixo apagado, e ela é uma ESCOLHA, não um
 * botão de "arrumar tudo". Os dois casos que a lista mistura — o horário
 * removido de propósito e o apagado por engano — são a mesma linha no banco.
 * Quem sabe separar é quem administra o estúdio, e é por isso que ele marca
 * nome por nome antes de confirmar.
 */

function ItemDoAchadoLinha({
  item,
  marcado,
  onMarcar,
}: {
  item: ItemDoAchado;
  /** Ausente quando o achado não é dos que se devolve — aí não há caixinha. */
  marcado?: boolean;
  onMarcar?: () => void;
}) {
  const nome = item.texto.split(' — ')[0];

  /*
    Com caixinha, o toque na linha inteira marca — alvo grande, para o dedo
    numa lista de trinta nomes. Quem quiser abrir o cadastro usa a seta.
  */
  if (onMarcar) {
    return (
      <Pressable
        style={({ pressed }) => [s.item, s.itemTocavel, pressed && s.itemPressed]}
        onPress={onMarcar}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!marcado }}
        accessibilityLabel={`Devolver os horários de ${nome}`}
      >
        <View style={[s.caixa, marcado && s.caixaMarcada]}>
          {marcado ? <Icon name="checkmark" size={13} color="#fff" /> : null}
        </View>
        <Text style={[s.itemTexto, marcado && s.itemTextoMarcado]}>{item.texto}</Text>
        <Pressable
          hitSlop={10}
          onPress={() => router.push(`/admin/alunos?busca=${encodeURIComponent(nome)}`)}
          accessibilityLabel={`Abrir o cadastro de ${nome}`}
        >
          <Icon name="chevron-forward" size={15} color={LC.textMuted} />
        </Pressable>
      </Pressable>
    );
  }

  /*
    Sem caixinha, o toque leva ao cadastro. Sem isso a lista vira lição de
    casa: ler trinta nomes, decorar, e procurar um por um na aba Alunos.
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
      onPress={() => router.push(`/admin/alunos?busca=${encodeURIComponent(nome)}`)}
      accessibilityLabel={`Abrir o cadastro de ${nome}`}
    >
      <Text style={[s.itemTexto, s.itemTextoLink]}>{item.texto}</Text>
      <Icon name="chevron-forward" size={15} color={LC.textMuted} />
    </Pressable>
  );
}

function CartaoDoAchado({
  achado,
  marcados,
  onMarcar,
  onDevolver,
}: {
  achado: Achado;
  marcados: Set<string>;
  onMarcar: (ids: string[]) => void;
  onDevolver: () => void;
}) {
  const grave = achado.gravidade === 'grave';
  const escolhivel = achado.acao === 'restaurar-horarios-fixos';
  const quantos = escolhivel
    ? achado.itens.filter((i) => (i.horarioFixoIds ?? []).some((id) => marcados.has(id))).length
    : 0;

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

      <View style={s.oQueFazer}>
        <Icon name="arrow-forward" size={13} color={LC.textSecondary} />
        <Text style={s.oQueFazerTexto}>{achado.oQueFazer}</Text>
      </View>

      <View style={s.itens}>
        {achado.itens.map((i, n) => {
          const ids = i.horarioFixoIds ?? [];
          return (
            <ItemDoAchadoLinha
              key={`${achado.tipo}-${n}`}
              item={i}
              marcado={escolhivel ? ids.length > 0 && ids.every((id) => marcados.has(id)) : undefined}
              onMarcar={escolhivel && ids.length > 0 ? () => onMarcar(ids) : undefined}
            />
          );
        })}
      </View>

      {escolhivel ? (
        <View style={s.acaoBox}>
          <Button
            title={quantos === 0 ? 'Marque quem volta' : `Devolver ${quantos} aluno(s)`}
            onPress={onDevolver}
            disabled={quantos === 0}
          />
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
  /**
   * Ninguém vem marcado. Uma lista pré-marcada é um "confirmar tudo" com
   * passos extras — e a única pergunta que esta tela faz é justamente quem
   * deve voltar.
   */
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const r = varredura.data;

  const alternar = (ids: string[]) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      const todosMarcados = ids.every((id) => novo.has(id));
      for (const id of ids) (todosMarcados ? novo.delete(id) : novo.add(id));
      return novo;
    });

  const devolver = () =>
    restaurar.mutate([...marcados], {
      onSuccess: (d) => {
        setConfirmando(false);
        setMarcados(new Set());
        const detalhe = d.recusados.length
          ? '\n\n' + d.recusados.map((x) => `• ${x.nome}: ${x.motivo}`).join('\n')
          : '';
        setResultado(d.mensagem + detalhe);
        // Roda a conferência de novo: o dono vê o resultado, não acredita nele.
        varredura.refetch();
      },
      onError: (e) => {
        setConfirmando(false);
        setResultado(e instanceof ApiError ? e.message : 'Não consegui devolver. Tente de novo.');
      },
    });

  const conteudo = (
    <>
      <View style={s.cabecalho}>
        <Text style={s.titulo}>Conferência dos horários fixos</Text>
        <Text style={s.subtitulo}>
          Horários fixos, vagas e pendências de agendamento. A conferência não muda nada — quando
          há o que devolver, você marca quem volta.
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
              description="Nenhuma pendência encontrada nas próximas duas semanas."
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
                  marcados={marcados}
                  onMarcar={alternar}
                  onDevolver={() => setConfirmando(true)}
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
        Confirmação porque isto escreve no banco e mexe na grade de várias
        pessoas. O texto diz o número exato antes de acontecer.
      */}
      <ConfirmModal
        visible={confirmando}
        title={`Devolver ${marcados.size} horário(s)?`}
        message={
          'Os horários marcados voltam a valer e as aulas dos próximos dois meses são remarcadas na hora.\n\n' +
          'Quem você não marcou não é tocado. Turma cheia ou plano completo fica de fora, e eu digo quais.'
        }
        confirmLabel="Devolver"
        loading={restaurar.isPending}
        onConfirm={devolver}
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
  itens: { paddingHorizontal: 14, paddingTop: 10, gap: 2 },
  item: { paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemTocavel: { borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -8 },
  itemPressed: { backgroundColor: LC.primaryLight },
  itemTexto: { flex: 1, fontSize: 13, color: LC.textSecondary, lineHeight: 18 },
  itemTextoLink: { color: LC.textPrimary },
  itemTextoMarcado: { color: LC.textPrimary, fontWeight: '600' },
  caixa: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: LC.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  caixaMarcada: { backgroundColor: LC.primary, borderColor: LC.primary },
  /*
    "O que fazer" vem ANTES da lista quando há o que marcar: é a instrução de
    como usar as caixinhas logo abaixo. No rodapé, seria lida depois de o dono
    já ter marcado no escuro.
  */
  oQueFazer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  oQueFazerTexto: { flex: 1, fontSize: 12, color: LC.textSecondary, lineHeight: 18 },
  acaoBox: { padding: 14, paddingTop: 12 },
});
