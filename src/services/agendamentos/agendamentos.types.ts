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
}

export function ehLimiteSemanal(data: unknown): data is LimiteSemanalErro {
  return !!data && typeof data === 'object' && (data as { codigo?: string }).codigo === 'LIMITE_SEMANAL';
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
}
