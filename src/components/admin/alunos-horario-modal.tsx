import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { nomeModalidade } from '../../constants/assets';
import { AppModal } from '../ui/modal';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Avatar } from '../ui/avatar';
import { Loading } from '../ui/states';
import { useAgendamentosDoHorario } from '../../services/agendamentos/agendamentos.queries';
import {
  useAdicionarAlunoNaAula,
  useCancelarAgendamentoAdmin,
  useDesmarcarAgendamento,
} from '../../services/agendamentos/agendamentos.mutations';
import { useAlunos } from '../../services/usuarios/usuarios.queries';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';
import type { HorarioAdmin } from '../../services/horarios/horarios.types';
import {
  ehLimiteSemanal,
  type AgendamentoDoHorario,
  type AulaDaSemana,
} from '../../services/agendamentos/agendamentos.types';
import { ApiError } from '../../services/http';
import { formatDate, proximaDataDoDia } from '../../services/date';

/**
 * O mínimo que o modal precisa. Um HorarioAdmin completo satisfaz este tipo,
 * e as "aulas de hoje" do dashboard montam um objeto leve com os mesmos campos.
 */
export type HorarioDoModal = Pick<HorarioAdmin, 'id' | 'diaSemana' | 'horaInicio'> & {
  modalidade: { nome: string };
  /**
   * Quantos cabem na turma. A API já devolve este número com o teto da
   * modalidade aplicado (Pilates 3, o resto 4), então dá para mostrar "2 de 4"
   * e travar o botão sem repetir a regra aqui. Opcional porque o card de aulas
   * de hoje monta o objeto na mão.
   */
  capacidadeMaxima?: number;
};

