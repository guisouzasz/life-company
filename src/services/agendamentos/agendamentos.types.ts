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
  createdAt: string;
  horario: Horario;
  presenca?: Presenca | null;
}

export interface CriarAgendamentoPayload {
  horarioId: string;
  dataAula: string; // YYYY-MM-DD
  usarCredito?: boolean; // agendar consumindo um crédito de reposição
}
