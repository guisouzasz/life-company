import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Avatar } from '../../components/ui/avatar';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import { Icon } from '../../components/ui/icon';
import { Button } from '../../components/ui/button';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { RegistrarPagamentoModal, ConfigFinanceiroModal } from '../../components/admin/financeiro-modals';
import { useResumoFinanceiro } from '../../services/financeiro/financeiro.queries';
import { useDesfazerPagamento } from '../../services/financeiro/financeiro.mutations';
import type { AlunoFinanceiro } from '../../services/financeiro/financeiro.types';
import { naSituacao, passouDoDia, type SituacaoPagamento } from '../../services/financeiro/situacao';
import { formatDate } from '../../services/date';
import { formatarReal, valorOuNulo } from '../../services/mascaras';
import { ApiError } from '../../services/http';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { linkWhatsapp, mensagemVencimento, telefoneParaWhatsapp } from '../../services/whatsapp';
import { nomeCurto } from '../../services/nome';

/**
 * Aviso de mensalidade pelo WhatsApp. Vale para quem está a vencer ou
 * atrasado — quem já pagou não precisa de lembrete.
 *
 * O envio é manual de propósito: o app abre a conversa com o texto pronto e
 * quem aperta enviar é o admin. Sem custo e sem depender de número dedicado
 * nem de modelo aprovado pela Meta, que é o que a API oficial exigiria.
 */
function useAvisoWhatsapp() {
  const [erro, setErro] = useState<string | null>(null);

  // Inclui quem está "Sem registro" e já passou do dia: para a dona, está devendo.
  const cabeAviso = (a: AlunoFinanceiro) => a.status === 'A_VENCER' || a.status === 'ATRASADO' || passouDoDia(a);

  const avisar = async (a: AlunoFinanceiro) => {
    const numero = telefoneParaWhatsapp(a.telefone);
    if (!numero) {
      setErro(
        `${nomeCurto(a.nome)} não tem telefone válido no cadastro. ` +
          'Vá em Alunos, toque em Editar e informe o número com DDD.',
      );
      return;
    }
    const texto = mensagemVencimento({
      nome: a.nome,
      vencimento: a.vencimento,
      atrasado: passouDoDia(a),
      valor: a.valorMensalidade,
    });
    try {
      await openBrowserAsync(linkWhatsapp(numero, texto));
    } catch {
      setErro('Não foi possível abrir o WhatsApp neste aparelho.');
    }
  };

  return { avisar, cabeAviso, erro, limparErro: () => setErro(null) };
}

type Situacao = SituacaoPagamento;

function statusInfo(a: AlunoFinanceiro): { label: string; variant: BadgeVariant } {
  switch (a.status) {
    case 'EM_DIA':
      return { label: 'Pagou', variant: 'success' };
    case 'ATRASADO':
      return { label: `Atrasado ${a.dias}d`, variant: 'danger' };
    case 'SEM_REGISTRO':
      return passouDoDia(a)
        ? { label: `Sem registro · passou dia ${a.diaVencimento}`, variant: 'warning' }
        : { label: 'Sem registro', variant: 'neutral' };
    default:
      return { label: a.dias === 0 ? 'Vence hoje' : `Vence em ${a.dias}d`, variant: a.dias <= 3 ? 'primary' : 'neutral' };
  }
}