/** "JÉSSICA" e "jessica" precisam se achar na busca. */
const semAcento = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** "CARLOS EDUARDO RAVAGLI" → "Carlos": o cadastro é todo em caixa alta. */
const primeiroNome = (nome: string) => {
  const p = nome.trim().split(/\s+/)[0] ?? nome;
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

/**
 * O que dizer sobre o cadastro do aluno na lista de quem pode entrar.
 *
 * Cadastro novo fica `ativo: false` até o primeiro acesso, então um selo
 * "Inativo" ali diria a coisa errada sobre quem ela acabou de cadastrar —
 * na tela de alunos "Inativo" quer dizer aluno desligado. Os dois casos
 * entram na aula do mesmo jeito; o selo é só para ela saber com quem está
 * lidando.
 */
function seloDoAluno(aluno: AlunoAdmin): { label: string; variant: 'danger' | 'warning' } | null {
  if (aluno.ativado === false) return { label: 'Aguardando acesso', variant: 'warning' };
  if (!aluno.ativo) return { label: 'Inativo', variant: 'danger' };
  return null;
}

/** Aula que trava a semana do aluno, do jeito que aparece no aviso de troca. */
function rotuloDaAula(a: AulaDaSemana) {
  return `${formatDate(a.dataAula, 'ddd, DD/MM')} • ${a.horaInicio} ${nomeModalidade(a.modalidade)}`;
}

/**
 * Alunos agendados na PRÓXIMA ocorrência do horário (inclui hoje), com o
 * estúdio podendo colocar e tirar gente ali mesmo.
 *
 * Ao tirar um aluno, a tela pergunta se a aula vira crédito de reposição —
 * academia que desmarcou compensa, remanejamento não. Adicionar
 * respeita lotação e plano — e quando o plano é o que trava, oferece trocar
 * pela aula da semana que está ocupando a vaga, que é o remanejamento que a
 * dona faz o tempo todo.
 */
export function AlunosHorarioModal({
  horario,
  onClose,
  /**
   * Dia exato da aula (YYYY-MM-DD). A agenda semanal manda a data da célula
   * que a dona tocou; sem isto o modal cairia sempre na próxima ocorrência do
   * dia da semana, e ela abriria a quinta da semana que vem achando que era a
   * desta. As telas antigas não mandam nada e seguem com a próxima ocorrência.
   */
  data: dataFixa,
}: {
  horario: HorarioDoModal | null;
  onClose: () => void;
  data?: string;
}) {
  const data = horario ? (dataFixa ?? proximaDataDoDia(horario.diaSemana)) : undefined;
  const agendamentos = useAgendamentosDoHorario(horario?.id, data, !!horario);
  const cancelar = useCancelarAgendamentoAdmin();
  const desmarcar = useDesmarcarAgendamento();
  const adicionar = useAdicionarAlunoNaAula();

  const [modo, setModo] = useState<'lista' | 'adicionar'>('lista');
  const [busca, setBusca] = useState('');
  /** Aluno que a dona está tirando da aula — falta escolher se leva crédito. */
  const [tirando, setTirando] = useState<AgendamentoDoHorario | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  /** Aluno esbarrou no plano: quais aulas da semana dele podem sair no lugar. */
  const [conflito, setConflito] = useState<{ aluno: AlunoAdmin; texto: string; aulas: AulaDaSemana[] } | null>(null);

  // Lista inteira uma vez só e filtra aqui: o estúdio tem dezenas de alunos,
  // e assim a busca responde a cada tecla sem ida ao servidor.
  const alunos = useAlunos();

  const naAula = useMemo(
    () => new Set((agendamentos.data ?? []).map((a) => a.usuarioId)),
    [agendamentos.data],
  );

  /**
   * Todo mundo que ainda não está nesta aula — inclusive quem consta como
   * inativo. Cadastro novo nasce inativo até o aluno fazer o primeiro acesso,
   * e o mais comum é cadastrar e já colocar na turma; esconder esses seria
   * esconder justamente quem ela acabou de cadastrar. Quem está inativo vem
   * com selo para ela reparar.
   */
  const candidatos = useMemo(() => {
    const termo = semAcento(busca.trim());
    return (alunos.data ?? [])
      .filter((a) => !naAula.has(a.id))
      .filter((a) => !termo || semAcento(a.nome).includes(termo) || a.cpf.includes(termo))
      .slice(0, 30);
  }, [alunos.data, busca, naAula]);

  const ocupacao = agendamentos.data?.length ?? 0;
  const cabem = horario?.capacidadeMaxima;
  const lotado = cabem !== undefined && ocupacao >= cabem;
  /**
   * Aula de dia passado: a API recusa marcar (distorceria a cota da semana do
   * aluno por uma aula que ele não teve). A agenda semanal deixa abrir dias
   * anteriores para consulta, então o botão precisa sumir aqui — oferecer e
   * depois recusar seria pior do que não oferecer.
   */
  const passou = !!data && data < formatDate(new Date(), 'YYYY-MM-DD');

  const fechar = () => {
    setModo('lista');
    setBusca('');
    setTirando(null);
    setConflito(null);
    setFeedback(null);
    onClose();
  };

  const voltarParaLista = () => {
    setModo('lista');
    setBusca('');
    setConflito(null);
  };

  /**
   * Tirar o aluno da aula, com ou sem crédito — quem decide é a dona.
   *
   * Antes o botão sempre gerava crédito, e nem sempre é isso: quando a
   * academia cancela a aula, compensar é justo; quando ela só está arrumando
   * a agenda ou remanejando de turma, o crédito inflava o saldo do aluno a
   * cada correção. São duas rotas diferentes na API; a tela pergunta qual.
   */
  const tirarDaAula = (comCredito: boolean) => {
    if (!tirando) return;
    const acao = comCredito ? cancelar : desmarcar;
    acao.mutate(tirando.id, {
      onSuccess: (r) => {
        setTirando(null);
        setFeedback(r.mensagem);
      },
      onError: (e) => {
        setTirando(null);
        setFeedback(e instanceof ApiError ? e.message : 'Não foi possível tirar o aluno da aula.');
      },
    });
  };

  const adicionarAluno = (aluno: AlunoAdmin, substituirAgendamentoId?: string) => {
    if (!horario || !data) return;
    setConflito(null);
    setFeedback(null);
    adicionar.mutate(
      { usuarioId: aluno.id, horarioId: horario.id, dataAula: data, substituirAgendamentoId },
      {
        onSuccess: () => {
          voltarParaLista();
          setFeedback(
            substituirAgendamentoId
              ? `${primeiroNome(aluno.nome)} foi remanejado para esta aula.`
              : `${primeiroNome(aluno.nome)} entrou nesta aula.`,
          );
        },
        onError: (e) => {
          /**
           * O plano cheio não é o fim da conversa aqui: a API devolve quais
           * aulas da semana ocupam a cota, e a dona escolhe qual sai. Sem
           * isto ela teria de sair desta tela, achar a aula velha no cadastro
           * do aluno, desmarcar e voltar — que é exatamente o caminho que ela
           * não achava sozinha.
           */
          if (e instanceof ApiError && ehLimiteSemanal(e.data)) {
            const trocaveis = e.data.aulasDaSemana.filter((a) => a.podeTrocar);
            setConflito({ aluno, texto: e.data.message, aulas: trocaveis });
            return;
          }
          setFeedback(e instanceof ApiError ? e.message : 'Não foi possível adicionar.');
        },
      },
    );
  };

  const titulo = horario
    ? `${DIAS_PT[horario.diaSemana]} ${horario.horaInicio} — ${nomeModalidade(horario.modalidade.nome)}`
    : '';

  // ── Modo: escolher quem entra ────────────────────────────────────────
  if (modo === 'adicionar') {
    return (
      <AppModal visible={!!horario} onClose={fechar} title={titulo}>
        <Text style={s.dataLabel}>
          Quem entra na aula de {data ? formatDate(data, 'dddd, DD/MM') : ''}
          {cabem !== undefined ? ` • ${ocupacao} de ${cabem}` : ''}
        </Text>

        <Input
          placeholder="Buscar por nome ou CPF"
          value={busca}
          onChangeText={setBusca}
          autoCorrect={false}
          leftIcon={<Icon name="search-outline" size={16} color={LC.textMuted} />}
        />

        {conflito ? (
          <View style={s.conflito}>
            <Text style={s.conflitoTitulo}>{conflito.texto}</Text>
            {conflito.aulas.length === 0 ? (
              <Text style={s.conflitoVazio}>
                As aulas desta semana já aconteceram — não dá para trocar. Aumente o plano de{' '}
                {primeiroNome(conflito.aluno.nome)} ou marque na semana que vem.
              </Text>
            ) : (
              conflito.aulas.map((a) => (
                <View key={a.id} style={s.conflitoLinha}>
                  <Text style={s.conflitoAula}>{rotuloDaAula(a)}</Text>
                  <Button
                    title="Trocar"
                    size="sm"
                    variant="outline"
                    fullWidth={false}
                    loading={adicionar.isPending}
                    onPress={() => adicionarAluno(conflito.aluno, a.id)}
                  />
                </View>
              ))
            )}
            <Text style={s.conflitoNota}>
              Trocar tira a aula antiga e coloca esta. Não gera crédito de reposição — é remanejamento.
            </Text>
          </View>
        ) : null}

        {feedback ? (
          <View style={s.feedback}>
            <Icon name="information-circle-outline" size={16} color={LC.primary} />
            <Text style={s.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        {alunos.isLoading ? (
          <View style={s.loading}>
            <Loading />
          </View>
        ) : candidatos.length === 0 ? (
          <Text style={s.empty}>
            {busca ? 'Nenhum aluno com esse nome ou CPF.' : 'Todos os alunos já estão nesta aula.'}
          </Text>
        ) : (
          <ScrollView style={s.list} keyboardShouldPersistTaps="handled">
            {candidatos.map((aluno) => {
              const plano = aluno.usuarioPlanos?.[0]?.plano;
              const selo = seloDoAluno(aluno);
              return (
                <View key={aluno.id} style={s.row}>
                  <Avatar nome={aluno.nome} size={34} />
                  <View style={{ flex: 1 }}>
                    <View style={s.rowNomeLinha}>
                      <Text style={s.rowNome}>{aluno.nome}</Text>
                      {selo ? <Badge label={selo.label} variant={selo.variant} /> : null}
                    </View>
                    <Text style={s.rowSub}>{plano ? plano.nome : 'Sem plano ativo'}</Text>
                  </View>
                  <Pressable
                    style={s.addBtn}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Colocar ${aluno.nome} nesta aula`}
                    disabled={adicionar.isPending}
                    onPress={() => adicionarAluno(aluno)}
                  >
                    <Icon name="add" size={18} color={LC.primary} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}

        <Button title="Voltar" variant="outline" size="sm" onPress={voltarParaLista} style={{ marginTop: 14 }} />
      </AppModal>
    );
  }

  // ── Modo: quem já está na aula ───────────────────────────────────────
  return (
    <AppModal visible={!!horario} onClose={fechar} title={titulo}>
      {data ? (
        <Text style={s.dataLabel}>
          Aula de {formatDate(data, 'dddd, DD/MM/YYYY')}
          {cabem !== undefined ? ` • ${ocupacao} de ${cabem}` : ''}
        </Text>
      ) : null}

      {feedback ? (
        <View style={s.feedback}>
          <Icon name="information-circle-outline" size={16} color={LC.primary} />
          <Text style={s.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      {agendamentos.isLoading ? (
        <View style={s.loading}>
          <Loading />
        </View>
      ) : !agendamentos.data || agendamentos.data.length === 0 ? (
        <Text style={s.empty}>Nenhum aluno agendado nesta aula.</Text>
      ) : (
        <ScrollView style={s.list}>
          {agendamentos.data.map((ag) => (
            <View key={ag.id} style={s.row}>
              <Avatar nome={ag.usuario.nome} size={34} />
              <View style={{ flex: 1 }}>
                <View style={s.rowNomeLinha}>
                  <Text style={s.rowNome}>{ag.usuario.nome}</Text>
                  {ag.reposicao ? <Badge label="Reposição" variant="info" /> : null}
                </View>
                <Text style={s.rowSub}>CPF {ag.usuario.cpf}</Text>
              </View>
              <Pressable
                style={s.cancelBtn}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Tirar ${ag.usuario.nome} desta aula`}
                onPress={() => setTirando(ag)}
              >
                <Icon name="trash-outline" size={16} color={LC.danger} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/*
        Colocar aluno na turma direto por aqui.

        O caminho oficial é o horário fixo, no cadastro do aluno — mas ele
        depende de uma geração que pode não conseguir marcar nada (turma
        cheia, semana do plano ocupada). Quando isso acontecia a dona ficava
        sem saída: o fixo aparecia salvo e o aluno não estava na turma.
      */}
      {passou ? (
        <View style={s.lotadoRow}>
          <Icon name="time-outline" size={14} color={LC.textMuted} />
          <Text style={s.passouText}>Esta aula já passou: não dá mais para colocar aluno nela.</Text>
        </View>
      ) : lotado ? (
        <View style={s.lotadoRow}>
          <Icon name="alert-circle-outline" size={14} color={LC.danger} />
          <Text style={s.lotadoText}>Turma lotada ({ocupacao}/{cabem}). Tire alguém para abrir vaga.</Text>
        </View>
      ) : (
        <Pressable
          style={s.addAlunoBtn}
          accessibilityRole="button"
          onPress={() => {
            setBusca('');
            setConflito(null);
            setFeedback(null);
            setModo('adicionar');
          }}
        >
          <Icon name="person-add-outline" size={17} color={LC.primary} />
          <Text style={s.addAlunoText}>Adicionar aluno nesta aula</Text>
        </Pressable>
      )}

      <View style={s.hintRow}>
        <Icon name="ticket-outline" size={14} color={LC.textMuted} />
        <Text style={s.hint}>
          Ao tirar um aluno da aula, você escolhe se ele ganha crédito de reposição.
        </Text>
      </View>

      {/*
        A pergunta do crédito.
        Fica num modal próprio, e não em dois botões na linha do aluno, porque
        as duas opções precisam de uma frase explicando quando usar cada uma —
        na linha não caberia, e a dona escolheria no chute.
      */}
      <AppModal
        visible={!!tirando}
        onClose={() => setTirando(null)}
        title={tirando ? `Tirar ${primeiroNome(tirando.usuario.nome)} desta aula` : ''}
        dismissable={!cancelar.isPending && !desmarcar.isPending}
      >
        <Text style={s.escolhaTexto}>
          {tirando ? `${tirando.usuario.nome} sai da aula de ` : ''}
          {data ? formatDate(data, 'dddd, DD/MM') : ''}
          {tirando ? ` às ${horario?.horaInicio}.` : ''} O que fazer com essa aula?
        </Text>

        <Pressable
          style={s.escolha}
          accessibilityRole="button"
          disabled={cancelar.isPending || desmarcar.isPending}
          onPress={() => tirarDaAula(true)}
        >
          <View style={[s.escolhaIcone, { backgroundColor: LC.primaryLight }]}>
            <Icon name="ticket-outline" size={18} color={LC.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.escolhaTitulo}>Dar crédito de reposição</Text>
            <Text style={s.escolhaSub}>
              O aluno pode repor essa aula depois. Use quando foi a academia que desmarcou.
            </Text>
          </View>
          {cancelar.isPending ? <Text style={s.escolhaSub}>…</Text> : null}
        </Pressable>

        <Pressable
          style={s.escolha}
          accessibilityRole="button"
          disabled={cancelar.isPending || desmarcar.isPending}
          onPress={() => tirarDaAula(false)}
        >
          <View style={[s.escolhaIcone, { backgroundColor: LC.neutralBg }]}>
            <Icon name="swap-horizontal-outline" size={18} color={LC.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.escolhaTitulo}>Tirar sem crédito</Text>
            <Text style={s.escolhaSub}>
              Só arrumação de agenda: remanejamento de turma ou aula que sobrou. Não muda o saldo do aluno.
            </Text>
          </View>
          {desmarcar.isPending ? <Text style={s.escolhaSub}>…</Text> : null}
        </Pressable>

        <Button
          title="Voltar"
          variant="outline"
          size="sm"
          onPress={() => setTirando(null)}
          style={{ marginTop: 10 }}
        />
      </AppModal>
    </AppModal>
  );
}

const s = StyleSheet.create({
  dataLabel: { fontSize: 13, color: LC.textSecondary, marginBottom: 12 },
  feedback: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: LC.primaryLight, borderRadius: LC.radius.md,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
  },
  feedbackText: { flex: 1, fontSize: 13, color: LC.primaryDark, lineHeight: 18 },
  loading: { height: 80 },
  empty: { fontSize: 14, color: LC.textSecondary, textAlign: 'center', paddingVertical: 16 },
  list: { maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: LC.border },
  rowNomeLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  rowSub: { fontSize: 12, color: LC.textSecondary, marginTop: 1 },
  escolhaTexto: { fontSize: 13.5, color: LC.textSecondary, lineHeight: 20, marginBottom: 14 },
  escolha: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 13, marginBottom: 10, borderRadius: LC.radius.md,
    borderWidth: 1.5, borderColor: LC.border, backgroundColor: LC.bg,
  },
  escolhaIcone: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  escolhaTitulo: { fontSize: 14, fontWeight: '800', color: LC.textPrimary },
  escolhaSub: { fontSize: 12.5, color: LC.textSecondary, lineHeight: 18, marginTop: 3 },
  cancelBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.dangerBg, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },

  // ── Adicionar aluno ────────────────────────────────────────────────
  addAlunoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, paddingVertical: 13, borderRadius: LC.radius.md,
    borderWidth: 1.5, borderColor: LC.primary, borderStyle: 'dashed',
  },
  addAlunoText: { fontSize: 14, fontWeight: '700', color: LC.primary },
  lotadoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  lotadoText: { flex: 1, fontSize: 12, color: LC.danger, lineHeight: 17 },
  passouText: { flex: 1, fontSize: 12, color: LC.textMuted, lineHeight: 17 },

  // ── Conflito de plano ──────────────────────────────────────────────
  conflito: {
    backgroundColor: LC.dangerBg, borderRadius: LC.radius.md,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 12, marginTop: 4,
  },
  conflitoTitulo: { fontSize: 13, fontWeight: '700', color: LC.danger, lineHeight: 18, marginBottom: 8 },
  conflitoLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: LC.border,
  },
  conflitoAula: { flex: 1, fontSize: 13, fontWeight: '600', color: LC.textPrimary },
  conflitoVazio: { fontSize: 12.5, color: LC.textSecondary, lineHeight: 18 },
  conflitoNota: { fontSize: 11.5, color: LC.textMuted, marginTop: 8, lineHeight: 16 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: LC.border },
  hint: { flex: 1, fontSize: 12, color: LC.textMuted },
});
