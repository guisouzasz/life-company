import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Avatar } from '../../components/ui/avatar';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import { Icon } from '../../components/ui/icon';
import { Button } from '../../components/ui/button';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import {
  RegistrarPagamentoModal,
  ConfigFinanceiroModal,
  PrecosPlanosModal,
} from '../../components/admin/financeiro-modals';
import { useResumoFinanceiro } from '../../services/financeiro/financeiro.queries';
import { useDesfazerPagamento } from '../../services/financeiro/financeiro.mutations';
import type { AlunoFinanceiro } from '../../services/financeiro/financeiro.types';
import { formatarReal } from '../../services/money';
import { formatDate } from '../../services/date';
import { ApiError } from '../../services/http';
import { useIsDesktop } from '../../hooks/use-is-desktop';

function statusInfo(a: AlunoFinanceiro): { label: string; variant: BadgeVariant } {
  switch (a.status) {
    case 'EM_DIA':
      return { label: 'Em dia', variant: 'success' };
    case 'A_VENCER':
      return { label: a.dias === 0 ? 'Vence hoje' : `Vence em ${a.dias}d`, variant: a.dias <= 3 ? 'primary' : 'neutral' };
    case 'ATRASADO':
      return { label: `Atrasado ${a.dias}d`, variant: 'danger' };
    default:
      return { label: 'Definir valor', variant: 'neutral' };
  }
}

