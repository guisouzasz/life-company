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
