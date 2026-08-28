import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LC } from '../constants/theme';
import { formatarReal, valorOuNulo } from '../services/mascaras';
import { DIAS_PERIODO_REPOSICOES, DIAS_VALIDADE_CREDITO, MAX_REPOSICOES_POR_PERIODO } from '../constants/app';
import { TabBar } from '../components/tab-bar';
import { Header } from '../components/ui/header';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Icon } from '../components/ui/icon';
import { SaldoDots } from '../components/ui/saldo-dots';
import { Loading, ErrorState } from '../components/ui/states';
import { useSaldo } from '../services/usuarios/usuarios.queries';
import { useMeusCreditos } from '../services/creditos/creditos.queries';
import { useMinhaSituacaoFinanceira } from '../services/financeiro/financeiro.queries';
import { endOfIsoWeekFormatted, formatDate } from '../services/date';

export default function MeuPlano() {
  const saldo = useSaldo();
  const creditos = useMeusCreditos();
  const financeiro = useMinhaSituacaoFinanceira();
  const validos = (creditos.data ?? []).filter((c) => c.status === 'VALIDO');
  const fin = financeiro.data;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <Header title="Meu plano" showBack />

      {saldo.isLoading ? (
        <Loading />
      ) : saldo.isError || !saldo.data ? (
        <ErrorState onRetry={() => saldo.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Card do plano */}
          <LinearGradient colors={LC.gradientCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.planCard}>
            <View style={s.planTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.planNome}>{saldo.data.plano}</Text>
                <Text style={s.planSub}>{saldo.data.total} aulas por semana</Text>
                <Text style={s.planRenova}>Renova em {endOfIsoWeekFormatted()}</Text>
              </View>
              <View style={s.ativoBadge}>
                <Text style={s.ativoText}>Ativo</Text>
              </View>
            </View>

            <View style={s.saldoBox}>
              <Text style={s.saldoLabel}>Saldo da semana</Text>
              <Text style={s.saldoCount}>
                {saldo.data.usadas} de {saldo.data.total} aulas utilizadas
              </Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.min((saldo.data.usadas / Math.max(saldo.data.total, 1)) * 100, 100)}%` }]} />
              </View>
              <Text style={s.restantes}>Aulas restantes: {Math.max(saldo.data.total - saldo.data.usadas, 0)}</Text>
              <View style={{ marginTop: 12 }}>
                <SaldoDots usadas={saldo.data.usadas} total={saldo.data.total} />
              </View>
            </View>
          </LinearGradient>

          {/* Mensalidade — oculta enquanto o estúdio não iniciou o controle */}
          {fin && fin.status !== 'SEM_REGISTRO' ? (
            <Card style={s.detCard} padding={16}>
              <View style={s.credHead}>
                <View style={[s.credIcon, fin.status === 'ATRASADO' && { backgroundColor: LC.dangerBg }]}>
                  <Icon
                    name="wallet-outline"
                    size={20}
                    color={fin.status === 'ATRASADO' ? LC.danger : LC.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.credTitle}>
                    Mensalidade{valorOuNulo(fin.valorMensalidade) !== null ? ` · ${formatarReal(fin.valorMensalidade)}` : ''}
                  </Text>
                  <Text style={s.credSub}>Vence todo dia {fin.diaVencimento}</Text>
                </View>
                {fin.status === 'EM_DIA' ? (
                  <Badge label="Paga" variant="success" />
                ) : fin.status === 'ATRASADO' ? (
                  <Badge label={`Atrasada ${fin.dias}d`} variant="danger" />
                ) : (
                  <Badge label={fin.dias === 0 ? 'Vence hoje' : `Vence em ${fin.dias}d`} variant={fin.dias <= 5 ? 'primary' : 'neutral'} />
                )}
              </View>
              <Text style={s.credHint}>
                {fin.status === 'EM_DIA' && fin.pagamento
                  ? `Pagamento deste mês registrado em ${formatDate(fin.pagamento.pagoEm, 'DD/MM')}. Obrigado!`
                  : 'O pagamento é feito direto com o estúdio (PIX ou dinheiro) — aqui você acompanha a situação.'}
              </Text>
            </Card>
          ) : null}

          {/* Créditos de reposição */}
          <Card style={s.detCard} padding={16}>
            <View style={s.credHead}>
              <View style={s.credIcon}>
                <Icon name="ticket-outline" size={20} color={LC.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.credTitle}>Créditos de reposição</Text>
                <Text style={s.credSub}>
                  {validos.length > 0
                    ? `${validos.length} ${validos.length === 1 ? 'disponível' : 'disponíveis'} para agendar`
                    : 'Nenhum crédito disponível'}
                </Text>
              </View>
              {validos.length > 0 ? <Badge label={String(validos.length)} variant="primary" /> : null}
            </View>
            {validos.length > 0 ? (
              <View style={s.credList}>
                {validos.map((c) => (
                  <View key={c.id} style={s.credRow}>
                    <Text style={s.credRowText}>Válido até {formatDate(c.expiraEm, 'DD/MM/YYYY')}</Text>
                    <Badge label="Disponível" variant="success" />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.credHint}>
                Cancelamentos dentro do prazo viram crédito (válido por {DIAS_VALIDADE_CREDITO} dias) para você repor a aula quando quiser.
              </Text>
            )}
            {/*
              As duas regras do termo que o aluno esbarra na hora de repor:
              o teto da janela e o compromisso de presença. Ficam aqui porque
              é onde ele olha os créditos antes de marcar — descobrir o limite
              só no erro da tela de agendamento seria tarde.
            */}
            <Text style={s.credHint}>
              Você pode agendar até {MAX_REPOSICOES_POR_PERIODO} reposições a cada {DIAS_PERIODO_REPOSICOES} dias.
              Depois de marcada, a reposição é confirmada e não pode ser cancelada.
            </Text>
          </Card>

          {/* Detalhes */}
          <Card style={s.detCard} padding={4}>
            <Text style={s.detTitle}>Detalhes do plano</Text>
            <DetailRow label="Modalidades" value="Todas (Musculação, Funcional, Pilates)" />
            <DetailRow label="Frequência" value={`${saldo.data.total}x por semana`} />
            <DetailRow label="Aulas usadas" value={`${saldo.data.usadas} de ${saldo.data.total}`} />
            <DetailRow label="Status" value="Ativo" status last />
          </Card>
        </ScrollView>
      )}
      <TabBar />
    </View>
  );
}

function DetailRow({ label, value, status, last }: { label: string; value: string; status?: boolean; last?: boolean }) {
  return (
    <View style={[s.detRow, !last && s.detRowBorder]}>
      <Text style={s.detLabel}>{label}</Text>
      {status ? <Badge label={value} variant="success" /> : <Text style={s.detValue}>{value}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { ...LC.coluna, padding: 16, paddingBottom: 24 },
  planCard: { borderRadius: LC.radius.xl, padding: 20, marginBottom: 14 },
  planTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  planNome: { fontSize: 22, fontWeight: '800', color: '#fff' },
  planSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  planRenova: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  ativoBadge: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: LC.radius.full },
  ativoText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  saldoBox: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: LC.radius.md, padding: 16 },
  saldoLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  saldoCount: { fontSize: 15, color: '#fff', fontWeight: '700', marginTop: 3, marginBottom: 10 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#fff' },
  restantes: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 8 },
  detCard: { marginBottom: 12 },
  credHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  credIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  credTitle: { fontSize: 15, fontWeight: '800', color: LC.textPrimary },
  credSub: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  credList: { marginTop: 12, gap: 8 },
  credRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: LC.border },
  credRowText: { fontSize: 13, color: LC.textPrimary, fontWeight: '600' },
  credHint: { fontSize: 12, color: LC.textMuted, marginTop: 10, lineHeight: 17 },
  detTitle: { fontSize: 15, fontWeight: '800', color: LC.textPrimary, padding: 14, paddingBottom: 8 },
  detRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  detRowBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  detLabel: { fontSize: 14, color: LC.textSecondary },
  detValue: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
});
