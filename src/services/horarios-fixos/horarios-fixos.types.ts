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

/**
 * Resposta de criar um horário fixo: além do fixo em si, o resultado de gerar
 * as aulas. O fixo é a combinação; a geração é o que de fato coloca o aluno
 * na turma — e ela pode falhar sozinha (turma cheia, semana do plano cheia).
 */
export interface HorarioFixoCriado extends HorarioFixo {
  geracao?: {
    criados: number;
    ignorados: number;
    erros: number;
    /** Mensagens da API, sem repetir a mesma várias vezes. */
    motivos?: string[];
  };
}

export interface CriarHorarioFixoPayload {
  horarioId: string;
  dataInicio?: string;
  dataFim?: string;
}
