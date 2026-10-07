import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LC } from '../constants/theme';
import { STUDIO_NOME } from '../constants/app';
import { iconePorModalidade, nomeModalidade } from '../constants/assets';
import { TabBar } from '../components/tab-bar';
import { Icon } from '../components/ui/icon';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { InfoModal } from '../components/ui/modal';
import { EmptyState } from '../components/ui/states';
import { Toque } from '../components/ui/motion';
import { EsqueletoLista } from '../components/ui/esqueleto';
import { CelebracaoAula } from '../components/celebracao-aula';
import { useModalidades } from '../services/modalidades/modalidades.queries';
import { useVagas } from '../services/horarios/horarios.queries';
import { useCriarAgendamento } from '../services/agendamentos/agendamentos.mutations';
import { useMeusAgendamentos } from '../services/agendamentos/agendamentos.queries';
import { useMeusCreditos, useSaldoCreditos } from '../services/creditos/creditos.queries';
import { useDiasFechados } from '../services/dias-fechados/dias-fechados.queries';
import type { Modalidade } from '../services/agendamentos/agendamentos.types';
import type { HorarioVaga } from '../services/horarios/horarios.types';
import { getProximosDiasUteis, formatDate } from '../services/date';
import { ApiError } from '../services/http';
import { limiteCancelamento, podeCancelar } from '../services/cancelamento';

type Dia = ReturnType<typeof getProximosDiasUteis>[number];

