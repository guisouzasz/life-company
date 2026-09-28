import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { corPorModalidade, iconePorModalidade, modalidadesDe, nomeModalidade } from '../../constants/assets';
import { useAuthStore } from '../../store/auth';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Badge } from '../../components/ui/badge';
import { AlunosAulaModal } from '../../components/professor/alunos-aula-modal';
import { AulaAgora } from '../../components/professor/aula-agora';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useVagasDia } from '../../services/horarios/horarios.queries';
import { useIsTablet } from '../../hooks/use-is-desktop';
import { useMe } from '../../services/auth/auth.queries';
import type { HorarioVaga } from '../../services/horarios/horarios.types';
import { formatDate, getDiaSemanaKey, getProximosDiasUteis } from '../../services/date';
import { primeiroNome } from '../../services/nome';

type Dia = ReturnType<typeof getProximosDiasUteis>[number];

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

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

  // As modalidades dele viram etiquetas no topo — no título, "Agenda —
  // Musculação e Funcional" quebrava em duas linhas no celular.
  const me = useMe();
  const minhas = modalidadesDe(me.data);
  // A saudação segue o relógio, como a sala: "Boa noite" às 18h.
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  // No tablet a tela inteira acompanha a largura do cartão da aula; senão o
  // título e a lista de aulas ficariam numa coluna estreita ao lado dele.
  const tablet = useIsTablet();
  const largo = tablet ? s.largo : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      {/*
        Uma rolagem só para a tela inteira. A aula de agora cresceu (turma com
        alertas, relógio da aula) e, com a lista de aulas rolando sozinha
        embaixo, ela empurrava a barra de abas para fora da tela do celular.
      */}
      <ScrollView style={s.list} contentContainerStyle={s.pagina} showsVerticalScrollIndicator={false}>
      <View style={[s.header, largo]}>
        <Text style={s.data}>{capitalizar(`${formatDate(new Date(), 'dddd')}, ${formatDate(new Date(), 'DD')} de ${formatDate(new Date(), 'MMMM')}`)}</Text>
        <Text style={s.title}>{saudacao}{nome ? `, ${primeiroNome(nome)}` : ''}</Text>
        {minhas.length > 0 ? (
          <View style={s.modsLinha}>
            {minhas.map((m) => {
              const cor = corPorModalidade(m.nome);
              return (
                <View key={m.id} style={[s.mod, { backgroundColor: cor + '1A' }]}>
                  <Icon name={iconePorModalidade(m.nome)} size={12} color={cor} />
                  <Text style={[s.modTexto, { color: cor }]}>{nomeModalidade(m.nome)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {hojeEhUtil ? <AulaAgora aulasDeHoje={aulasDeHoje} hoje={hoje} /> : null}

      <Text style={[s.secao, largo]}>Agenda da semana</Text>
      {/* Dias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.daysScroll, largo]} contentContainerStyle={s.daysRow}>
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
        <View style={[s.listContent, largo]}>
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
        </View>
      )}
      </ScrollView>

      <TabBar isProfessor />
      <AlunosAulaModal aula={aulaSel} data={diaSel?.data} onClose={() => setAulaSel(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: LC.textPrimary, letterSpacing: -0.3 },
  data: { fontSize: 12.5, fontWeight: '700', color: LC.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  modsLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  mod: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  modTexto: { fontSize: 12, fontWeight: '800' },
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
  list: { flex: 1 },
  pagina: { paddingBottom: 12 },
  secao: {
    ...LC.coluna, paddingHorizontal: 20, marginTop: 14, marginBottom: 8,
    fontSize: 12, fontWeight: '800', color: LC.textMuted, letterSpacing: 0.8, textTransform: 'uppercase',
  },
  listContent: { ...LC.coluna, paddingHorizontal: 16, paddingTop: 6 },
  /** Mesma largura máxima do cartão da aula de agora. */
  largo: { maxWidth: 1000 },
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
