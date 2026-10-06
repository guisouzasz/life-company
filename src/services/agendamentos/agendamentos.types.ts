export type StatusAgendamento = 'CONFIRMADO' | 'CANCELADO' | 'REALIZADO' | 'FALTOU';
export type DiaSemana = 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA';

export interface Modalidade {
  id: string;
  nome: string;
}

export interface Horario {
  id: string;
  modalidadeId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  capacidadeMaxima: number;
  ativo: boolean;
  modalidade: Modalidade;
}

export interface Presenca {
  id: string;
  compareceu: boolean;
  registradoEm: string;
}

export interface Agendamento {
  id: string;
  usuarioId: string;
  horarioId: string;
  dataAula: string;
  status: StatusAgendamento;
  /** Aula marcada com crédito de reposição (cancelar não devolve o crédito). */
  reposicao?: boolean;
  createdAt: string;
  horario: Horario;
  presenca?: Presenca | null;
  /** Aula que caiu em dia fechado (feriado/recesso). */
  diaFechado?: { motivo: string } | null;
}

export interface CriarAgendamentoPayload {
  horarioId: string;
  dataAula: string; // YYYY-MM-DD
  usarCredito?: boolean; // agendar consumindo um crédito de reposição
}

/** POST /agendamentos/admin — o estúdio colocando um aluno na aula. */
export interface CriarAgendamentoAdminPayload {
  usuarioId: string;
  horarioId: string;
  dataAula: string; // YYYY-MM-DD
  /** Aula da mesma semana que sai (sem crédito) para esta entrar. */
  substituirAgendamentoId?: string;
  /**
   * true: reposição, gastando um crédito do aluno (não usa a semana do plano).
   * false: aula do plano, sem perguntar. Ausente: a API pergunta quando o
   * aluno tem crédito e a semana tem vaga (ver `ehEscolherTipo`).
   */
  usarCredito?: boolean;
  /** Com `usarCredito`: o estúdio dá o crédito agora, se o aluno não tiver. */
  concederCredito?: boolean;
}

/** Aula que está ocupando a semana do aluno, devolvida no 403 de limite. */
export interface AulaDaSemana {
  id: string;
  dataAula: string;
  horaInicio: string;
  modalidade: string;
  /** REALIZADO não sai; só aula ainda por acontecer é trocável. */
  podeTrocar: boolean;
}

/**
 * Corpo do 403 de limite semanal na rota admin.
 *
 * Chega em `ApiError.data`. O aluno só precisa saber que a cota acabou; a
 * dona precisa saber QUAIS aulas ocupam a semana, porque quase sempre ela
 * está remanejando e a aula que trava é justamente a que ela quer tirar.
 */
export interface LimiteSemanalErro {
  codigo: 'LIMITE_SEMANAL';
  message: string;
  aulasDaSemana: AulaDaSemana[];
  /** Créditos de reposição do aluno que valem no dia desta aula. */
  creditosParaODia?: number;
}

export function ehLimiteSemanal(data: unknown): data is LimiteSemanalErro {
  return !!data && typeof data === 'object' && (data as { codigo?: string }).codigo === 'LIMITE_SEMANAL';
}

/** A semana tem vaga e o aluno tem crédito: a dona escolhe se é reposição ou plano. */
export interface EscolherTipoErro {
  codigo: 'ESCOLHER_TIPO';
  message: string;
  creditosParaODia: number;
  usadasNaSemana: number;
  aulasSemanais: number;
}

export function ehEscolherTipo(data: unknown): data is EscolherTipoErro {
  return !!data && typeof data === 'object' && (data as { codigo?: string }).codigo === 'ESCOLHER_TIPO';
}

/** Item de GET /agendamentos/horario/:horarioId?data= (admin). */
export interface AgendamentoDoHorario {
  id: string;
  usuarioId: string;
  horarioId: string;
  dataAula: string;
  status: StatusAgendamento;
  reposicao?: boolean;
  usuario: { id: string; nome: string; cpf: string };
  /**
   * O horário fixo que põe este aluno aqui toda semana, quando existe.
   *
   * É o que deixa a tela perguntar, na hora de tirar, se é só esta aula ou se
   * é para tirar da combinação. `null` = encaixe avulso ou reposição, e aí não
   * há nada de permanente para desfazer.
   */
  horarioFixoId?: string | null;
}
