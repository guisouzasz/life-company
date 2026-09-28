import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LC } from '../../constants/theme';
import { nomeModalidade, usaTreinoDoDia } from '../../constants/assets';
import { Icon } from '../ui/icon';
import { Avatar } from '../ui/avatar';
import { Loading } from '../ui/states';
import { TreinoAlunoModal, type AlunoDaAula } from './treino-aluno-modal';
import { AdicionarAlunoModal } from './adicionar-aluno-modal';
import { FichaDoAluno } from './ficha-do-aluno';
import { CargaExercicioModal } from './carga-exercicio-modal';
import { AnamneseModal } from './anamnese-modal';
import { useStatusDaTurma, type StatusDoAluno } from './use-turma';
import type { ExercicioAberto } from './ficha-exercicios';
import { useIsTablet } from '../../hooks/use-is-desktop';
import { useAnamneseDoAluno } from '../../services/anamnese/anamnese.queries';
import { useAulaAgora, useMinutoAtual } from '../../hooks/use-aula-agora';
import { useAlunosExtras } from '../../services/aula-extras';
import { useAgendamentosDoHorario } from '../../services/agendamentos/agendamentos.queries';
import type { HorarioVaga } from '../../services/horarios/horarios.types';
import { nomeCurto } from '../../services/nome';

/**
 * A aula que está acontecendo, no topo da tela do professor.
 *
 * É a primeira coisa que ele vê ao abrir o app na sala, então responde as
 * perguntas de antes do primeiro "vamos começar": quanto falta de aula, quem
 * está na turma, quem tem alerta de saúde e quem está sem ficha (ou com a
 * ficha vencida). Um toque abre a sala, com a ficha de cada um.
 *
 * No tablet (o uso principal da musculação, apoiado na sala) a ficha fica
 * aberta ao lado da turma o tempo todo.
 */

interface Props {
  /** Aulas de hoje do professor (já filtradas pelo dia da semana). */
  aulasDeHoje: HorarioVaga[];
  /** Data de hoje em YYYY-MM-DD. */
  hoje: string;
}

