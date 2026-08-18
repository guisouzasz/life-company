import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { corPorModalidade, iconePorModalidade, nomeModalidade } from '../../constants/assets';
import { useAuthStore } from '../../store/auth';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Badge } from '../../components/ui/badge';
import { AlunosAulaModal } from '../../components/professor/alunos-aula-modal';
import { AulaAgora } from '../../components/professor/aula-agora';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useVagasDia } from '../../services/horarios/horarios.queries';
import { useMe } from '../../services/auth/auth.queries';
import type { HorarioVaga } from '../../services/horarios/horarios.types';
import { formatDate, getDiaSemanaKey, getProximosDiasUteis } from '../../services/date';

type Dia = ReturnType<typeof getProximosDiasUteis>[number];

/** Agenda do professor: somente leitura — vê as aulas do dia e os alunos. */
export default function ProfessorAgenda() {
  const nome = useAuthStore((st) => st.nome);
  const dias = useMemo(() => getProximosDiasUteis(10), []);
  const [diaSel, setDiaSel] = useState<Dia>(dias[0]);
  const [aulaSel, setAulaSel] = useState<HorarioVaga | null>(null);

  const vagas = useVagasDia(diaSel?.data);
  const aulasDoDia = (vagas.data ?? [])
    .filter((h) => h.diaSemana === diaSel?.diaSemana)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  // O backend já devolve só a modalidade do professor — usamos para o título
  const minhaModalidade = vagas.data?.[0]?.modalidade?.nome;

  // Aula de agora: sempre a de hoje, independente do dia escolhido acima.
  // No fim de semana `dias[0]` já é a segunda, e aí não há aula de hoje.
  const hoje = formatDate(new Date(), 'YYYY-MM-DD');
  const hojeEhUtil = dias[0]?.data === hoje;
  const vagasHoje = useVagasDia(hojeEhUtil ? hoje : undefined);
  const aulasDeHoje = useMemo(() => {
    if (!hojeEhUtil) return [];
    const chaveHoje = getDiaSemanaKey(new Date());
    return (vagasHoje.data ?? []).filter((h) => h.diaSemana === chaveHoje);
  }, [hojeEhUtil, vagasHoje.data]);

  // Funcional monta um treino por dia para a turma toda; as outras
  // modalidades têm ficha por aluno.
  const me = useMe();
  const porAluno = me.data?.modalidadeProfessor
    ? nomeModalidade(me.data.modalidadeProfessor.nome) !== 'Funcional'
    : true;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Agenda{minhaModalidade ? ` — ${nomeModalidade(minhaModalidade)}` : ''}</Text>
        <Text style={s.subtitle}>Olá, {nome?.split(' ')[0] ?? 'Professor'} — toque numa aula para ver os alunos</Text>
      </View>

      {hojeEhUtil ? <AulaAgora aulasDeHoje={aulasDeHoje} hoje={hoje} porAluno={porAluno} /> : null}

      {/* Dias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.daysScroll} contentContainerStyle={s.daysRow}>
        {dias.map((d) => {
          const sel = diaSel?.data === d.data;
          return (
            <Pressable key={d.data} style={[s.dayBtn, sel && s.dayBtnSel]} onPress={() => setDiaSel(d)}>
              <Text style={[s.dayNome, sel && s.daySelText]}>{d.diaNome}</Text>
              <Text style={[s.dayNum, sel && s.daySelText]}>{d.diaNum}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Aulas do dia */}
      {vagas.isLoading ? (
        <Loading />
      ) : vagas.isError ? (
        <ErrorState onRetry={() => vagas.refetch()} />
      ) : (
        <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
          {aulasDoDia.length === 0 ? (
            <EmptyState icon="calendar-outline" title="Sem aulas neste dia" description="Escolha outro dia acima." />
          ) : (
            aulasDoDia.map((h) => {
              const cor = corPorModalidade(h.modalidade.nome);
              const lotado = h.agendados >= h.capacidadeMaxima;
              const pct = h.capacidadeMaxima > 0 ? Math.min((h.agendados / h.capacidadeMaxima) * 100, 100) : 0;
              return (
                <Pressable key={h.id} accessibilityRole="button" onPress={() => setAulaSel(h)} style={({ pressed }) => [pressed && s.pressed]}>
                  <Card style={s.aulaCard} padding={14}>
                    <View style={[s.aulaIcon, { backgroundColor: cor + '1A' }]}>
                      <Icon name={iconePorModalidade(h.modalidade.nome)} size={18} color={cor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.aulaTopo}>
                        <Text style={s.aulaHora}>{h.horaInicio} – {h.horaFim}</Text>
                        {lotado ? <Badge label="Lotada" variant="danger" /> : null}
                      </View>
                      <Text style={s.aulaModalidade}>{nomeModalidade(h.modalidade.nome)}</Text>
                      <View style={s.aulaTrack}>
                        <View style={[s.aulaFill, { width: `${pct}%` }, lotado && { backgroundColor: LC.danger }]} />
                      </View>
                    </View>
                    <View style={s.aulaVagas}>
                      <Icon name="people-outline" size={14} color={LC.textSecondary} />
                      <Text style={s.aulaVagasText}>{h.agendados}/{h.capacidadeMaxima}</Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}

      <TabBar isProfessor />
      <AlunosAulaModal aula={aulaSel} data={diaSel?.data} onClose={() => setAulaSel(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  daysScroll: { flexGrow: 0, ...LC.coluna },
  daysRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 4, alignItems: 'flex-start' },
  dayBtn: {
    alignItems: 'center', height: 68, justifyContent: 'center', paddingHorizontal: 12,
    borderRadius: LC.radius.md, minWidth: 56, backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
  },
  dayBtnSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  dayNome: { fontSize: 11, fontWeight: '700', color: LC.textSecondary, textTransform: 'capitalize', marginBottom: 4 },
  dayNum: { fontSize: 17, fontWeight: '800', color: LC.textPrimary },
  daySelText: { color: '#fff' },
  list: { flex: 1, marginTop: 6 },
  listContent: { ...LC.coluna, paddingHorizontal: 16, paddingTop: 6 },
  pressed: { opacity: 0.85 },
  aulaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  aulaIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  aulaTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aulaHora: { fontSize: 15, fontWeight: '800', color: LC.textPrimary },
  aulaModalidade: { fontSize: 13, fontWeight: '600', color: LC.textSecondary, marginTop: 1 },
  aulaTrack: { height: 4, borderRadius: 2, backgroundColor: LC.border, overflow: 'hidden', marginTop: 7 },
  aulaFill: { height: '100%', borderRadius: 2, backgroundColor: LC.primary },
  aulaVagas: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  aulaVagasText: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
});
