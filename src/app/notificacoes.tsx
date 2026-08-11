import { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../constants/theme';
import { DIAS_PT } from '../constants/app';
import { nomeModalidade } from '../constants/assets';
import { Header } from '../components/ui/header';
import { Card } from '../components/ui/card';
import { Icon, type IconName } from '../components/ui/icon';
import { Loading, EmptyState } from '../components/ui/states';
import { useMeusAgendamentos } from '../services/agendamentos/agendamentos.queries';
import { useSaldo } from '../services/usuarios/usuarios.queries';
import { useMinhaSituacaoFinanceira } from '../services/financeiro/financeiro.queries';
import { formatDate } from '../services/date';

type Notificacao = {
  id: string;
  icon: IconName;
  color: string;
  bg: string;
  titulo: string;
  sub: string;
  tempo: string;
};

export default function Notificacoes() {
  const meus = useMeusAgendamentos();
  const saldo = useSaldo();
  const financeiro = useMinhaSituacaoFinanceira();

  const notificacoes = useMemo<Notificacao[]>(() => {
    const lista: Notificacao[] = [];

    // Lembrete de mensalidade (só quando precisa de atenção; nunca bloqueia nada).
    // SEM_REGISTRO = estúdio ainda não controla esse aluno → sem alertas.
    const fin = financeiro.data;
    if (fin && fin.status !== 'SEM_REGISTRO') {
      if (fin.status === 'ATRASADO') {
        lista.push({
          id: 'mensalidade',
          icon: 'alert-circle',
          color: LC.danger,
          bg: LC.dangerBg,
          titulo: `Mensalidade em atraso há ${fin.dias} ${fin.dias === 1 ? 'dia' : 'dias'}`,
          sub: 'Combine o pagamento direto com o estúdio (PIX ou dinheiro)',
          tempo: `Dia ${fin.diaVencimento}`,
        });
      } else if (fin.status === 'A_VENCER' && fin.dias <= 5) {
        lista.push({
          id: 'mensalidade',
          icon: 'wallet',
          color: LC.warning,
          bg: LC.warningBg,
          titulo: fin.dias === 0 ? 'Sua mensalidade vence hoje' : `Sua mensalidade vence em ${fin.dias} ${fin.dias === 1 ? 'dia' : 'dias'}`,
          sub: 'Pague direto ao estúdio (PIX ou dinheiro)',
          tempo: `Dia ${fin.diaVencimento}`,
        });
      }
    }

    if (saldo.data) {
      const restantes = Math.max(saldo.data.total - saldo.data.usadas, 0);
      lista.push({
        id: 'saldo',
        icon: 'information-circle',
        color: LC.info,
        bg: LC.infoBg,
        titulo:
          restantes > 0
            ? `Você ainda possui ${restantes} ${restantes === 1 ? 'aula disponível' : 'aulas disponíveis'} esta semana`
            : 'Você já utilizou todas as aulas da semana',
        sub: `${saldo.data.plano} • Todas as modalidades`,
        tempo: 'Semana',
      });
    }

    (meus.data ?? []).forEach((ag) => {
      lista.push({
        id: ag.id,
        icon: 'calendar',
        color: LC.primary,
        bg: LC.primaryLight,
        titulo: 'Aula agendada',
        sub: `${nomeModalidade(ag.horario.modalidade.nome)} • ${DIAS_PT[ag.horario.diaSemana]} • ${ag.horario.horaInicio}`,
        tempo: formatDate(ag.dataAula, 'DD/MM'),
      });
    });

    return lista;
  }, [meus.data, saldo.data, financeiro.data]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <Header title="Notificações" showBack />

      {meus.isLoading || saldo.isLoading ? (
        <Loading />
      ) : notificacoes.length === 0 ? (
        <EmptyState icon="notifications-outline" title="Tudo em dia" description="Você não tem notificações no momento." />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {notificacoes.map((n) => (
            <Card key={n.id} style={s.card} padding={14}>
              <View style={[s.iconWrap, { backgroundColor: n.bg }]}>
                <Icon name={n.icon} size={20} color={n.color} />
              </View>
              <View style={s.info}>
                <Text style={s.titulo}>{n.titulo}</Text>
                {n.sub ? <Text style={s.sub}>{n.sub}</Text> : null}
              </View>
              <Text style={s.tempo}>{n.tempo}</Text>
            </Card>
          ))}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { ...LC.coluna, padding: 16, paddingBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  titulo: { fontSize: 14, fontWeight: '600', color: LC.textPrimary, lineHeight: 20 },
  sub: { fontSize: 12, color: LC.textMuted, marginTop: 2 },
  tempo: { fontSize: 11, color: LC.textMuted, alignSelf: 'flex-start', marginTop: 2 },
});
