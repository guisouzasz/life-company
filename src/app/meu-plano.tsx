import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LC } from '../constants/theme';
import { TabBar } from '../components/tab-bar';
import { Header } from '../components/ui/header';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { SaldoDots } from '../components/ui/saldo-dots';
import { Loading, ErrorState } from '../components/ui/states';
import { useSaldo } from '../services/usuarios/usuarios.queries';
import { endOfIsoWeekFormatted } from '../services/date';

export default function MeuPlano() {
  const saldo = useSaldo();

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

          {/* Detalhes */}
          <Card style={s.detCard} padding={4}>
            <Text style={s.detTitle}>Detalhes do plano</Text>
            <DetailRow label="Modalidade" value={saldo.data.modalidade} />
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
  scroll: { padding: 16, paddingBottom: 24 },
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
  detCard: {},
  detTitle: { fontSize: 15, fontWeight: '800', color: LC.textPrimary, padding: 14, paddingBottom: 8 },
  detRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  detRowBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  detLabel: { fontSize: 14, color: LC.textSecondary },
  detValue: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
});
