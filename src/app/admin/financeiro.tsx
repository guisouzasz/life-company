import { useState } from 'react';
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
import { formatDate } from '../../services/date';
import { formatarReal } from '../../services/mascaras';
import { ApiError } from '../../services/http';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { linkWhatsapp, mensagemVencimento, telefoneParaWhatsapp } from '../../services/whatsapp';

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

  const cabeAviso = (a: AlunoFinanceiro) => a.status === 'A_VENCER' || a.status === 'ATRASADO';

  const avisar = async (a: AlunoFinanceiro) => {
    const numero = telefoneParaWhatsapp(a.telefone);
    if (!numero) {
      setErro(
        `${a.nome.split(' ')[0]} não tem telefone válido no cadastro. ` +
          'Vá em Alunos, toque em Editar e informe o número com DDD.',
      );
      return;
    }
    const texto = mensagemVencimento({
      nome: a.nome,
      vencimento: a.vencimento,
      atrasado: a.status === 'ATRASADO',
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

function statusInfo(a: AlunoFinanceiro): { label: string; variant: BadgeVariant } {
  switch (a.status) {
    case 'EM_DIA':
      return { label: 'Pagou', variant: 'success' };
    case 'ATRASADO':
      return { label: `Atrasado ${a.dias}d`, variant: 'danger' };
    case 'SEM_REGISTRO':
      return { label: 'Sem registro', variant: 'neutral' };
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
  const aviso = useAvisoWhatsapp();

  const dados = resumo.data;

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
            ? `Desmarcar o pagamento de ${desfazendo.nome.split(' ')[0]} deste mês? Use se foi marcado por engano.`
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
      {dados.semValor > 0 ? (
        <Text style={s.dinheiroAviso}>
          {dados.semValor} {dados.semValor === 1 ? 'aluno está' : 'alunos estão'} sem valor de
          mensalidade — {dados.semValor === 1 ? 'ele não entra' : 'eles não entram'} nesta conta.
        </Text>
      ) : null}
    </Card>
  ) : null;

  const statCards = dados ? (
    <View style={s.stats}>
      <Card style={s.statCard} padding={14}>
        <View style={[s.statIcon, { backgroundColor: LC.successBg }]}>
          <Icon name="checkmark-circle-outline" size={18} color={LC.success} />
        </View>
        <Text style={s.statValor}>{dados.pagos}</Text>
        <Text style={s.statLabel}>{dados.pagos === 1 ? 'Pagou' : 'Pagaram'}</Text>
      </Card>
      <Card style={s.statCard} padding={14}>
        <View style={[s.statIcon, { backgroundColor: LC.primaryLight }]}>
          <Icon name="hourglass-outline" size={18} color={LC.primary} />
        </View>
        <Text style={s.statValor}>{dados.aVencer}</Text>
        <Text style={s.statLabel}>A vencer</Text>
      </Card>
      <Card style={s.statCard} padding={14}>
        <View style={[s.statIcon, { backgroundColor: LC.dangerBg }]}>
          <Icon name="alert-circle-outline" size={18} color={LC.danger} />
        </View>
        <Text style={[s.statValor, dados.atrasados > 0 && { color: LC.danger }]}>{dados.atrasados}</Text>
        <Text style={s.statLabel}>{dados.atrasados === 1 ? 'Atrasado' : 'Atrasados'}</Text>
      </Card>
    </View>
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
            <Card style={s.tabela} padding={0}>
              <View style={[s.tRow, s.tHead]}>
                <Text style={[s.tCol, s.tColAluno, s.tHeadText]}>Aluno</Text>
                <Text style={[s.tCol, s.tColPlano, s.tHeadText]}>Plano</Text>
                <Text style={[s.tCol, s.tColValor, s.tHeadText]}>Valor</Text>
                <Text style={[s.tCol, s.tColVenc, s.tHeadText]}>Vencimento</Text>
                <Text style={[s.tCol, s.tColStatus, s.tHeadText]}>Situação</Text>
                <Text style={[s.tCol, s.tColAcoes, s.tHeadText]}>Ações</Text>
              </View>
              {dados!.alunos.map((a) => {
                const st = statusInfo(a);
                return (
                  <View key={a.usuarioId} style={s.tRow}>
                    <View style={[s.tCol, s.tColAluno, s.tAlunoWrap]}>
                      <Avatar nome={a.nome} size={34} />
                      <Text style={s.tNome} numberOfLines={1}>{a.nome}</Text>
                    </View>
                    <Text style={[s.tCol, s.tColPlano, s.tTexto]} numberOfLines={1}>{a.plano?.nome ?? '—'}</Text>
                    <View style={[s.tCol, s.tColValor]}>
                      <Text style={a.valorMensalidade === null ? s.tSemValor : s.tValor}>
                        {a.valorMensalidade === null ? 'a definir' : formatarReal(a.valorMensalidade)}
                      </Text>
                      {a.pagamento && a.pagamento.valor > 0 && a.pagamento.valor !== a.valorMensalidade ? (
                        <Text style={s.tPagoEm}>recebido {formatarReal(a.pagamento.valor)}</Text>
                      ) : null}
                    </View>
                    <Text style={[s.tCol, s.tColVenc, s.tTexto]}>Dia {a.diaVencimento}</Text>
                    <View style={[s.tCol, s.tColStatus]}>
                      <Badge label={st.label} variant={st.variant} />
                      {a.pagamento ? (
                        <Text style={s.tPagoEm}>em {formatDate(a.pagamento.pagoEm, 'DD/MM')}</Text>
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
              })}
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
          {dados!.alunos.map((a) => {
            const st = statusInfo(a);
            return (
              <Card key={a.usuarioId} style={s.card} padding={14}>
                <View style={s.cardTop}>
                  <Avatar nome={a.nome} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardNome}>{a.nome}</Text>
                    <Text style={s.cardSub}>
                      {a.plano?.nome ?? 'Sem plano'} • vence dia {a.diaVencimento}
                    </Text>
                    {/* O valor combinado é a informação principal. O recebido
                        só entra quando foi informado e é diferente — pagamento
                        antigo veio sem valor, e "R$ 0,00 recebido" mentiria. */}
                    <Text style={a.valorMensalidade === null ? s.cardSemValor : s.cardValor}>
                      {a.valorMensalidade === null ? 'Sem valor definido' : formatarReal(a.valorMensalidade)}
                      {a.pagamento && a.pagamento.valor > 0 && a.pagamento.valor !== a.valorMensalidade
                        ? ` · ${formatarReal(a.pagamento.valor)} recebido`
                        : ''}
                    </Text>
                  </View>
                  <Badge label={st.label} variant={st.variant} />
                </View>
                <View style={s.cardActions}>
                  {a.pagamento ? (
                    <Button
                      title={`Pago em ${formatDate(a.pagamento.pagoEm, 'DD/MM')} — desfazer`}
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
          })}
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
  statCard: { flex: 1 },
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

  // ── Cards mobile ────────────────────────────────────────────────
  card: { marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardNome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  cardSub: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  cardConfig: { width: 40, height: 40, borderRadius: 20, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  zapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10, paddingVertical: 11, borderRadius: LC.radius.md, backgroundColor: '#25D366',
  },
  zapBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
