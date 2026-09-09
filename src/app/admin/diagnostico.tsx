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
import {
  useVarreduraDeHorariosFixos,
  useRestaurarHorariosFixos,
  useCadastrosRemovidos,
} from '../../services/diagnostico/diagnostico.queries';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { formatDate } from '../../services/date';
import type { Achado, CadastroRemovido, ItemDoAchado } from '../../services/diagnostico/diagnostico.types';

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

/**
 * Um cadastro excluído, com o que deu para reconstruir dele.
 *
 * Existe para ser lido com o celular numa mão e o formulário de cadastro na
 * outra: nome, e-mail, plano e — o que mais importa — em que turmas a pessoa
 * de fato vinha. A exclusão apaga o horário fixo, mas não as aulas que já
 * aconteceram, e é delas que sai a linha "quarta 19:00 · 14 aulas".
 */
function CartaoRemovido({ r }: { r: CadastroRemovido }) {
  return (
    <View style={s.removido}>
      <View style={s.removidoTopo}>
        <Text style={s.removidoNome}>{r.nome ?? 'Nome não recuperado'}</Text>
        {r.plano ? <Text style={s.removidoPlano}>{r.plano}</Text> : null}
      </View>
      {r.email ? <Text style={s.removidoDado}>{r.email}</Text> : null}

      {r.fixosNoRegistro.length > 0 ? (
        <Text style={s.removidoTurma}>
          Horário fixo no registro: {r.fixosNoRegistro.join(' · ')}
        </Text>
      ) : null}

      {r.turmas.length > 0 ? (
        r.turmas.map((t, i) => (
          <Text key={i} style={[s.removidoTurma, i > 0 && s.removidoTurmaFraca]}>
            {t.diaSemana} {t.horaInicio}
            {t.modalidade ? ` · ${t.modalidade}` : ''} — {t.aulas} aula{t.aulas > 1 ? 's' : ''}, a
            última em {formatDate(t.ultima, 'DD/MM/YYYY')}
          </Text>
        ))
      ) : (
        <Text style={s.removidoDado}>Sem aulas registradas — não dá para saber o horário.</Text>
      )}

      {/*
        Depois do conserto, a exclusão apaga a anamnese e o boot varre as que
        sobraram — então esta linha só deve aparecer se alguma coisa falhou.
        Deixa de ser informação e passa a ser aviso.
      */}
      {r.temAnamnese ? (
        <Text style={s.removidoNota}>
          ⚠ A ficha de saúde deste cadastro ainda está no banco. Deveria ter sido apagada na
          exclusão — avise o suporte.
        </Text>
      ) : null}
    </View>
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
  const [pediuRemovidos, setPediuRemovidos] = useState(false);
  const removidos = useCadastrosRemovidos(pediuRemovidos);
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

      {/*
        A lista de quem foi excluído fica no fim e só abre quando se pede: ela
        só interessa depois de um acidente, e no dia a dia seria um lembrete
        inútil de gente que saiu do estúdio.
      */}
      <View style={s.divisor} />
      <Text style={s.secaoTitulo}>Cadastros excluídos</Text>
      <Text style={s.secaoSub}>
        Excluir apaga o cadastro, os horários fixos e as fichas de treino — não tem desfazer. Mas as
        aulas que já aconteceram ficam, e é delas que sai em qual turma cada pessoa vinha. Use como
        lista de conferência para recadastrar.
      </Text>
      <Button
        title={removidos.isFetching ? 'Levantando…' : pediuRemovidos ? 'Levantar de novo' : 'Ver quem foi excluído'}
        onPress={() => (pediuRemovidos ? removidos.refetch() : setPediuRemovidos(true))}
        loading={removidos.isFetching}
        variant="secondary"
        leftIcon={<Icon name="archive-outline" size={17} color={LC.primary} />}
        style={s.botao}
      />
      {pediuRemovidos && removidos.data ? (
        removidos.data.total === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="Nenhum cadastro excluído"
            description="Ninguém foi excluído definitivamente neste estúdio."
          />
        ) : (
          <>
            <Text style={s.contagem}>
              {removidos.data.total} cadastro(s) excluído(s) · {removidos.data.comNome} com nome recuperado
            </Text>
            {removidos.data.removidos.map((r) => (
              <CartaoRemovido key={r.usuarioId} r={r} />
            ))}
            {removidos.data.nomesSemVinculo.length > 0 ? (
              <>
                <Text style={s.contagem}>
                  {removidos.data.nomesSemVinculo.length} nome(s) do registro sem cadastro
                  correspondente
                </Text>
                <Text style={s.secaoSub}>
                  Foram cadastrados no estúdio e não estão mais na lista de alunos, mas o registro
                  antigo não guardava o id — então não dá para dizer qual é qual. Cruze com os
                  cartões acima que estão sem nome.
                </Text>
                {removidos.data.nomesSemVinculo.map((n, i) => (
                  <Text key={i} style={s.removidoTurma}>
                    {n.nome}
                    {n.email ? ` · ${n.email}` : ''} — cadastrado em {formatDate(n.quando, 'DD/MM/YYYY')}
                  </Text>
                ))}
              </>
            ) : null}
            <Text style={s.rodapeAviso}>
              CPF, telefone, endereço e as fichas de treino não voltam por aqui — só por um backup do
              banco.
            </Text>
          </>
        )
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

  divisor: { height: 1, backgroundColor: LC.border, marginTop: 8, marginBottom: 20 },
  secaoTitulo: { fontSize: 17, fontWeight: '800', color: LC.textPrimary },
  secaoSub: { fontSize: 12.5, color: LC.textSecondary, marginTop: 6, marginBottom: 14, lineHeight: 18 },
  removido: {
    backgroundColor: LC.bgCard, borderRadius: 10, borderWidth: 1, borderColor: LC.border,
    padding: 12, marginBottom: 10,
  },
  removidoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removidoNome: { flex: 1, fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  removidoPlano: { fontSize: 11.5, color: LC.textSecondary },
  removidoDado: { fontSize: 12.5, color: LC.textSecondary, marginTop: 3 },
  /* A turma com mais aulas é o horário de verdade; as outras entram apagadas
     para não competir com ela na hora de recadastrar. */
  removidoTurma: { fontSize: 13, color: LC.textPrimary, marginTop: 6, lineHeight: 18 },
  removidoTurmaFraca: { color: LC.textMuted, fontSize: 12 },
  removidoNota: { fontSize: 11.5, color: LC.warningFg, marginTop: 7 },
  rodapeAviso: { fontSize: 12, color: LC.textMuted, marginTop: 6, lineHeight: 18 },
});
