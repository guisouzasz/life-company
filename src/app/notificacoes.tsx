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

  const notificacoes = useMemo<Notificacao[]>(() => {
    const lista: Notificacao[] = [];

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
  }, [meus.data, saldo.data]);

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
  scroll: { padding: 16, paddingBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  titulo: { fontSize: 14, fontWeight: '600', color: LC.textPrimary, lineHeight: 20 },
  sub: { fontSize: 12, color: LC.textMuted, marginTop: 2 },
  tempo: { fontSize: 11, color: LC.textMuted, alignSelf: 'flex-start', marginTop: 2 },
});
