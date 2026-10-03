import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { corPorModalidade, iconePorModalidade, nomeModalidade } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Button } from '../../components/ui/button';
import { Loading, ErrorState } from '../../components/ui/states';
import { Input } from '../../components/ui/input';
import { useFecharDia, useReabrirDia } from '../../services/dias-fechados/dias-fechados.queries';
import { ApiError } from '../../services/http';
import { AlunosHorarioModal, type HorarioDoModal } from '../../components/admin/alunos-horario-modal';
import { useGradeDaSemana } from '../../services/horarios/horarios.queries';
import type { AulaNaGrade, DiaDaSemana } from '../../services/horarios/horarios.types';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { addDays, formatDate } from '../../services/date';
import { nomeCurto } from '../../services/nome';

const DIAS_CURTO: Record<string, string> = {
  SEGUNDA: 'Seg', TERCA: 'Ter', QUARTA: 'Qua', QUINTA: 'Qui', SEXTA: 'Sex',
};

/** Hoje no fuso do estúdio, no mesmo formato que a API devolve. */
const hojeISO = () => formatDate(new Date(), 'YYYY-MM-DD');

/**
 * A semana do estúdio numa tela só: segunda a sexta, cada turma com quem
 * está dentro, e o estúdio podendo colocar alguém ali mesmo.
 *
 * A tela de Horários continua sendo a da GRADE — criar, editar e desativar
 * turmas. Esta é a do DIA A DIA: quem está na quinta às 19h, onde sobrou
 * vaga, e quem entra. Antes só dava para responder isso abrindo turma por
 * turma, e só para a próxima ocorrência de cada uma.
 *
 * Regras não mudam por estar aqui: quem barra lotação e limite semanal do
 * plano é a API (POST /agendamentos/admin), a mesma que a tela de Horários
 * usa. Esta tela só facilita chegar até lá.
 */