const emMinutos = (h: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

type CargaAberta = ExercicioAberto & { sequencia: ExercicioAberto[] };

export function AulaAgora({ aulasDeHoje, hoje }: Props) {
  const { foco, anterior } = useAulaAgora(aulasDeHoje);
  const aula = foco?.aula ?? null;
  const minuto = useMinutoAtual();

  /**
   * A modalidade tem ficha por aluno (Musculação, Pilates). No Funcional o
   * treino é um só para a turma — a lista serve para saber quem está na sala.
   * Vem da aula, não do professor: quem dá Musculação e Funcional tem as duas
   * coisas ao longo do mesmo dia.
   */
  const porAluno = !usaTreinoDoDia(aula?.modalidade?.nome);

  const agendamentos = useAgendamentosDoHorario(aula?.id, hoje, !!aula);
  // Turma que acabou de sair, quando a próxima já começou: quem estourou o
  // horário continua treinando, e o professor precisa da ficha dele.
  const daAnterior = useAgendamentosDoHorario(anterior?.id, hoje, !!anterior);
  const { extras, adicionar, remover } = useAlunosExtras(hoje, aula?.id);

  const [indice, setIndice] = useState<number | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  // No tablet a ficha fica sempre aberta ao lado: o que muda é qual aluno.
  const [selecionado, setSelecionado] = useState(0);
  const [cargaDe, setCargaDe] = useState<CargaAberta | null>(null);
  const [verFicha, setVerFicha] = useState(false);
  const tablet = useIsTablet();

  /**
   * Altura da ficha no painel do tablet: o espaço que existe, descontando o
   * cabeçalho do cartão, a régua de dias e a barra de abas. O piso protege o
   * tablet deitado, onde a altura é curta.
   */
  const { height: alturaJanela } = useWindowDimensions();
  const alturaDoTreino = Math.min(Math.max(alturaJanela - 380, 380), 900);

  const alunos: AlunoDaAula[] = useMemo(() => {
    const daAgenda = (agendamentos.data ?? [])
      .map((ag) => ({ id: ag.usuario.id, nome: ag.usuario.nome, reposicao: !!ag.reposicao }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // Encaixes ficam no fim: quem está na agenda oficial vem primeiro.
    const encaixes = extras
      .filter((e) => !daAgenda.some((a) => a.id === e.id))
      .map((e) => ({ id: e.id, nome: e.nome, extra: true }));
    const atuais = [...daAgenda, ...encaixes];
    // Quem ficou da turma anterior entra por último e sinalizado.
    const restantes = anterior
      ? (daAnterior.data ?? [])
          .filter((ag) => !atuais.some((a) => a.id === ag.usuario.id))
          .map((ag) => ({ id: ag.usuario.id, nome: ag.usuario.nome, daTurmaDe: anterior.horaInicio }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      : [];
    return [...atuais, ...restantes];
  }, [agendamentos.data, extras, daAnterior.data, anterior]);

  const status = useStatusDaTurma(porAluno ? alunos.map((a) => a.id) : []);

  const emFoco = alunos.length > 0 ? Math.min(selecionado, alunos.length - 1) : -1;
  const alunoEmFoco = emFoco >= 0 ? alunos[emFoco] : null;
  const painel = tablet && porAluno;
  const anamnese = useAnamneseDoAluno(alunoEmFoco?.id, painel);

  if (!aula || !foco) return null;

  const inicioRestantes = alunos.findIndex((a) => a.daTurmaDe);
  const atuais = inicioRestantes >= 0 ? inicioRestantes : alunos.length;

  // O relógio da aula: quanto já foi, quanto falta.
  const ini = emMinutos(aula.horaInicio);
  const fim = emMinutos(aula.horaFim);
  const pct = foco.estado === 'agora' ? Math.min(Math.max((minuto - ini) / Math.max(fim - ini, 1), 0), 1) : foco.estado === 'encerrando' ? 1 : 0;
  const tempo =
    foco.estado === 'agora'
      ? `faltam ${fim - minuto} min`
      : foco.estado === 'proxima'
        ? `começa em ${Math.max(ini - minuto, 0)} min`
        : `terminou há ${Math.max(minuto - fim, 0)} min`;
  const rotulo = foco.estado === 'agora' ? 'AGORA' : foco.estado === 'proxima' ? 'A SEGUIR' : 'ENCERRANDO';

  const alertas = alunos.filter((a) => status[a.id]?.alerta).length;
  const semFicha = alunos.filter((a) => status[a.id]?.situacao.urgente).length;

  const abrir = (i: number) => (painel ? setSelecionado(i) : setIndice(i));

  return (
    <View style={[s.wrap, painel && s.wrapLargo]}>
      <View style={s.card}>
        {/* Cabeçalho: a aula e o relógio dela */}
        <LinearGradient colors={['#063A3D', '#0B6F66']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.heroTopo}>
            <View style={s.estado}>
              <View style={[s.estadoPonto, foco.estado !== 'agora' && { backgroundColor: '#FCD34D' }]} />
              <Text style={s.estadoTexto}>{rotulo}</Text>
            </View>
            <Text style={s.heroModalidade}>{nomeModalidade(aula.modalidade.nome)}</Text>
            <View style={{ flex: 1 }} />
            <Icon name="people" size={15} color="rgba(255,255,255,0.75)" />
            <Text style={s.heroContagem}>{atuais}</Text>
          </View>
          <Text style={s.heroHora}>
            {aula.horaInicio} – {aula.horaFim}
          </Text>
          <View style={s.relogio}>
            <View style={s.relogioTrilho}>
              <View style={[s.relogioBarra, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={s.relogioTexto}>{tempo}</Text>
          </View>
          {porAluno && (alertas > 0 || semFicha > 0) ? (
            <View style={s.avisos}>
              {alertas > 0 ? (
                <View style={s.aviso}>
                  <Icon name="medkit" size={12} color="#FCD34D" />
                  <Text style={s.avisoTexto}>{alertas} com alerta de saúde</Text>
                </View>
              ) : null}
              {semFicha > 0 ? (
                <View style={s.aviso}>
                  <Icon name="document-text" size={12} color="#FCA5A5" />
                  <Text style={s.avisoTexto}>{semFicha} sem ficha em dia</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>

        <View style={[s.corpo, painel && s.corpoPainel]}>
          <View style={painel ? s.colunaLista : undefined}>
            {agendamentos.isLoading ? (
              <View style={{ height: 80 }}>
                <Loading />
              </View>
            ) : alunos.length === 0 ? (
              <Text style={s.vazio}>Nenhum aluno agendado nesta aula.</Text>
            ) : (
              alunos.map((a, i) => (
                <Fragment key={a.id}>
                  {i === inicioRestantes ? (
                    <Text style={s.separador}>Ainda na sala · turma das {a.daTurmaDe}</Text>
                  ) : null}
                  <LinhaAluno
                    aluno={a}
                    status={porAluno ? status[a.id] : undefined}
                    selecionado={painel && i === emFoco}
                    compacto={painel}
                    onPress={porAluno ? () => abrir(i) : undefined}
                    onRemover={a.extra ? () => remover(a.id) : undefined}
                  />
                </Fragment>
              ))
            )}

            <View style={[s.rodape, painel && s.rodapeColuna]}>
              <Pressable
                style={({ pressed }) => [s.encaixar, pressed && { opacity: 0.7 }]}
                onPress={() => setAdicionando(true)}
                accessibilityRole="button"
                accessibilityLabel="Encaixar aluno na aula"
              >
                <Icon name="person-add-outline" size={16} color={LC.primary} />
                <Text style={s.encaixarTexto}>Encaixar</Text>
              </Pressable>
              {!porAluno ? (
                <Pressable
                  style={({ pressed }) => [s.comecar, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push('/professor/treinos' as any)}
                  accessibilityRole="button"
                >
                  <Text style={s.comecarTexto}>Treino do dia</Text>
                  <Icon name="arrow-forward" size={17} color="#fff" />
                </Pressable>
              ) : !painel && alunos.length > 0 ? (
                <Pressable
                  style={({ pressed }) => [s.comecar, pressed && { opacity: 0.85 }]}
                  onPress={() => setIndice(0)}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir a sala"
                >
                  <Icon name="barbell" size={17} color="#fff" />
                  <Text style={s.comecarTexto}>Abrir a sala</Text>
                  <Icon name="arrow-forward" size={17} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {painel ? (
            <View style={s.colunaFicha}>
              {alunoEmFoco ? (
                <>
                  <View style={s.fichaTopo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fichaNome} numberOfLines={1}>{nomeCurto(alunoEmFoco.nome)}</Text>
                      {alunoEmFoco.nome.trim().toLowerCase() !== nomeCurto(alunoEmFoco.nome).toLowerCase() ? (
                        <Text style={s.fichaNomeCompleto} numberOfLines={1}>{alunoEmFoco.nome}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={({ pressed }) => [s.abrirBtn, pressed && { opacity: 0.75 }]}
                      onPress={() =>
                        router.push({
                          pathname: '/professor/treinos-aluno' as any,
                          params: { id: alunoEmFoco.id, nome: alunoEmFoco.nome },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir treinos de ${alunoEmFoco.nome}`}
                    >
                      <Icon name={status[alunoEmFoco.id]?.situacao.chave === 'sem-ficha' ? 'add' : 'create-outline'} size={15} color={LC.primary} />
                      <Text style={s.abrirTexto}>{status[alunoEmFoco.id]?.situacao.chave === 'sem-ficha' ? 'Montar ficha' : 'Editar fichas'}</Text>
                    </Pressable>
                  </View>
                  <FichaDoAluno
                    key={alunoEmFoco.id}
                    alunoId={alunoEmFoco.id}
                    ativo
                    alturaMax={alturaDoTreino}
                    onAbrirCarga={setCargaDe}
                    onVerFicha={() => setVerFicha(true)}
                  />
                </>
              ) : (
                <Text style={s.fichaVazia}>Escolha um aluno ao lado para ver o treino.</Text>
              )}
            </View>
          ) : null}
        </View>
      </View>

      {painel ? (
        <>
          <CargaExercicioModal
            exercicio={cargaDe?.nome ?? null}
            alunoId={alunoEmFoco?.id}
            alunoNome={alunoEmFoco?.nome}
            repeticoesPadrao={cargaDe?.reps}
            cargaFicha={cargaDe?.carga}
            sequencia={cargaDe?.sequencia}
            onIr={(e) => setCargaDe((atual) => (atual ? { ...atual, ...e } : atual))}
            onClose={() => setCargaDe(null)}
          />
          <AnamneseModal
            visible={verFicha}
            alunoNome={alunoEmFoco?.nome ?? ''}
            ficha={anamnese.data}
            onClose={() => setVerFicha(false)}
          />
        </>
      ) : null}

      <TreinoAlunoModal
        alunos={alunos}
        indice={painel ? null : indice}
        onIndice={setIndice}
        onClose={() => setIndice(null)}
        titulo={`Aula das ${aula.horaInicio} · ${nomeModalidade(aula.modalidade.nome)}`}
      />
      <AdicionarAlunoModal
        visible={adicionando}
        jaNaAula={alunos.map((a) => a.id)}
        onEscolher={adicionar}
        onClose={() => setAdicionando(false)}
      />
    </View>
  );
}

/** Um aluno da turma: quem é, o alerta de saúde e a situação da ficha. */
function LinhaAluno({
  aluno,
  status,
  selecionado,
  compacto,
  onPress,
  onRemover,
}: {
  aluno: AlunoDaAula;
  status?: StatusDoAluno;
  selecionado: boolean;
  compacto: boolean;
  onPress?: () => void;
  onRemover?: () => void;
}) {
  const sit = status && !status.carregando ? status.situacao : null;
  const mostraSituacao = sit && sit.chave !== 'em-dia';
  return (
    <Pressable
      style={({ pressed }) => [
        s.linha,
        aluno.daTurmaDe && s.linhaAnterior,
        selecionado && s.linhaSel,
        pressed && onPress && s.linhaApertada,
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Ver treino de ${aluno.nome}` : undefined}
    >
      <Avatar nome={aluno.nome} size={compacto ? 36 : 42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.linhaNomeRow}>
          <Text style={s.linhaNome} numberOfLines={1}>{nomeCurto(aluno.nome)}</Text>
          {aluno.reposicao ? <Text style={[s.mini, { color: LC.infoFg, backgroundColor: LC.infoBg }]}>reposição</Text> : null}
          {aluno.extra ? <Text style={[s.mini, { color: LC.warningFg, backgroundColor: LC.warningBg }]}>encaixe</Text> : null}
        </View>
        {status?.alerta ? (
          <View style={s.alertaLinha}>
            <Icon name="medkit" size={11} color={LC.warningFg} />
            <Text style={s.alertaTexto} numberOfLines={1}>{status.alerta}</Text>
          </View>
        ) : aluno.daTurmaDe ? (
          <Text style={s.linhaSub}>da turma das {aluno.daTurmaDe}</Text>
        ) : null}
        {compacto && mostraSituacao ? (
          <Text style={[s.situacaoCompacta, { color: sit!.cor }]}>{sit!.rotulo}</Text>
        ) : null}
      </View>
      {!compacto && mostraSituacao ? (
        <View style={[s.situacao, { backgroundColor: sit!.fundo }]}>
          <Text style={[s.situacaoTexto, { color: sit!.cor }]}>{sit!.rotulo}</Text>
        </View>
      ) : null}
      {onRemover ? (
        <Pressable hitSlop={8} onPress={onRemover} accessibilityRole="button" accessibilityLabel={`Tirar ${aluno.nome} da aula`}>
          <Icon name="close-circle" size={20} color={LC.textMuted} />
        </Pressable>
      ) : onPress ? (
        <Icon name={selecionado ? 'chevron-forward-circle' : 'chevron-forward'} size={18} color={selecionado ? LC.primary : LC.textMuted} />
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { ...LC.coluna, paddingHorizontal: 16, paddingBottom: 6 },
  // No tablet o cartão sai da coluna de 560 e ocupa a largura útil: é ela que
  // permite a ficha ficar aberta ao lado da turma.
  wrapLargo: { maxWidth: 1100 },
  card: {
    backgroundColor: LC.bgCard, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: LC.border, ...LC.shadowCard,
  },

  hero: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  heroTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  estado: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  estadoPonto: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  estadoTexto: { fontSize: 10.5, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },
  heroModalidade: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  heroContagem: { fontSize: 14, fontWeight: '800', color: '#fff' },
  heroHora: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 8, letterSpacing: -0.5 },
  relogio: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  relogioTrilho: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  relogioBarra: { height: '100%', borderRadius: 3, backgroundColor: '#5EEAD4' },
  relogioTexto: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  avisos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.18)',
  },
  avisoTexto: { fontSize: 11.5, fontWeight: '700', color: '#fff' },

  corpo: { padding: 12 },
  corpoPainel: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', padding: 14 },
  colunaLista: { width: 300 },
  colunaFicha: { flex: 1, minHeight: 240, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: LC.border },

  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14,
  },
  linhaSel: { backgroundColor: LC.primaryLight },
  linhaApertada: { backgroundColor: LC.neutralBg },
  linhaAnterior: { opacity: 0.75 },
  linhaNomeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linhaNome: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  linhaSub: { fontSize: 12, color: LC.textMuted, marginTop: 2 },
  mini: { fontSize: 10.5, fontWeight: '800', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, overflow: 'hidden' },
  alertaLinha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  alertaTexto: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: LC.warningFg },
  situacao: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  situacaoTexto: { fontSize: 11.5, fontWeight: '800' },
  situacaoCompacta: { fontSize: 11.5, fontWeight: '800', marginTop: 2 },

  separador: {
    fontSize: 11, fontWeight: '800', color: LC.textMuted, letterSpacing: 0.4,
    textTransform: 'uppercase', marginTop: 8, marginBottom: 2, marginLeft: 10,
  },
  vazio: { fontSize: 13.5, color: LC.textSecondary, padding: 12 },

  rodape: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingHorizontal: 4 },
  rodapeColuna: { marginTop: 10 },
  encaixar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: LC.primaryLight,
  },
  encaixarTexto: { fontSize: 14, fontWeight: '800', color: LC.primary },
  comecar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 14, backgroundColor: LC.primary,
  },
  comecarTexto: { fontSize: 15, fontWeight: '800', color: '#fff' },

  fichaTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  fichaNome: { fontSize: 20, fontWeight: '800', color: LC.textPrimary },
  fichaNomeCompleto: { fontSize: 11.5, color: LC.textMuted, marginTop: 1 },
  abrirBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: LC.primaryLight,
  },
  abrirTexto: { fontSize: 13, fontWeight: '800', color: LC.primary },
  fichaVazia: { fontSize: 13, color: LC.textMuted, paddingVertical: 20 },
});