export default function AdminFinanceiro() {
  const isDesktop = useIsDesktop();
  const resumo = useResumoFinanceiro();
  const desfazer = useDesfazerPagamento();

  const [registrando, setRegistrando] = useState<AlunoFinanceiro | null>(null);
  const [configurando, setConfigurando] = useState<AlunoFinanceiro | null>(null);
  const [precosAberto, setPrecosAberto] = useState(false);
  const [desfazendo, setDesfazendo] = useState<AlunoFinanceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const dados = resumo.data;
  const mesLabel = useMemo(() => formatDate(new Date(), 'MMMM'), []);

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
      <PrecosPlanosModal visible={precosAberto} onClose={() => setPrecosAberto(false)} />
      <ConfirmModal
        visible={!!desfazendo}
        title="Desfazer pagamento"
        message={
          desfazendo?.pagamento
            ? `Remover o registro de ${formatarReal(desfazendo.pagamento.valor)} de ${desfazendo.nome.split(' ')[0]}? Use se foi lançado por engano.`
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
    </>
  );

  const statCards = dados ? (
    <View style={s.stats}>
      <Card style={s.statCard} padding={14}>
        <View style={[s.statIcon, { backgroundColor: LC.successBg }]}>
          <Icon name="trending-up-outline" size={18} color={LC.success} />
        </View>
        <Text style={s.statValor}>{formatarReal(dados.recebidoMes)}</Text>
        <Text style={s.statLabel}>Recebido em {mesLabel}</Text>
      </Card>
      <Card style={s.statCard} padding={14}>
        <View style={[s.statIcon, { backgroundColor: LC.primaryLight }]}>
          <Icon name="hourglass-outline" size={18} color={LC.primary} />
        </View>
        <Text style={s.statValor}>{formatarReal(dados.aReceber)}</Text>
        <Text style={s.statLabel}>A receber</Text>
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
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Financeiro</Text>
        <Text style={s.subtitle}>Mensalidades pagas direto ao estúdio — registre aqui</Text>
      </View>
      <Button
        title="Preços"
        variant="outline"
        size="sm"
        fullWidth={false}
        leftIcon={<Icon name="pricetags-outline" size={15} color={LC.primary} />}
        onPress={() => setPrecosAberto(true)}
      />
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
            {statCards}
            <Card style={s.tabela} padding={0}>
              <View style={[s.tRow, s.tHead]}>
                <Text style={[s.tCol, s.tColAluno, s.tHeadText]}>Aluno</Text>
                <Text style={[s.tCol, s.tColPlano, s.tHeadText]}>Plano</Text>
                <Text style={[s.tCol, s.tColValor, s.tHeadText]}>Valor</Text>
                <Text style={[s.tCol, s.tColVenc, s.tHeadText]}>Vencimento</Text>
                <Text style={[s.tCol, s.tColStatus, s.tHeadText]}>Status</Text>
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
                      <Text style={s.tValor}>{formatarReal(a.valor)}</Text>
                      {a.valorPersonalizado ? <Text style={s.tValorObs}>personalizado</Text> : null}
                    </View>
                    <Text style={[s.tCol, s.tColVenc, s.tTexto]}>Dia {a.diaVencimento}</Text>
                    <View style={[s.tCol, s.tColStatus]}>
                      <Badge label={st.label} variant={st.variant} />
                      {a.pagamento ? (
                        <Text style={s.tPagoEm}>pago {formatDate(a.pagamento.pagoEm, 'DD/MM')}</Text>
                      ) : null}
                    </View>
                    <View style={[s.tCol, s.tColAcoes, s.tAcoes]}>
                      {a.pagamento ? (
                        <Pressable style={s.acaoBtn} hitSlop={4} onPress={() => setDesfazendo(a)}>
                          <Icon name="arrow-undo-outline" size={16} color={LC.textSecondary} />
                        </Pressable>
                      ) : (
                        <Pressable style={[s.acaoBtn, s.acaoBtnPrimary]} hitSlop={4} onPress={() => setRegistrando(a)}>
                          <Icon name="checkmark" size={16} color="#fff" />
                        </Pressable>
                      )}
                      <Pressable style={s.acaoBtn} hitSlop={4} onPress={() => setConfigurando(a)}>
                        <Icon name="settings-outline" size={16} color={LC.primary} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              <View style={s.tLegenda}>
                <Text style={s.tLegendaText}>Ações: ✓ registrar recebimento • ↩ desfazer • ⚙ valor e vencimento</Text>
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
                      {a.plano?.nome ?? 'Sem plano'} • {formatarReal(a.valor)} • dia {a.diaVencimento}
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
                    <Button title="Registrar pagamento" size="sm" onPress={() => setRegistrando(a)} style={{ flex: 1 }} />
                  )}
                  <Pressable style={s.cardConfig} hitSlop={6} onPress={() => setConfigurando(a)}>
                    <Icon name="settings-outline" size={18} color={LC.primary} />
                  </Pressable>
                </View>
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
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  deskHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 16 },
  deskScroll: { paddingBottom: 16 },

  // ── Stat cards ──────────────────────────────────────────────────
  stats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1 },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValor: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  statLabel: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },

  // ── Tabela desktop ──────────────────────────────────────────────
  tabela: { overflow: 'hidden' },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: LC.border },
  tHead: { backgroundColor: LC.bg, paddingVertical: 12 },
  tHeadText: { fontSize: 12, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tCol: { paddingHorizontal: 4 },
  tColAluno: { flex: 2.6 },
  tColPlano: { flex: 1.6 },
  tColValor: { flex: 1.4 },
  tColVenc: { flex: 1.1 },
  tColStatus: { flex: 1.6 },
  tColAcoes: { flex: 1.1 },
  tAlunoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary, flex: 1 },
  tTexto: { fontSize: 13, color: LC.textSecondary },
  tValor: { fontSize: 13, fontWeight: '700', color: LC.textPrimary },
  tValorObs: { fontSize: 10, color: LC.textMuted },
  tPagoEm: { fontSize: 10, color: LC.textMuted, marginTop: 3 },
  tAcoes: { flexDirection: 'row', gap: 8 },
  acaoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center' },
  acaoBtnPrimary: { backgroundColor: LC.primary, borderColor: LC.primary },
  tLegenda: { paddingHorizontal: 16, paddingVertical: 10 },
  tLegendaText: { fontSize: 11, color: LC.textMuted },

  // ── Cards mobile ────────────────────────────────────────────────
  card: { marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardNome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  cardSub: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  cardConfig: { width: 40, height: 40, borderRadius: 20, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