export default function AdminAgenda() {
  const isDesktop = useIsDesktop();
  /** undefined = semana corrente; a API ancora na segunda de qualquer data. */
  const [inicio, setInicio] = useState<string | undefined>(undefined);
  const grade = useGradeDaSemana(inicio);
  const [modalidadeSel, setModalidadeSel] = useState<string>('');
  const [diaSel, setDiaSel] = useState<string>(hojeISO());
  const [aberto, setAberto] = useState<{ horario: HorarioDoModal; data: string } | null>(null);

  const hoje = hojeISO();

  // ── Fechar o dia (feriado, recesso) ────────────────────────────────
  /**
   * Inline, e não num modal: a confirmação precisa explicar o que acontece
   * com as aulas marcadas, e um modal por cima da tela de turmas já deu
   * problema de aparecer por trás no navegador.
   */
  const fecharDia = useFecharDia();
  const reabrirDia = useReabrirDia();
  const [fechando, setFechando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('Feriado');
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  /** "Seg 12/10" a partir da data — sem depender da grade, que vem mais abaixo. */
  const dataCurta = (data: string) =>
    `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(`${data}T12:00:00`).getDay()]} ${formatDate(data, 'DD/MM')}`;

  const confirmarFechamento = () => {
    if (!fechando) return;
    fecharDia.mutate(
      { data: fechando, motivo: motivo.trim() || 'Feriado' },
      {
        onSuccess: (r) => {
          setFechando(null);
          setAviso({ texto: r.mensagem });
        },
        onError: (e) => setAviso({ texto: e instanceof ApiError ? e.message : 'Não foi possível fechar o dia.', erro: true }),
      },
    );
  };

  const reabrir = (dia: DiaDaSemana) => {
    if (!dia.fechado) return;
    reabrirDia.mutate(dia.fechado.id, {
      onSuccess: (r) => setAviso({ texto: r.mensagem }),
      onError: (e) => setAviso({ texto: e instanceof ApiError ? e.message : 'Não foi possível reabrir o dia.', erro: true }),
    });
  };

  const BannerFechado = ({ dia }: { dia: DiaDaSemana }) =>
    dia.fechado ? (
      <View style={s.fechadoBanner}>
        <Icon name="lock-closed" size={16} color={LC.warningFg} />
        <View style={{ flex: 1 }}>
          <Text style={s.fechadoTitulo}>Academia fechada</Text>
          <Text style={s.fechadoMotivo}>{dia.fechado.motivo}</Text>
        </View>
        {dia.data >= hoje ? (
          <Pressable
            style={s.reabrirBtn}
            onPress={() => reabrir(dia)}
            disabled={reabrirDia.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Reabrir ${dataCurta(dia.data)}`}
          >
            <Text style={s.reabrirTexto}>{reabrirDia.isPending ? 'Reabrindo…' : 'Reabrir'}</Text>
          </Pressable>
        ) : null}
      </View>
    ) : null;

  const BotaoFechar = ({ dia }: { dia: DiaDaSemana }) =>
    !dia.fechado && dia.data >= hoje && fechando !== dia.data ? (
      <Pressable
        style={s.fecharLink}
        onPress={() => {
          setAviso(null);
          setMotivo('Feriado');
          setFechando(dia.data);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Fechar ${dataCurta(dia.data)}`}
      >
        <Icon name="lock-closed-outline" size={14} color={LC.textSecondary} />
        <Text style={s.fecharLinkTexto}>Fechar este dia (feriado, recesso)</Text>
      </Pressable>
    ) : null;

  const formularioFechar = fechando ? (
    <Card style={s.fecharCard} padding={16}>
      <Text style={s.fecharTitulo}>Fechar {dataCurta(fechando)}</Text>
      <Text style={s.fecharTexto}>
        Ninguém consegue marcar aula nesse dia. As aulas já marcadas saem da agenda e contam como dadas na
        semana de cada aluno, sem crédito de reposição. Quem marcou reposição nesse dia recebe o crédito de volta.
      </Text>
      <View style={s.motivos}>
        {['Feriado', 'Recesso', 'Manutenção'].map((m) => (
          <Pressable key={m} style={[s.chip, motivo === m && s.chipSel]} onPress={() => setMotivo(m)}>
            <Text style={[s.chipTexto, motivo === m && s.chipTextoSel]}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <Input label="Motivo (aparece para os alunos)" value={motivo} onChangeText={setMotivo} maxLength={60} placeholder="Feriado de N. Sra. Aparecida" />
      <View style={s.fecharBotoes}>
        <Button title="Voltar" variant="outline" size="sm" fullWidth={false} onPress={() => setFechando(null)} />
        <Button title="Fechar o dia" variant="danger" size="sm" fullWidth={false} loading={fecharDia.isPending} onPress={confirmarFechamento} />
      </View>
    </Card>
  ) : null;

  const avisoNaTela = aviso ? (
    <Pressable style={[s.avisoDia, aviso.erro && s.avisoDiaErro]} onPress={() => setAviso(null)} accessibilityRole="button" accessibilityLabel="Fechar aviso">
      <Icon name={aviso.erro ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={16} color={aviso.erro ? LC.danger : LC.success} />
      <Text style={s.avisoDiaTexto}>{aviso.texto}</Text>
      <Icon name="close" size={14} color={LC.textMuted} />
    </Pressable>
  ) : null;

  const modalidades = useMemo(() => {
    const vistas = new Map<string, string>();
    grade.data?.dias.forEach((d) =>
      d.aulas.forEach((a) => vistas.set(a.modalidade.nome, a.modalidade.nome)),
    );
    return [...vistas.keys()].sort();
  }, [grade.data]);

  const dias = useMemo(() => {
    const todos = grade.data?.dias ?? [];
    if (!modalidadeSel) return todos;
    return todos.map((d) => ({ ...d, aulas: d.aulas.filter((a) => a.modalidade.nome === modalidadeSel) }));
  }, [grade.data, modalidadeSel]);

  /**
   * No celular a semana inteira não cabe lado a lado, então a grade vira
   * "escolha o dia". O dia escolhido acompanha a semana que está na tela: ao
   * avançar a semana, cai na segunda dela em vez de sumir da lista.
   */
  const diaAberto = dias.find((d) => d.data === diaSel) ?? dias[0];

  const irParaSemana = (delta: number) => {
    const base = grade.data?.inicio ?? hoje;
    const nova = formatDate(addDays(new Date(`${base}T12:00:00`), delta * 7), 'YYYY-MM-DD');
    setInicio(nova);
    setDiaSel(nova);
  };

  const irParaHoje = () => {
    setInicio(undefined);
    setDiaSel(hoje);
  };

  const periodo = grade.data
    ? `${formatDate(grade.data.inicio, 'DD/MM')} a ${formatDate(grade.data.fim, 'DD/MM')}`
    : '';
  const ehSemanaAtual = !!grade.data && grade.data.inicio <= hoje && hoje <= grade.data.fim;

  const abrir = (dia: DiaDaSemana, aula: AulaNaGrade) =>
    setAberto({
      data: dia.data,
      horario: {
        id: aula.horarioId,
        diaSemana: dia.diaSemana,
        horaInicio: aula.horaInicio,
        modalidade: { nome: aula.modalidade.nome },
        capacidadeMaxima: aula.capacidade,
      },
    });

  // ── Cartão de uma turma ────────────────────────────────────────────
  const CardDaAula = ({ dia, aula }: { dia: DiaDaSemana; aula: AulaNaGrade }) => {
    const cor = corPorModalidade(aula.modalidade.nome);
    const lotada = aula.vagas === 0;
    const passou = dia.data < hoje;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${nomeModalidade(aula.modalidade.nome)} ${DIAS_CURTO[dia.diaSemana]} ${aula.horaInicio}, ${aula.alunos.length} de ${aula.capacidade} alunos`}
        onPress={() => abrir(dia, aula)}
        style={({ pressed }) => [pressed && s.pressed]}
      >
        <Card style={[s.aulaCard, { borderLeftColor: cor }, passou && s.aulaPassada]} padding={11}>
          <View style={s.aulaTopo}>
            <Text style={s.aulaHora}>{aula.horaInicio}</Text>
            <View style={[s.contador, lotada ? s.contadorCheio : null]}>
              <Text style={[s.contadorTexto, lotada ? s.contadorTextoCheio : null]}>
                {aula.alunos.length}/{aula.capacidade}
              </Text>
            </View>
          </View>
          <View style={s.aulaModLinha}>
            <Icon name={iconePorModalidade(aula.modalidade.nome)} size={12} color={cor} />
            <Text style={[s.aulaMod, { color: cor }]} numberOfLines={1}>
              {nomeModalidade(aula.modalidade.nome)}
            </Text>
          </View>

          {aula.alunos.length === 0 ? (
            <Text style={s.semAlunos}>Ninguém agendado</Text>
          ) : (
            <View style={s.nomes}>
              {aula.alunos.map((al) => (
                <Text key={al.agendamentoId} style={s.nome} numberOfLines={1}>
                  {nomeCurto(al.nome)}
                  {al.reposicao ? ' ·rep' : ''}
                </Text>
              ))}
            </View>
          )}

          {/* Vaga livre é o que a dona procura na tela: fica dito, não subentendido. */}
          {!passou && aula.vagas > 0 ? (
            <View style={s.vagaLinha}>
              <Icon name="add-circle-outline" size={13} color={LC.primary} />
              <Text style={s.vagaTexto}>
                {aula.vagas} {aula.vagas === 1 ? 'vaga' : 'vagas'}
              </Text>
            </View>
          ) : null}
        </Card>
      </Pressable>
    );
  };

  const ColunaDoDia = ({ dia }: { dia: DiaDaSemana }) => {
    const ehHoje = dia.data === hoje;
    const passou = dia.data < hoje;
    return (
      <View style={[s.coluna, passou && s.colunaPassada]}>
        <View style={[s.colunaCabeca, ehHoje && s.colunaCabecaHoje]}>
          <Text style={[s.colunaDia, ehHoje && s.colunaDiaHoje]}>{DIAS_CURTO[dia.diaSemana]}</Text>
          <Text style={[s.colunaData, ehHoje && s.colunaDataHoje]}>{formatDate(dia.data, 'DD/MM')}</Text>
        </View>
        {dia.fechado ? (
          <BannerFechado dia={dia} />
        ) : dia.aulas.length === 0 ? (
          <Text style={s.colunaVazia}>Sem aulas</Text>
        ) : (
          dia.aulas.map((a) => <CardDaAula key={a.horarioId} dia={dia} aula={a} />)
        )}
        <BotaoFechar dia={dia} />
      </View>
    );
  };

  const filtros =
    modalidades.length > 1 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={isDesktop ? s.filtros : s.filtrosMobile}
        contentContainerStyle={s.filtrosConteudo}
      >
        <Pressable style={[s.chip, !modalidadeSel && s.chipSel]} onPress={() => setModalidadeSel('')}>
          <Text style={[s.chipTexto, !modalidadeSel && s.chipTextoSel]}>Todas</Text>
        </Pressable>
        {modalidades.map((m) => {
          const sel = modalidadeSel === m;
          const cor = corPorModalidade(m);
          return (
            <Pressable
              key={m}
              style={[s.chip, sel && { backgroundColor: cor + '1A', borderColor: cor }]}
              onPress={() => setModalidadeSel(sel ? '' : m)}
            >
              <Text style={[s.chipTexto, sel && { color: cor, fontWeight: '700' }]}>{nomeModalidade(m)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    ) : null;

  const cabecalho = (
    <View style={isDesktop ? s.deskHeader : s.header}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Agenda da semana</Text>
          <Text style={s.subtitle}>
            {periodo}
            {ehSemanaAtual ? ' • semana atual' : ''}
          </Text>
        </View>
        {/*
          No celular este botão ficava no fim da rolagem, depois de todas as
          aulas do dia. Para trocar a grade a dona tinha que descer a tela
          inteira e caçar — num dia cheio são vários rolares. Aqui em cima ele
          está sempre à vista, no mesmo lugar em que já estava no computador.
        */}
        {isDesktop ? (
          <Button
            title="Gerenciar horários"
            size="sm"
            variant="outline"
            fullWidth={false}
            leftIcon={<Icon name="options-outline" size={15} color={LC.primary} />}
            onPress={() => router.replace('/admin/horarios')}
          />
        ) : (
          <Pressable
            style={s.gerenciarTopo}
            onPress={() => router.replace('/admin/horarios')}
            accessibilityRole="button"
            accessibilityLabel="Gerenciar horários"
            hitSlop={8}
          >
            <Icon name="options-outline" size={15} color={LC.primary} />
            <Text style={s.gerenciarTopoTexto}>Horários</Text>
          </Pressable>
        )}
      </View>

      <View style={s.navSemana}>
        <Pressable
          style={s.navBtn}
          onPress={() => irParaSemana(-1)}
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
        >
          <Icon name="chevron-back" size={18} color={LC.textPrimary} />
        </Pressable>
        <Pressable
          style={[s.hojeBtn, ehSemanaAtual && s.hojeBtnAtivo]}
          onPress={irParaHoje}
          accessibilityRole="button"
        >
          <Text style={[s.hojeTexto, ehSemanaAtual && s.hojeTextoAtivo]}>Hoje</Text>
        </Pressable>
        <Pressable
          style={s.navBtn}
          onPress={() => irParaSemana(1)}
          accessibilityRole="button"
          accessibilityLabel="Próxima semana"
        >
          <Icon name="chevron-forward" size={18} color={LC.textPrimary} />
        </Pressable>

        {/* No desktop os filtros cabem ao lado da navegação; no celular a
            linha ficaria espremida e os chips sairiam da tela pela metade. */}
        {isDesktop ? filtros : null}
      </View>
      {!isDesktop ? filtros : null}
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      {cabecalho}

      {grade.isLoading ? (
        <Loading />
      ) : grade.isError ? (
        <ErrorState onRetry={() => grade.refetch()} />
      ) : isDesktop ? (
        // ── Desktop: a semana inteira lado a lado ────────────────────
        <ScrollView contentContainerStyle={s.deskScroll} showsVerticalScrollIndicator={false}>
          {avisoNaTela}
          {formularioFechar}
          <View style={s.grade}>
            {dias.map((d) => (
              <ColunaDoDia key={d.data} dia={d} />
            ))}
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      ) : (
        // ── Celular: cinco colunas não cabem; escolhe-se o dia ───────
        <>
          <View style={s.diasChips}>
            {dias.map((d) => {
              const sel = diaAberto?.data === d.data;
              const ehHoje = d.data === hoje;
              const total = d.aulas.reduce((n, a) => n + a.alunos.length, 0);
              return (
                <Pressable
                  key={d.data}
                  style={[s.diaChip, sel && s.diaChipSel]}
                  onPress={() => setDiaSel(d.data)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                >
                  <Text style={[s.diaChipDia, sel && s.diaChipDiaSel, ehHoje && !sel && s.diaChipHoje]}>
                    {DIAS_CURTO[d.diaSemana]}
                  </Text>
                  <Text style={[s.diaChipData, sel && s.diaChipDataSel]}>{formatDate(d.data, 'DD')}</Text>
                  {d.fechado ? (
                    <Icon name="lock-closed" size={9} color={sel ? '#fff' : LC.warningFg} />
                  ) : total > 0 ? (
                    <View style={[s.diaChipPonto, sel && s.diaChipPontoSel]} />
                  ) : (
                    <View style={s.diaChipPontoVazio} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {avisoNaTela}
            {diaAberto && fechando === diaAberto.data ? formularioFechar : null}
            {diaAberto?.fechado ? (
              <BannerFechado dia={diaAberto} />
            ) : !diaAberto || diaAberto.aulas.length === 0 ? (
              <Text style={s.colunaVazia}>Sem aulas neste dia.</Text>
            ) : (
              diaAberto.aulas.map((a) => <CardDaAula key={a.horarioId} dia={diaAberto} aula={a} />)
            )}
            {diaAberto ? <BotaoFechar dia={diaAberto} /> : null}
            <View style={{ height: 90 }} />
          </ScrollView>
        </>
      )}

      {!isDesktop && <TabBar isAdmin />}

      <AlunosHorarioModal
        horario={aberto?.horario ?? null}
        data={aberto?.data}
        onClose={() => setAberto(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  // Dia fechado
  fechadoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12,
    backgroundColor: LC.warningBg, marginBottom: 10,
  },
  fechadoTitulo: { fontSize: 13.5, fontWeight: '800', color: LC.warningFg },
  fechadoMotivo: { fontSize: 12.5, color: LC.textPrimary, marginTop: 1 },
  reabrirBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: LC.radius.full, backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border },
  reabrirTexto: { fontSize: 12.5, fontWeight: '800', color: LC.primary },
  fecharLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 4 },
  fecharLinkTexto: { fontSize: 12.5, fontWeight: '700', color: LC.textSecondary, textDecorationLine: 'underline' },
  fecharCard: { marginBottom: 12, borderWidth: 1.5, borderColor: LC.warning, gap: 10 },
  fecharTitulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  fecharTexto: { fontSize: 13, lineHeight: 19, color: LC.textSecondary },
  motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fecharBotoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  avisoDia: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12,
    backgroundColor: LC.successBg, marginBottom: 12,
  },
  avisoDiaErro: { backgroundColor: LC.dangerBg },
  avisoDiaTexto: { flex: 1, fontSize: 13, lineHeight: 18, color: LC.textPrimary, fontWeight: '600' },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  deskHeader: { paddingTop: 24, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingTop: 4 },
  deskScroll: { paddingBottom: 16 },
  pressed: { opacity: 0.85 },

  // ── Navegação de semana ─────────────────────────────────────────
  navSemana: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  navBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  hojeBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: LC.radius.full,
    backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border,
  },
  hojeBtnAtivo: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  hojeTexto: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  hojeTextoAtivo: { color: LC.primary, fontWeight: '700' },
  filtros: { flex: 1, marginLeft: 4 },
  filtrosMobile: { maxHeight: 44, marginTop: 10, paddingHorizontal: 16 },
  filtrosConteudo: { gap: 8, alignItems: 'center', paddingRight: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: LC.radius.full,
    backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border,
  },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipTexto: { fontSize: 12.5, fontWeight: '600', color: LC.textSecondary },
  chipTextoSel: { color: LC.primary, fontWeight: '700' },

  // ── Grade desktop ───────────────────────────────────────────────
  grade: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  coluna: { flex: 1, minWidth: 150, gap: 8 },
  colunaPassada: { opacity: 0.6 },
  colunaCabeca: {
    alignItems: 'center', paddingVertical: 8, borderRadius: LC.radius.md,
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
  },
  colunaCabecaHoje: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  colunaDia: { fontSize: 13, fontWeight: '800', color: LC.textPrimary },
  colunaDiaHoje: { color: LC.primary },
  colunaData: { fontSize: 11.5, color: LC.textSecondary, marginTop: 1 },
  colunaDataHoje: { color: LC.primary },
  colunaVazia: { fontSize: 12.5, color: LC.textMuted, textAlign: 'center', paddingVertical: 14 },

  // ── Cartão da turma ─────────────────────────────────────────────
  aulaCard: { borderLeftWidth: 3, marginBottom: 0 },
  aulaPassada: { opacity: 0.75 },
  aulaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  aulaHora: { fontSize: 14.5, fontWeight: '800', color: LC.textPrimary },
  contador: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: LC.radius.full,
    backgroundColor: LC.neutralBg,
  },
  contadorCheio: { backgroundColor: LC.dangerBg },
  contadorTexto: { fontSize: 11, fontWeight: '800', color: LC.textSecondary },
  contadorTextoCheio: { color: LC.dangerFg },
  aulaModLinha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  aulaMod: { fontSize: 11.5, fontWeight: '700' },
  nomes: { marginTop: 7, gap: 2 },
  nome: { fontSize: 12, color: LC.textSecondary },
  semAlunos: { fontSize: 11.5, color: LC.textMuted, marginTop: 7, fontStyle: 'italic' },
  vagaLinha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  vagaTexto: { fontSize: 11.5, fontWeight: '700', color: LC.primary },

  // ── Celular: seletor de dia ─────────────────────────────────────
  diasChips: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  diaChip: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: 9, borderRadius: LC.radius.md,
    backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border,
  },
  diaChipSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  diaChipDia: { fontSize: 12, fontWeight: '700', color: LC.textSecondary },
  diaChipDiaSel: { color: '#fff' },
  diaChipHoje: { color: LC.primary },
  diaChipData: { fontSize: 15, fontWeight: '800', color: LC.textPrimary },
  diaChipDataSel: { color: '#fff' },
  diaChipPonto: { width: 5, height: 5, borderRadius: 3, backgroundColor: LC.primary, marginTop: 1 },
  diaChipPontoSel: { backgroundColor: '#fff' },
  diaChipPontoVazio: { width: 5, height: 5, marginTop: 1 },

  /**
   * Atalho para a grade, no cabeçalho do celular. Compacto de propósito: divide
   * a linha com o título "Agenda da semana" e não pode empurrá-lo para baixo.
   */
  gerenciarTopo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: LC.radius.full,
    backgroundColor: LC.primaryLight,
    borderWidth: 1, borderColor: LC.primarySoft,
  },
  gerenciarTopoTexto: { fontSize: 13, fontWeight: '700', color: LC.primary },
});
