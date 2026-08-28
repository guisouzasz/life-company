import type { DiaSemana, Modalidade } from '../agendamentos/agendamentos.types';

/** Item de GET /horarios/vagas?modalidadeId&data */
export interface HorarioVaga {
  id: string;
  horaInicio: string;
  horaFim: string;
  diaSemana: DiaSemana;
  modalidade: Modalidade;
  capacidadeMaxima: number;
  agendados: number;
  vagas: number;
  disponivel: boolean;
}

/** Item de GET /horarios (admin) */
export interface HorarioAdmin {
  id: string;
  modalidadeId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  capacidadeMaxima: number;
  ativo: boolean;
  modalidade: Modalidade;
  agendados: number;
  vagas: number;
}

export interface CriarHorarioPayload {
  modalidadeId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  capacidadeMaxima?: number;
  ativo?: boolean;
}

export type AtualizarHorarioPayload = Partial<CriarHorarioPayload> & {
  /**
   * Assume mudar o dia/hora de uma turma que já tem aluno agendado — todos
   * eles vão junto para o novo horário. Sem isto a API recusa e diz quantos
   * seriam movidos, para a mudança nunca acontecer por descuido.
   */
  confirmarMudancaDeHorario?: boolean;
};

/** Aluno dentro de uma turma, na grade da semana. */
export interface AlunoNaAula {
  agendamentoId: string;
  usuarioId: string;
  nome: string;
  reposicao: boolean;
}

/**
 * Uma turma num dia concreto da grade.
 *
 * Não confundir com `AulaDaSemana` de agendamentos.types, que é a aula do
 * ALUNO ocupando a cota semanal dele.
 */
export interface AulaNaGrade {
  horarioId: string;
  horaInicio: string;
  horaFim: string;
  modalidade: Modalidade;
  /** Quantos cabem — já com o teto da modalidade aplicado pela API. */
  capacidade: number;
  vagas: number;
  alunos: AlunoNaAula[];
}

export interface DiaDaSemana {
  /** YYYY-MM-DD. Data de verdade, não "a próxima segunda". */
  data: string;
  diaSemana: DiaSemana;
  aulas: AulaNaGrade[];
}

/** GET /horarios/semana?inicio= — a grade de segunda a sexta (admin). */
export interface GradeDaSemana {
  inicio: string;
  fim: string;
  dias: DiaDaSemana[];
}
