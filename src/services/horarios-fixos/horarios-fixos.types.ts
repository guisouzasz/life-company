import type { DiaSemana, Modalidade } from '../agendamentos/agendamentos.types';

export interface HorarioFixo {
  id: string;
  usuarioId: string;
  horarioId: string;
  dataInicio: string;
  dataFim?: string | null;
  ativo: boolean;
  horario: {
    id: string;
    horaInicio: string;
    horaFim: string;
    diaSemana: DiaSemana;
    modalidade: Modalidade;
  };
}

export interface CriarHorarioFixoPayload {
  horarioId: string;
  dataInicio?: string;
  dataFim?: string;
}