export default function AdminFinanceiro() {
  const isDesktop = useIsDesktop();
  const resumo = useResumoFinanceiro();
  const desfazer = useDesfazerPagamento();

  const [registrando, setRegistrando] = useState<AlunoFinanceiro | null>(null);
  const [configurando, setConfigurando] = useState<AlunoFinanceiro | null>(null);
  const [desfazendo, setDesfazendo] = useState<AlunoFinanceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [diaVencimentoFiltro, setDiaVencimentoFiltro] = useState<number | null>(null);
  const [situacao, setSituacao] = useState<Situacao>('todos');
  const aviso = useAvisoWhatsapp();

  const dados = resumo.data;
  const alunosFinanceiro = dados?.alunos ?? [];
  const diasVencimento = useMemo(
    () => [...new Set(alunosFinanceiro.map((a) => a.diaVencimento))].sort((a, b) => a - b),
    [alunosFinanceiro],
  );
  const doDia = useMemo(
    () =>
      diaVencimentoFiltro === null
        ? alunosFinanceiro
        : alunosFinanceiro.filter((a) => a.diaVencimento === diaVencimentoFiltro),
    [alunosFinanceiro, diaVencimentoFiltro],
  );
  const alunosFiltrados = useMemo(() => doDia.filter((a) => naSituacao(a, situacao)), [doDia, situacao]);
  /** Os números do topo, contados do mesmo jeito que o filtro (o "Sem registro" que passou do dia entra em atrasados). */
  const contagem = useMemo(
    () => ({
      pagou: alunosFinanceiro.filter((a) => naSituacao(a, 'pagou')).length,
      aVencer: alunosFinanceiro.filter((a) => naSituacao(a, 'aVencer')).length,
      passou: alunosFinanceiro.filter((a) => naSituacao(a, 'passou')).length,
    }),
    [alunosFinanceiro],
  );
  /** Toque no quadro do topo: filtra; tocar de novo volta para todos. */
  const alternar = (sit: Situacao) => setSituacao((atual) => (atual === sit ? 'todos' : sit));
  const vazio = situacao === 'todos' ? 'Nenhum aluno vence nesse dia.' : 'Nenhum aluno nesta situação.';

  const confirmarDesfazer = () => {
    if (!desfazendo?.pagamento) return;
    desfazer.mutate(desfazendo.pagamento.id, {
      onSuccess: () => setDesfazendo(null),
      onError: (e) => {
        setDesfazendo(null);
        setErro(e instanceof ApiError ? e.message : 'Não foi possível desfazer.');
      },
    });
  };

  const modais = (
    <>
      <RegistrarPagamentoModal aluno={registrando} onClose={() => setRegistrando(null)} />
      <ConfigFinanceiroModal aluno={configurando} onClose={() => setConfigurando(null)} />
      <ConfirmModal
        visible={!!desfazendo}
        title="Desfazer pagamento"
        message={
          desfazendo
            ? `Desmarcar o pagamento de ${nomeCurto(desfazendo.nome)} deste mês? Use se foi marcado por engano.`
            : ''
        }
        confirmLabel="Desfazer"
        cancelLabel="Voltar"
        destructive
        loading={desfazer.isPending}
        onConfirm={confirmarDesfazer}
        onCancel={() => setDesfazendo(null)}
      />
      <InfoModal visible={!!erro} title="Erro" message={erro ?? ''} onClose={() => setErro(null)} />
      <InfoModal
        visible={!!aviso.erro}
        title="Não foi possível avisar"
        message={aviso.erro ?? ''}
        onClose={aviso.limparErro}
      />
    </>
  );

  /**
   * O dinheiro do mês, antes da contagem de pessoas.
   *
   * "Previsto" só soma quem tem valor definido — por isso o aviso de quantos
   * ficaram de fora: um total incompleto sem avisar faria a dona planejar em
   * cima de um número menor do que a realidade.
   */
  const cardDinheiro = dados ? (
    <Card style={s.dinheiro} padding={16}>
      <View style={s.dinheiroLinha}>
        <View style={s.dinheiroItem}>
          <Text style={s.dinheiroLabel}>Previsto</Text>
          <Text style={s.dinheiroValor}>{formatarReal(dados.previsto)}</Text>
        </View>
        <View style={s.dinheiroDivisor} />
        <View style={s.dinheiroItem}>
          <Text style={s.dinheiroLabel}>Recebido</Text>
          <Text style={[s.dinheiroValor, { color: LC.successFg }]}>{formatarReal(dados.recebido)}</Text>
        </View>
        <View style={s.dinheiroDivisor} />
        <View style={s.dinheiroItem}>
          <Text style={s.dinheiroLabel}>Em aberto</Text>
          <Text style={[s.dinheiroValor, dados.emAberto > 0 && { color: LC.danger }]}>
            {formatarReal(dados.emAberto)}
          </Text>
        </View>
      </View>
      {(dados.semValor ?? 0) > 0 ? (
        <Text style={s.dinheiroAviso}>
          {dados.semValor} {dados.semValor === 1 ? 'aluno está' : 'alunos estão'} sem valor de
          mensalidade — {dados.semValor === 1 ? 'ele não entra' : 'eles não entram'} nesta conta.
        </Text>
      ) : null}
    </Card>
  ) : null;

  const statCards = dados ? (
    <View style={s.stats}>
      <Pressable style={s.statToque} onPress={() => alternar('pagou')} accessibilityRole="button" accessibilityState={{ selected: situacao === 'pagou' }}>
        <Card style={[s.statCard, situacao === 'pagou' && s.statCardSel]} padding={14}>
          <View style={[s.statIcon, { backgroundColor: LC.successBg }]}>
            <Icon name="checkmark-circle-outline" size={18} color={LC.success} />
          </View>
          <Text style={s.statValor}>{contagem.pagou}</Text>
          <Text style={s.statLabel}>{contagem.pagou === 1 ? 'Pagou' : 'Pagaram'}</Text>
        </Card>
      </Pressable>
      <Pressable style={s.statToque} onPress={() => alternar('aVencer')} accessibilityRole="button" accessibilityState={{ selected: situacao === 'aVencer' }}>
        <Card style={[s.statCard, situacao === 'aVencer' && s.statCardSel]} padding={14}>
          <View style={[s.statIcon, { backgroundColor: LC.primaryLight }]}>
            <Icon name="hourglass-outline" size={18} color={LC.primary} />
          </View>
          <Text style={s.statValor}>{contagem.aVencer}</Text>
          <Text style={s.statLabel}>A vencer</Text>
        </Card>
      </Pressable>
      <Pressable style={s.statToque} onPress={() => alternar('passou')} accessibilityRole="button" accessibilityState={{ selected: situacao === 'passou' }}>
        <Card style={[s.statCard, situacao === 'passou' && s.statCardSel]} padding={14}>
          <View style={[s.statIcon, { backgroundColor: LC.dangerBg }]}>
            <Icon name="alert-circle-outline" size={18} color={LC.danger} />
          </View>
          <Text style={[s.statValor, contagem.passou > 0 && { color: LC.danger }]}>{contagem.passou}</Text>
          <Text style={s.statLabel}>{contagem.passou === 1 ? 'Atrasado' : 'Atrasados'}</Text>
        </Card>
      </Pressable>
    </View>
  ) : null;

  const SITUACOES: { chave: Situacao; rotulo: string }[] = [
    { chave: 'todos', rotulo: 'Todos' },
    { chave: 'faltam', rotulo: 'Faltam pagar' },
    { chave: 'passou', rotulo: 'Passaram do dia' },
    { chave: 'aVencer', rotulo: 'A vencer' },
    { chave: 'pagou', rotulo: 'Pagaram' },
  ];
  const filtroVencimento = dados ? (
    <Card style={s.filtroCard} padding={12}>
      <View style={s.filtroTopo}>
        <View style={s.filtroTituloLinha}>
          <Icon name="funnel-outline" size={16} color={LC.primary} />
          <Text style={s.filtroTitulo}>Situação</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filtroChips, s.filtroChipsSituacao]}>
        {SITUACOES.map((f) => {
          const sel = situacao === f.chave;
          const n = doDia.filter((a) => naSituacao(a, f.chave)).length;
          return (
            <Pressable
              key={f.chave}
              style={[s.filtroChip, sel && s.filtroChipSel]}
              onPress={() => setSituacao(f.chave)}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
            >
              <Text style={[s.filtroChipText, sel && s.filtroChipTextSel]}>{f.rotulo} ({n})</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={s.filtroTopo}>
        <View style={s.filtroTituloLinha}>
          <Icon name="calendar-number-outline" size={16} color={LC.primary} />
          <Text style={s.filtroTitulo}>Vencimento</Text>
        </View>
        <Text style={s.filtroResumo}>
          {diaVencimentoFiltro === null
            ? `${alunosFiltrados.length} ${alunosFiltrados.length === 1 ? 'aluno' : 'alunos'}`
            : `${alunosFiltrados.length} no dia ${diaVencimentoFiltro}`}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtroChips}>
        <Pressable
          style={[s.filtroChip, diaVencimentoFiltro === null && s.filtroChipSel]}
          onPress={() => setDiaVencimentoFiltro(null)}
          accessibilityRole="button"
        >
          <Text style={[s.filtroChipText, diaVencimentoFiltro === null && s.filtroChipTextSel]}>Todos</Text>
        </Pressable>
        {diasVencimento.map((dia) => {
          const sel = diaVencimentoFiltro === dia;
          return (
            <Pressable
              key={dia}
              style={[s.filtroChip, sel && s.filtroChipSel]}
              onPress={() => setDiaVencimentoFiltro(sel ? null : dia)}
              accessibilityRole="button"
            >
              <Text style={[s.filtroChipText, sel && s.filtroChipTextSel]}>Dia {dia}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Card>
  ) : null;

  const header = (
    <View style={isDesktop ? s.deskHeader : s.header}>
      <Text style={s.title}>Financeiro</Text>
      <Text style={s.subtitle}>Controle de quem já pagou o mês — o pagamento é feito direto ao estúdio</Text>
    </View>
  );

  const estadoBase = resumo.isLoading ? (
    <Loading />
  ) : resumo.isError ? (
    <ErrorState onRetry={() => resumo.refetch()} />
  ) : !dados || dados.alunos.length === 0 ? (
    <EmptyState icon="wallet-outline" title="Nenhum aluno ativo" description="Os alunos ativos aparecerão aqui." />
  ) : null;

  // ── Desktop: tabela ─────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={s.root}>
        {header}
        {estadoBase ?? (
          <ScrollView contentContainerStyle={s.deskScroll} showsVerticalScrollIndicator={false}>
            {cardDinheiro}
            {statCards}
            {filtroVencimento}
            <Card style={s.tabela} padding={0}>
              <View style={[s.tRow, s.tHead]}>
                <Text style={[s.tCol, s.tColAluno, s.tHeadText]}>Aluno</Text>
                <Text style={[s.tCol, s.tColPlano, s.tHeadText]}>Plano</Text>
                <Text style={[s.tCol, s.tColValor, s.tHeadText]}>Valor</Text>
                <Text style={[s.tCol, s.tColVenc, s.tHeadText]}>Vencimento</Text>
                <Text style={[s.tCol, s.tColStatus, s.tHeadText]}>Situação</Text>
                <Text style={[s.tCol, s.tColAcoes, s.tHeadText]}>Ações</Text>
              </View>
              {alunosFiltrados.length === 0 ? (
                <View style={s.tVazio}>
                  <Text style={s.tVazioText}>{vazio}</Text>
                </View>
              ) : (
                alunosFiltrados.map((a) => {
                  const st = statusInfo(a);
                  return (
                    <View key={a.usuarioId} style={s.tRow}>
                      <View style={[s.tCol, s.tColAluno, s.tAlunoWrap]}>
                        <Avatar nome={a.nome} size={34} />
                        <Text style={s.tNome} numberOfLines={1}>{nomeCurto(a.nome)}</Text>
                      </View>
                      <Text style={[s.tCol, s.tColPlano, s.tTexto]} numberOfLines={1}>{a.plano?.nome ?? '—'}</Text>
                      <View style={[s.tCol, s.tColValor]}>
                        <Text style={valorOuNulo(a.valorMensalidade) === null ? s.tSemValor : s.tValor}>
                          {valorOuNulo(a.valorMensalidade) === null
                            ? 'a definir'
                            : formatarReal(a.valorMensalidade)}
                        </Text>
                        {valorOuNulo(a.pagamento?.valor) !== null &&
                        a.pagamento!.valor > 0 &&
                        a.pagamento!.valor !== a.valorMensalidade ? (
                          <Text style={s.tPagoEm}>recebido {formatarReal(a.pagamento!.valor)}</Text>
                        ) : null}
                      </View>
                      <Text style={[s.tCol, s.tColVenc, s.tTexto]}>Dia {a.diaVencimento}</Text>
                      <View style={[s.tCol, s.tColStatus]}>
                        <Badge label={st.label} variant={st.variant} />
                        {a.pagamento ? (
                          <Text style={s.tPagoEm}>em {formatDate(new Date(a.pagamento.pagoEm), 'DD/MM')}</Text>
                        ) : null}
                      </View>
                      <View style={[s.tCol, s.tColAcoes, s.tAcoes]}>
                        {a.pagamento ? (
                          <Pressable style={s.acaoBtn} hitSlop={4} onPress={() => setDesfazendo(a)}>
                            <Icon name="arrow-undo-outline" size={16} color={LC.textSecondary} />
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[s.acaoBtn, s.acaoBtnPrimary]}
                            hitSlop={4}
                            onPress={() => setRegistrando(a)}
                            accessibilityRole="button"
                            accessibilityLabel={`Marcar ${a.nome} como pago`}
                          >
                            <Icon name="checkmark" size={16} color="#fff" />
                          </Pressable>
                        )}
                        <Pressable
                          style={s.acaoBtn}
                          hitSlop={4}
                          onPress={() => setConfigurando(a)}
                          accessibilityRole="button"
                          accessibilityLabel={`Mensalidade de ${a.nome}`}
                        >
                          <Icon name="calendar-outline" size={16} color={LC.primary} />
                        </Pressable>
                        {aviso.cabeAviso(a) ? (
                          <Pressable
                            style={[s.acaoBtn, s.acaoBtnZap]}
                            hitSlop={4}
                            onPress={() => aviso.avisar(a)}
                            accessibilityRole="button"
                            accessibilityLabel={`Avisar ${a.nome} no WhatsApp`}
                          >
                            <Icon name="logo-whatsapp" size={16} color="#fff" />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
              <View style={s.tLegenda}>
                <Text style={s.tLegendaText}>
                  Ações: ✓ marcar como pago • ↩ desfazer • 📅 dia do vencimento{'\n'}
                  "Sem registro": o controle começa quando você marca o primeiro pagamento do aluno — até lá ele não aparece como atrasado nem recebe lembretes.
                </Text>
              </View>
            </Card>
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
        {modais}
      </View>
    );
  }

  // ── Mobile: lista de cards ──────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      {header}
      {estadoBase ?? (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {cardDinheiro}
          {statCards}
          {filtroVencimento}
          {alunosFiltrados.length === 0 ? (
            <Card style={s.card} padding={14}>
              <Text style={s.cardVazio}>{vazio}</Text>
            </Card>
          ) : (
            alunosFiltrados.map((a) => {
              const st = statusInfo(a);
              return (
                <Card key={a.usuarioId} style={s.card} padding={14}>
                  <View style={s.cardTop}>
                    <Avatar nome={a.nome} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{nomeCurto(a.nome)}</Text>
                      <Text style={s.cardSub}>
                        {a.plano?.nome ?? 'Sem plano'} • vence dia {a.diaVencimento}
                      </Text>
                      {/* O valor combinado é a informação principal. O recebido
                          só entra quando foi informado e é diferente — pagamento
                          antigo veio sem valor, e "R$ 0,00 recebido" mentiria. */}
                      <Text style={valorOuNulo(a.valorMensalidade) === null ? s.cardSemValor : s.cardValor}>
                        {valorOuNulo(a.valorMensalidade) === null
                          ? 'Sem valor definido'
                          : formatarReal(a.valorMensalidade)}
                        {valorOuNulo(a.pagamento?.valor) !== null &&
                        a.pagamento!.valor > 0 &&
                        a.pagamento!.valor !== a.valorMensalidade
                          ? ` · ${formatarReal(a.pagamento!.valor)} recebido`
                          : ''}
                      </Text>
                    </View>
                    <Badge label={st.label} variant={st.variant} />
                  </View>
                  <View style={s.cardActions}>
                    {a.pagamento ? (
                      <Button
                        title={`Pago em ${formatDate(new Date(a.pagamento.pagoEm), 'DD/MM')} — desfazer`}
                        variant="outline"
                        size="sm"
                        onPress={() => setDesfazendo(a)}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <Button title="Marcar como pago" size="sm" onPress={() => setRegistrando(a)} style={{ flex: 1 }} />
                    )}
                    <Pressable
                      style={s.cardConfig}
                      hitSlop={6}
                      onPress={() => setConfigurando(a)}
                      accessibilityRole="button"
                      accessibilityLabel={`Mensalidade de ${a.nome}`}
                    >
                      <Icon name="calendar-outline" size={18} color={LC.primary} />
                    </Pressable>
                  </View>
                  {aviso.cabeAviso(a) ? (
                    <Pressable
                      style={({ pressed }) => [s.zapBtn, pressed && { opacity: 0.75 }]}
                      onPress={() => aviso.avisar(a)}
                      accessibilityRole="button"
                      accessibilityLabel={`Avisar ${a.nome} no WhatsApp`}
                    >
                      <Icon name="logo-whatsapp" size={17} color="#fff" />
                      <Text style={s.zapBtnText}>Avisar no WhatsApp</Text>
                    </Pressable>
                  ) : null}
                </Card>
              );
            })
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
      <TabBar isAdmin />
      {modais}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  deskHeader: { paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 16 },
  deskScroll: { paddingBottom: 16 },

  // ── Stat cards ──────────────────────────────────────────────────
  stats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statToque: { flex: 1 },
  statCard: { flex: 1, borderWidth: 1.5, borderColor: 'transparent' },
  statCardSel: { borderColor: LC.primary },
  dinheiro: { marginBottom: 12 },
  dinheiroLinha: { flexDirection: 'row', alignItems: 'center' },
  dinheiroItem: { flex: 1, alignItems: 'center' },
  dinheiroDivisor: { width: 1, height: 34, backgroundColor: LC.border },
  dinheiroLabel: { fontSize: 11.5, color: LC.textSecondary, marginBottom: 3 },
  dinheiroValor: { fontSize: 16.5, fontWeight: '800', color: LC.textPrimary },
  dinheiroAviso: {
    fontSize: 11.5, color: LC.warningFg, marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: LC.border, lineHeight: 16,
  },
  tColValor: { width: 110 },
  tValor: { fontSize: 13.5, fontWeight: '700', color: LC.textPrimary },
  tSemValor: { fontSize: 12.5, color: LC.warningFg },
  cardValor: { fontSize: 12.5, fontWeight: '700', color: LC.textPrimary, marginTop: 2 },
  cardSemValor: { fontSize: 12, color: LC.warningFg, marginTop: 2 },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValor: { fontSize: 20, fontWeight: '800', color: LC.textPrimary },
  statLabel: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },

  // ── Filtro de vencimento ───────────────────────────────────────
  filtroCard: { marginBottom: 12 },
  filtroChipsSituacao: { marginBottom: 12 },
  filtroTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  filtroTituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  filtroTitulo: { fontSize: 13.5, fontWeight: '800', color: LC.textPrimary },
  filtroResumo: { fontSize: 12, color: LC.textSecondary },
  filtroChips: { gap: 8, paddingRight: 4 },
  filtroChip: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: LC.radius.full,
    backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border,
  },
  filtroChipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  filtroChipText: { fontSize: 12.5, fontWeight: '700', color: LC.textSecondary },
  filtroChipTextSel: { color: LC.primary },

  // ── Tabela desktop ──────────────────────────────────────────────
  tabela: { overflow: 'hidden' },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: LC.border },
  tHead: { backgroundColor: LC.bg, paddingVertical: 12 },
  tHeadText: { fontSize: 12, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tCol: { paddingHorizontal: 4 },
  tColAluno: { flex: 2.8 },
  tColPlano: { flex: 1.8 },
  tColVenc: { flex: 1.2 },
  tColStatus: { flex: 1.8 },
  tColAcoes: { flex: 1.1 },
  tAlunoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary, flex: 1 },
  tTexto: { fontSize: 13, color: LC.textSecondary },
  tPagoEm: { fontSize: 10, color: LC.textMuted, marginTop: 3 },
  tAcoes: { flexDirection: 'row', gap: 8 },
  acaoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center' },
  acaoBtnPrimary: { backgroundColor: LC.primary, borderColor: LC.primary },
  // Verde oficial do WhatsApp: o botão é reconhecido pelo que é, sem precisar de rótulo
  acaoBtnZap: { backgroundColor: '#25D366', borderColor: '#25D366' },
  tLegenda: { paddingHorizontal: 16, paddingVertical: 10 },
  tLegendaText: { fontSize: 11, color: LC.textMuted },
  tVazio: { paddingVertical: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: LC.border },
  tVazioText: { fontSize: 13, color: LC.textSecondary },

  // ── Cards mobile ────────────────────────────────────────────────
  card: { marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardNome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  cardSub: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  cardConfig: { width: 40, height: 40, borderRadius: 20, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardVazio: { fontSize: 13, color: LC.textSecondary, textAlign: 'center' },
  zapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10, paddingVertical: 11, borderRadius: LC.radius.md, backgroundColor: '#25D366',
  },
  zapBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});