export default function Agendamento() {
  const dias = useMemo(() => getProximosDiasUteis(14), []);
  const modalidades = useModalidades();
  const [modalSel, setModalSel] = useState<Modalidade | null>(null);
  const [diaSel, setDiaSel] = useState<Dia>(dias[0]);
  const [detalhe, setDetalhe] = useState<HorarioVaga | null>(null);
  const [sucesso, setSucesso] = useState<
    { modalidade: string; quando: string; hora: string; reposicao: boolean } | null
  >(null);
  const [erroAg, setErroAg] = useState<string | null>(null);
  const criar = useCriarAgendamento();
  /**
   * Crédito que vale NO DIA DA AULA escolhida, não só hoje — o servidor
   * recusa reposição numa data depois do vencimento do crédito (o termo dá
   * 30 dias a partir da aula cancelada). Contar todos os créditos válidos
   * oferecia o botão numa terça em que nenhum deles servia mais.
   */
  const creditos = useMeusCreditos();
  const validos = (creditos.data ?? []).filter((c) => c.status === 'VALIDO');
  const inicioDoDia = (data: string) => new Date(`${data}T00:00:00`).getTime();
  const creditosParaODia = (data: string) => validos.filter((c) => new Date(c.expiraEm).getTime() >= inicioDoDia(data)).length;
  /**
   * Último dia em que algum crédito ainda vale — para dizer "vale até 14/10".
   * Vira `Date` antes de formatar: o crédito vence às 23:59 daqui, que em UTC
   * já é o dia seguinte, e formatar o texto ISO mostraria um dia a mais.
   */
  /**
   * Quantas reposições ainda dá para MARCAR (termo: 3 a cada 30 dias). O
   * botão mostrava só os créditos guardados — "(13)" — e o servidor recusava
   * a 4ª. Sem a resposta ainda, não limita: quem decide é o servidor.
   */
  const saldo = useSaldoCreditos();
  const reposicoesRestantes = saldo.data?.reposicoesRestantes;
  const ultimoDiaDeCredito = validos.reduce<Date | null>((maior, c) => {
    const d = new Date(c.expiraEm);
    return !maior || d.getTime() > maior.getTime() ? d : maior;
  }, null);

  useEffect(() => {
    if (!modalSel && modalidades.data?.length) setModalSel(modalidades.data[0]);
  }, [modalidades.data, modalSel]);

  /**
   * Feriado e recesso: o dia aparece, mas fechado — com o motivo. Esconder o
   * dia da régua faria o aluno achar que a agenda quebrou; mostrar as turmas
   * levaria a um "não foi possível agendar" a cada toque.
   */
  const fechados = useDiasFechados(dias[0]?.data, dias[dias.length - 1]?.data);
  const motivoFechado = (data?: string) => (fechados.data ?? []).find((f) => f.data === data)?.motivo ?? null;
  const fechadoHoje = motivoFechado(diaSel?.data);

  const vagas = useVagas(modalSel?.id, diaSel?.data);
  const horariosDoDia = (vagas.data ?? []).filter((h) => h.diaSemana === diaSel?.diaSemana);

  /**
   * Aula que já começou não pode ser marcada — o servidor recusa, e a tela
   * não deve oferecer o que ele recusa. Sem isto, quem abrisse o app às 9h
   * via "Agendar" na aula das 7h e levava um erro no rosto.
   */
  const jaComecou = (horario: { horaInicio: string }) => {
    if (!diaSel?.data) return false;
    const [h, m] = horario.horaInicio.split(':').map(Number);
    const inicio = new Date(`${diaSel.data}T00:00:00`);
    inicio.setHours(h, m, 0, 0);
    return inicio.getTime() <= Date.now();
  };

  // Aulas que a aluna já tem agendadas (para marcar "Agendada" nos slots)
  const meus = useMeusAgendamentos();
  const jaAgendado = (horarioId: string) =>
    (meus.data ?? []).some((a) => a.horarioId === horarioId && a.dataAula.startsWith(diaSel?.data ?? '—'));

  const agendar = (horario: HorarioVaga, usarCredito = false) => {
    criar.mutate(
      { horarioId: horario.id, dataAula: diaSel.data, usarCredito },
      {
        onSuccess: () => {
          setDetalhe(null);
          setSucesso({
            modalidade: nomeModalidade(horario.modalidade.nome),
            // "Segunda-feira, 31/08" — na comemoração cabe o nome inteiro,
            // e ler o dia por extenso confirma melhor do que "seg, 31".
            quando: formatDate(diaSel.data, 'dddd, DD/MM'),
            hora: horario.horaInicio,
            reposicao: usarCredito,
          });
        },
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : 'Não foi possível agendar.';
          // Cota da semana cheia, mas com crédito que serve neste dia: a saída
          // está no botão de baixo, e a mensagem aponta para ela.
          const dica =
            !usarCredito && /^Limite semanal/.test(msg) && creditosParaODia(diaSel.data) > 0
              ? '\n\nVocê tem crédito de reposição que vale para este dia: use o botão "Usar crédito de reposição".'
              : '';
          setErroAg(msg + dica);
        },
      },
    );
  };

  const feedbackModais = (
    <>
      <CelebracaoAula
        visible={!!sucesso}
        modalidade={sucesso?.modalidade ?? ''}
        quando={sucesso?.quando ?? ''}
        hora={sucesso?.hora ?? ''}
        reposicao={sucesso?.reposicao}
        onFechar={() => setSucesso(null)}
        onVerAulas={() => {
          setSucesso(null);
          router.push('/minhas-aulas');
        }}
      />
      <InfoModal visible={!!erroAg} title="Não foi possível agendar" message={erroAg ?? ''} onClose={() => setErroAg(null)} />
    </>
  );

  // ── Detalhes da Aula ───────────────────────────────────────────────
  if (detalhe) {
    const lotado = detalhe.vagas <= 0;
    const minha = jaAgendado(detalhe.id);
    const passou = jaComecou(detalhe) && !minha;
    const creditosDoDia = creditosParaODia(diaSel.data);
    const usaveis = reposicoesRestantes === undefined ? creditosDoDia : Math.min(creditosDoDia, reposicoesRestantes);
    const limiteDeReposicoes = creditosDoDia > 0 && reposicoesRestantes === 0;
    /**
     * Marcar depois do prazo de cancelamento vale, mas a aula não pode mais ser
     * desmarcada e conta como feita (termo, seção 2). Quem marca às 21h a aula
     * das 7h do dia seguinte precisa saber disso ANTES de confirmar.
     */
    const semCancelamento = !minha && !passou && !lotado && !podeCancelar(diaSel.data, detalhe.horaInicio);
    const limite = limiteCancelamento(diaSel.data, detalhe.horaInicio);
    const limiteTexto = `${formatDate(`${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`, 'DD/MM')} às ${String(limite.getHours()).padStart(2, '0')}:00`;
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.detHero}>
          <Pressable style={s.detBack} onPress={() => setDetalhe(null)} hitSlop={8}>
            <Icon name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View style={s.detIconCircle}>
            <Icon name={iconePorModalidade(detalhe.modalidade.nome)} size={30} color="#fff" />
          </View>
        </LinearGradient>

        <View style={s.detSheet}>
          <View style={s.detTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.detHora}>
                {detalhe.horaInicio} às {detalhe.horaFim}
              </Text>
              <Text style={s.detModalidade}>{nomeModalidade(detalhe.modalidade.nome)}</Text>
            </View>
            <Badge label={`${detalhe.vagas}/${detalhe.capacidadeMaxima} vaga${detalhe.vagas === 1 ? '' : 's'}`} variant={lotado ? 'danger' : 'primary'} />
          </View>

          <ScrollView style={s.detBody} showsVerticalScrollIndicator={false}>
            <DetRow label="Horário" value={`${detalhe.horaInicio} - ${detalhe.horaFim}`} />
            <DetRow label="Modalidade" value={nomeModalidade(detalhe.modalidade.nome)} />
            <DetRow label="Local" value={STUDIO_NOME} />
            <DetRow label="Vagas" value={`${detalhe.vagas} de ${detalhe.capacidadeMaxima} ${detalhe.vagas === 1 ? 'disponível' : 'disponíveis'}`} last />
          </ScrollView>

          <View style={s.detBtns}>
            {semCancelamento ? (
              <View style={s.aviso}>
                <Icon name="alert-circle-outline" size={16} color={LC.warningFg} />
                <Text style={s.avisoTexto}>
                  O prazo para cancelar esta aula terminou ({limiteTexto}). Se marcar, ela não poderá ser
                  cancelada e conta como aula feita.
                </Text>
              </View>
            ) : null}
            <Button
              title={
                minha ? 'Você já está nesta aula'
                : passou ? 'Esta aula já começou'
                : lotado ? 'Horário lotado'
                : 'Agendar aula'
              }
              size="lg"
              disabled={lotado || minha || passou}
              loading={criar.isPending && criar.variables?.usarCredito !== true}
              onPress={() => agendar(detalhe)}
            />
            {!lotado && !minha && !passou && limiteDeReposicoes ? (
              <Text style={s.creditoNota}>
                Você já marcou {saldo.data?.maxReposicoes ?? 3} reposições nos últimos 30 dias, que é o limite.
                {saldo.data?.proximaReposicaoEm
                  ? ` A próxima pode ser marcada a partir de ${formatDate(new Date(saldo.data.proximaReposicaoEm), 'DD/MM')}.`
                  : ''}
              </Text>
            ) : !lotado && !minha && !passou && usaveis > 0 ? (
              <Button
                title={`Usar crédito de reposição (${usaveis})`}
                variant="outline"
                size="lg"
                loading={criar.isPending && criar.variables?.usarCredito === true}
                onPress={() => agendar(detalhe, true)}
                leftIcon={<Icon name="ticket-outline" size={18} color={LC.primary} />}
              />
            ) : !lotado && !minha && !passou && validos.length > 0 && ultimoDiaDeCredito ? (
              <Text style={s.creditoNota}>
                Seu crédito de reposição vale para aulas até {formatDate(ultimoDiaDeCredito, 'DD/MM')}.
              </Text>
            ) : null}
          </View>
        </View>
        {feedbackModais}
      </View>
    );
  }

  // ── Agenda ─────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      {/*
        O topo escuro é o que dá profundidade à tela: a lista de aulas flutua
        sobre ele em vez de todos os elementos empatarem no mesmo plano branco.
        A régua de dias fica DENTRO do gradiente porque escolher o dia é o
        primeiro passo — separá-la em outra faixa branca fazia o olho tratar
        as duas coisas como listas irmãs.
      */}
      <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.topo}>
        <View style={s.header}>
          <Text style={s.kicker}>{STUDIO_NOME}</Text>
          <Text style={s.title}>Agenda</Text>
          <Text style={s.subtitle}>Escolha um dia e reserve sua aula</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.daysScroll} contentContainerStyle={s.daysRow}>
          {/*
            Os dias NÃO entram animados. Entravam um a um, apagados e subindo,
            toda vez que a agenda abria, e a dona viu os números "bugarem" e
            depois voltarem ao normal. A régua é navegação, não conteúdo novo:
            tem que estar pronta quando a tela aparece.
          */}
          {dias.map((d) => {
            const sel = diaSel?.data === d.data;
            const fechado = !!motivoFechado(d.data);
            return (
              <Toque
                key={d.data}
                escala={0.93}
                style={[s.dayBtn, fechado && s.dayBtnFechado, sel && s.dayBtnSel]}
                onPress={() => setDiaSel(d)}
                accessibilityLabel={fechado ? `${d.diaNome} ${d.diaNum}, academia fechada` : undefined}
              >
                <Text style={[s.dayNome, sel && s.daySelText]}>{d.diaNome}</Text>
                <Text style={[s.dayNum, sel && s.daySelText, fechado && !sel && s.dayNumFechado]}>{d.diaNum}</Text>
                {fechado ? <Text style={[s.dayFechado, sel && s.dayFechadoSel]}>fechado</Text> : sel && <View style={s.dayPonto} />}
              </Toque>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* Modalidades — já na folha clara, que se sobrepõe ao gradiente */}
      <View style={s.folha}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.modScroll} contentContainerStyle={s.modRow}>
          {modalidades.data?.map((m) => {
            const sel = modalSel?.id === m.id;
            return (
              <Toque key={m.id} escala={0.94} style={[s.modChip, sel && s.modChipSel]} onPress={() => setModalSel(m)}>
                <Icon name={iconePorModalidade(m.nome)} size={15} color={sel ? LC.primary : LC.textSecondary} />
                <Text style={[s.modText, sel && s.modTextSel]}>{nomeModalidade(m.nome)}</Text>
              </Toque>
            );
          })}
        </ScrollView>
      </View>

      {/* Horários */}
      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {fechadoHoje ? (
          <EmptyState
            icon="lock-closed-outline"
            title="Academia fechada neste dia"
            description={`${fechadoHoje}. Não há aulas — escolha outro dia.`}
          />
        ) : vagas.isLoading || modalidades.isLoading ? (
          <EsqueletoLista quantos={4} />
        ) : horariosDoDia.length === 0 ? (
          <EmptyState icon="time-outline" title="Sem horários neste dia" description="Tente outro dia ou modalidade." />
        ) : (
          /*
            A lista NÃO entra animada. Cada horário entrava subindo, um atrás
            do outro, e a barra de lotação enchia e trocava de cor; no
            navegador a animação de entrada ficava sendo reaplicada nos
            horários de baixo, e a dona via a agenda "atualizando" sem parar.
            A lista aparece pronta, com a barra já no tamanho e na cor certos.
          */
          horariosDoDia.map((h) => {
            const lotado = h.vagas <= 0;
            const minha = jaAgendado(h.id);
            const passou = jaComecou(h) && !minha;
            /**
             * A barra de lotação: 3 de 4 preenchida conta a mesma coisa que o
             * texto "3/4", só que antes de a aluna ler: bater o olho na lista
             * já mostra onde ainda cabe gente.
             */
            const ocupacao = h.capacidadeMaxima > 0 ? h.agendados / h.capacidadeMaxima : 0;
            const corBarra = lotado ? LC.danger : ocupacao >= 0.75 ? LC.warning : LC.primaryMid;
            return (
              <Toque
                key={h.id}
                style={[s.slot, lotado && !minha && !passou && s.slotLotado, passou && s.slotPassou, minha && s.slotMinha]}
                onPress={() => (passou ? undefined : setDetalhe(h))}
                disabled={passou}
                accessibilityRole="button"
                accessibilityLabel={`${nomeModalidade(h.modalidade.nome)} às ${h.horaInicio}, ${h.agendados} de ${h.capacidadeMaxima}`}
              >
                <View style={s.slotTime}>
                  <Text style={[s.slotHora, (lotado || passou) && !minha && s.mutedText]}>{h.horaInicio}</Text>
                  <Text style={s.slotHoraFim}>{h.horaFim}</Text>
                </View>
                <View style={s.slotInfo}>
                  <Text style={[s.slotModalidade, lotado && !minha && s.mutedText]}>{nomeModalidade(h.modalidade.nome)}</Text>
                  <View style={s.slotMetaRow}>
                    <Icon name="people-outline" size={13} color={lotado && !minha ? LC.danger : LC.textMuted} />
                    <Text style={[s.slotMeta, lotado && !minha && { color: LC.danger }]}>
                      {h.agendados}/{h.capacidadeMaxima}
                    </Text>
                    <Text style={s.slotStudio}>
                      {lotado ? 'sem vaga' : `${h.vagas} ${h.vagas === 1 ? 'vaga' : 'vagas'}`}
                    </Text>
                  </View>
                  {!passou && (
                    <View style={s.slotBarra}>
                      <View style={s.barraFundo}>
                        <View style={[s.barraCheia, { width: `${Math.round(Math.min(1, ocupacao) * 100)}%`, backgroundColor: corBarra }]} />
                      </View>
                    </View>
                  )}
                </View>
                {minha ? (
                  <Badge label="Agendada" variant="success" />
                ) : passou ? (
                  <Badge label="Encerrada" variant="neutral" />
                ) : lotado ? (
                  <Badge label="Lotada" variant="danger" />
                ) : (
                  <Button title="Agendar" size="sm" fullWidth={false} onPress={() => setDetalhe(h)} style={s.slotBtn} />
                )}
              </Toque>
            );
          })
        )}
        <View style={{ height: 8 }} />
      </ScrollView>
      <TabBar />
      {feedbackModais}
    </View>
  );
}

function DetRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.detRow, !last && s.detRowBorder]}>
      <Text style={s.detKey}>{label}</Text>
      <Text style={s.detVal}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },

  // ── Topo escuro ───────────────────────────────────────────────────
  topo: { paddingBottom: 34 },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 16 },
  /**
   * O nome do estúdio em maiúsculas pequenas com bastante espaçamento. É o
   * detalhe que separa "app de sistema" de "app de marca" — custa uma linha
   * e muda o tom da tela inteira.
   */
  kicker: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.8 },
  subtitle: { fontSize: 14.5, color: 'rgba(255,255,255,0.72)', marginTop: 4 },

  /**
   * Altura explícita: um ScrollView horizontal dentro do gradiente não herda
   * altura nenhuma e colapsa — no navegador a régua de dias aparecia cortada
   * pela metade, com a folha branca por cima.
   */
  daysScroll: { flexGrow: 0, height: 84, ...LC.coluna },
  daysRow: { paddingHorizontal: 20, gap: 9, paddingVertical: 4, alignItems: 'flex-start' },
  dayBtn: {
    alignItems: 'center', height: 72, justifyContent: 'center',
    paddingHorizontal: 13, borderRadius: LC.radius.lg, minWidth: 58,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  dayBtnSel: { backgroundColor: '#fff', borderColor: '#fff' },
  dayBtnFechado: { backgroundColor: 'rgba(255,255,255,0.04)', borderStyle: 'dashed' },
  dayNumFechado: { color: 'rgba(255,255,255,0.45)', textDecorationLine: 'line-through' },
  dayFechado: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.6)', marginTop: 3, textTransform: 'uppercase' },
  dayFechadoSel: { color: LC.textMuted },
  dayNome: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.68)', marginBottom: 5,
  },
  dayNum: { fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  daySelText: { color: LC.primaryDark },
  /** Pontinho embaixo do dia escolhido — confirma a seleção sem depender só da cor. */
  dayPonto: { width: 4, height: 4, borderRadius: 2, backgroundColor: LC.primary, marginTop: 5 },

  // ── Folha clara sobre o gradiente ─────────────────────────────────
  folha: {
    flexGrow: 0,
    backgroundColor: LC.bg,
    marginTop: -22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 6,
  },
  modScroll: { flexGrow: 0, ...LC.coluna },
  modRow: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  modChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 9, borderRadius: LC.radius.full, backgroundColor: LC.bgCard, borderWidth: 1.5, borderColor: LC.border },
  modChipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  modText: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
  modTextSel: { color: LC.primary },

  list: { flex: 1 },
  listContent: { ...LC.coluna, paddingHorizontal: 18, paddingTop: 2 },
  slot: {
    backgroundColor: LC.bgCard, borderRadius: LC.radius.xl,
    borderWidth: 1, borderColor: LC.border,
    padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...LC.shadowCard,
  },
  slotBarra: { marginTop: 9, marginRight: 4 },
  barraFundo: { height: 5, borderRadius: 5, backgroundColor: LC.neutralBg, overflow: 'hidden' },
  barraCheia: { height: 5, borderRadius: 5 },
  slotLotado: { backgroundColor: LC.dangerBg, opacity: 0.75 },
  // Aula encerrada não é problema, é passado: cinza, e não o vermelho de
  // lotada — senão o aluno lê "encheu" onde deveria ler "já aconteceu".
  slotPassou: { backgroundColor: LC.neutralBg, opacity: 0.6 },
  slotMinha: { borderColor: LC.success, borderWidth: 1.5 },
  slotTime: { alignItems: 'center', minWidth: 54, borderRightWidth: 1, borderRightColor: LC.border, paddingRight: 14 },
  slotHora: { fontSize: 17, fontWeight: '800', color: LC.textPrimary, letterSpacing: -0.4 },
  slotHoraFim: { fontSize: 11, color: LC.textMuted, marginTop: 1 },
  slotInfo: { flex: 1 },
  slotModalidade: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  slotMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  slotMeta: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },
  slotStudio: { fontSize: 11.5, color: LC.textMuted, marginLeft: 4 },
  slotBtn: { paddingHorizontal: 16 },
  mutedText: { color: LC.textMuted },
  pressed: { opacity: 0.85 },
  // Detalhe
  detHero: { height: 200, paddingTop: 52, alignItems: 'center', justifyContent: 'center' },
  detBack: { position: 'absolute', top: 52, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  detIconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  detSheet: { flex: 1, backgroundColor: LC.bg, marginTop: -24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 24 },
  detTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  detHora: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  detModalidade: { fontSize: 15, color: LC.textSecondary, marginTop: 2 },
  detBody: { flex: 1, marginTop: 8 },
  detRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  detRowBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  detKey: { fontSize: 14, color: LC.textSecondary },
  detVal: { fontSize: 14, fontWeight: '700', color: LC.textPrimary, flexShrink: 1, textAlign: 'right' },
  detBtns: { marginVertical: 16, gap: 10 },
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: LC.warningBg, borderRadius: 12, padding: 12,
  },
  avisoTexto: { flex: 1, fontSize: 13, lineHeight: 19, color: LC.warningFg, fontWeight: '600' },
  creditoNota: { fontSize: 12.5, color: LC.textSecondary, textAlign: 'center' },
  modalMsg: { fontSize: 15, color: LC.textPrimary, marginBottom: 18, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 10 },
});
