import { useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../constants/theme';
import { STUDIO_NOME, DIAS_PT, DIAS_VALIDADE_CREDITO } from '../constants/app';
import { iconePorModalidade, nomeModalidade } from '../constants/assets';
import { TabBar } from '../components/tab-bar';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ConfirmModal, InfoModal } from '../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../components/ui/states';
import { useMeusAgendamentos, useMinhasAulasCanceladas, useMinhasAulasEmDiaFechado } from '../services/agendamentos/agendamentos.queries';
import { useCancelarAgendamento } from '../services/agendamentos/agendamentos.mutations';
import type { Agendamento, AulaCancelada } from '../services/agendamentos/agendamentos.types';
import { podeCancelar, prazoLabel } from '../services/cancelamento';
import { ApiError } from '../services/http';
import { formatDate } from '../services/date';

export default function MinhasAulas() {
  const meus = useMeusAgendamentos();
  /**
   * A aula que caiu em feriado/recesso sai da agenda, mas não some da tela:
   * ela conta na semana (regra do estúdio), e sem aparecer aqui o aluno
   * tentaria marcar outra e não entenderia a recusa.
   */
  const emDiaFechado = useMinhasAulasEmDiaFechado();
  const todas = [...(meus.data ?? []), ...(emDiaFechado.data ?? [])].sort(
    (a, b) => a.dataAula.localeCompare(b.dataAula) || a.horario.horaInicio.localeCompare(b.horario.horaInicio),
  );
  /**
   * As que o aluno (ou o estúdio) cancelou, daqui para a frente. Antes elas
   * sumiam: saíam das marcadas e só entravam no histórico quando o dia
   * passava — o aluno cancelava e não tinha onde conferir.
   */
  const canceladas = useMinhasAulasCanceladas();
  const cancelar = useCancelarAgendamento();
  const [alvo, setAlvo] = useState<Agendamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const confirmarCancelamento = () => {
    if (!alvo) return;
    cancelar.mutate(alvo.id, {
      onSuccess: () => setAlvo(null),
      onError: (e) => {
        setAlvo(null);
        setErro(e instanceof ApiError ? e.message : 'Não foi possível cancelar.');
      },
    });
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Minhas aulas</Text>
        <Text style={s.subtitle}>Seus próximos treinos agendados</Text>
      </View>

      {meus.isLoading ? (
        <Loading />
      ) : meus.isError ? (
        <ErrorState onRetry={() => meus.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                meus.refetch();
                emDiaFechado.refetch();
                canceladas.refetch();
              }}
              colors={[LC.primary]}
              tintColor={LC.primary}
            />
          }
        >
          {todas.length > 0 ? (
            todas.map((ag) => {
              if (ag.diaFechado) {
                return (
                  <Card key={ag.id} style={[s.card, s.cardFechado]} padding={16}>
                    <View style={[s.dateBubble, s.dateBubbleFechado]}>
                      <Text style={[s.dateNum, s.dateFechadoTexto]}>{formatDate(ag.dataAula, 'DD')}</Text>
                      <Text style={[s.dateMes, s.dateFechadoTexto]}>{formatDate(ag.dataAula, 'MMM')}</Text>
                    </View>
                    <View style={s.info}>
                      <View style={s.tituloRow}>
                        <Text style={[s.modalidade, s.riscado]}>{nomeModalidade(ag.horario.modalidade.nome)}</Text>
                        <Badge label="Academia fechada" variant="warning" />
                      </View>
                      <Text style={s.infoText}>
                        {DIAS_PT[ag.horario.diaSemana]} • {ag.horario.horaInicio} • {ag.diaFechado.motivo}
                      </Text>
                      <Text style={s.fechadoNota}>Esta aula conta na semana e não gera reposição.</Text>
                    </View>
                  </Card>
                );
              }
              // Reposição não se cancela (Termo de Normas, seção 3) — mostrar
              // o botão só levaria o aluno a um erro vindo da API.
              const liberado = !ag.reposicao && podeCancelar(ag.dataAula, ag.horario.horaInicio);
              return (
                <Card key={ag.id} style={s.card} padding={16}>
                  <View style={s.dateBubble}>
                    <Text style={s.dateNum}>{formatDate(ag.dataAula, 'DD')}</Text>
                    <Text style={s.dateMes}>{formatDate(ag.dataAula, 'MMM')}</Text>
                  </View>
                  <View style={s.info}>
                    <View style={s.tituloRow}>
                      <Text style={s.modalidade}>{nomeModalidade(ag.horario.modalidade.nome)}</Text>
                      {ag.reposicao ? <Badge label="Reposição" variant="info" /> : null}
                    </View>
                    <View style={s.infoLine}>
                      <Icon name="time-outline" size={13} color={LC.textSecondary} />
                      <Text style={s.infoText}>
                        {DIAS_PT[ag.horario.diaSemana]} • {ag.horario.horaInicio} - {ag.horario.horaFim}
                      </Text>
                    </View>
                    <View style={s.infoLine}>
                      <Icon name="location-outline" size={13} color={LC.textMuted} />
                      <Text style={s.infoStudio}>{STUDIO_NOME}</Text>
                    </View>
                  </View>
                  {liberado ? (
                    <Button
                      title="Cancelar"
                      variant="danger-outline"
                      size="sm"
                      fullWidth={false}
                      onPress={() => setAlvo(ag)}
                      loading={cancelar.isPending && cancelar.variables === ag.id}
                      style={s.cancelBtn}
                    />
                  ) : (
                    <View style={s.prazoTag}>
                      <Text style={s.prazoText}>
                        {ag.reposicao ? 'Confirmada' : 'Prazo encerrado'}
                      </Text>
                    </View>
                  )}
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhuma aula agendada"
              description="Reserve seu próximo treino na agenda."
              actionLabel="Ir para a agenda"
              onAction={() => router.push('/agendamento')}
            />
          )}
          {(canceladas.data ?? []).length > 0 ? (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Canceladas</Text>
              <Text style={s.secaoSub}>Não estão marcadas — saem daqui quando o dia passar e ficam no histórico.</Text>
              {canceladas.data!.map((ag) => (
                <CartaoCancelada key={ag.id} ag={ag} />
              ))}
            </View>
          ) : null}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
      <TabBar />

      <ConfirmModal
        visible={!!alvo}
        title="Cancelar aula"
        message={
          alvo
            ? `${nomeModalidade(alvo.horario.modalidade.nome)} • ${formatDate(alvo.dataAula, 'DD/MM')} às ${alvo.horario.horaInicio}.\n${prazoLabel(alvo.dataAula, alvo.horario.horaInicio)}.\n\nCancelando dentro do prazo, você recebe 1 crédito de reposição (válido por ${DIAS_VALIDADE_CREDITO} dias).`
            : ''
        }
        confirmLabel="Cancelar aula"
        cancelLabel="Voltar"
        destructive
        loading={cancelar.isPending}
        onConfirm={confirmarCancelamento}
        onCancel={() => setAlvo(null)}
      />
      <InfoModal visible={!!erro} title="Não foi possível cancelar" message={erro ?? ''} onClose={() => setErro(null)} />
    </View>
  );
}

/** O que dizer debaixo da aula cancelada: quem cancelou e o que virou o crédito. */
function notaDaCancelada(ag: AulaCancelada): string {
  const quem =
    ag.canceladaPor === 'aluno' ? 'Você cancelou' : ag.canceladaPor === 'academia' ? 'Academia fechada' : 'Cancelada pelo estúdio';
  const c = ag.credito;
  if (!c) return `${quem}.`;
  // expiraEm é um instante (fim do dia, no fuso do estúdio), não uma data
  // pura: precisa do new Date, senão o UTC empurra para o dia seguinte.
  if (c.situacao === 'disponivel') return `${quem} • crédito de reposição válido até ${formatDate(new Date(c.expiraEm), 'DD/MM')}`;
  if (c.situacao === 'usado') return `${quem} • o crédito já foi usado em uma reposição`;
  if (c.situacao === 'vencido') return `${quem} • o crédito venceu em ${formatDate(new Date(c.expiraEm), 'DD/MM')}`;
  return `${quem}.`;
}

function CartaoCancelada({ ag }: { ag: AulaCancelada }) {
  return (
    <Card style={[s.card, s.cardCancelada]} padding={16}>
      <View style={[s.dateBubble, s.dateBubbleCancelada]}>
        <Text style={[s.dateNum, s.dateCanceladaTexto]}>{formatDate(ag.dataAula, 'DD')}</Text>
        <Text style={[s.dateMes, s.dateCanceladaTexto]}>{formatDate(ag.dataAula, 'MMM')}</Text>
      </View>
      <View style={s.info}>
        <View style={s.tituloRow}>
          <Text style={[s.modalidade, s.riscado]}>{nomeModalidade(ag.horario.modalidade.nome)}</Text>
          <Badge label="Cancelada" variant="neutral" />
        </View>
        <Text style={s.infoText}>
          {DIAS_PT[ag.horario.diaSemana]} • {formatDate(ag.dataAula, 'DD/MM')} • {ag.horario.horaInicio} - {ag.horario.horaFim}
        </Text>
        <Text style={s.fechadoNota}>{notaDaCancelada(ag)}</Text>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { ...LC.coluna, padding: 16, paddingBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  dateBubble: { width: 52, height: 52, borderRadius: 14, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  dateNum: { fontSize: 18, fontWeight: '800', color: LC.primary, lineHeight: 20 },
  dateMes: { fontSize: 10, fontWeight: '700', color: LC.primary, textTransform: 'uppercase' },
  info: { flex: 1, gap: 3 },
  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  modalidade: { fontSize: 16, fontWeight: '700', color: LC.textPrimary },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: 12, color: LC.textSecondary },
  infoStudio: { fontSize: 12, color: LC.textMuted },
  cancelBtn: { paddingHorizontal: 14 },
  cardFechado: { opacity: 0.85 },
  dateBubbleFechado: { backgroundColor: LC.warningBg },
  dateFechadoTexto: { color: LC.warningFg },
  riscado: { textDecorationLine: 'line-through', color: LC.textSecondary },
  fechadoNota: { fontSize: 11.5, color: LC.textMuted, marginTop: 2 },
  secao: { marginTop: 18 },
  secaoTitulo: { fontSize: 15, fontWeight: '800', color: LC.textPrimary },
  secaoSub: { fontSize: 12, color: LC.textMuted, marginTop: 2, marginBottom: 10 },
  cardCancelada: { opacity: 0.8 },
  dateBubbleCancelada: { backgroundColor: LC.bg },
  dateCanceladaTexto: { color: LC.textMuted },
  prazoTag: { backgroundColor: LC.bg, borderRadius: LC.radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  prazoText: { fontSize: 11, fontWeight: '600', color: LC.textMuted },
});
