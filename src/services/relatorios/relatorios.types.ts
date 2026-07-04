export type DiaSemanaRelatorio = 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA';

export interface AulaHoje {
  horarioId: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  agendados: number;
  capacidade: number;
}

export interface RelatorioDashboard {
  totalAlunos: number;
  alunosAtivos: number;
  aulasSemana: number;
  presencas: number;
  faltas: number;
  ocupacao: number;
  // Opcionais: presentes só após o deploy do backend ampliado
  aulasPorDia?: { dia: DiaSemanaRelatorio; total: number }[];
  aulasHoje?: AulaHoje[];
}

export interface AlunoFrequencia {
  id: string;
  nome: string;
  agendamentos: {
    id: string;
    status: string;
    dataAula: string;
    presenca?: { compareceu: boolean } | null;
  }[];
  usuarioPlanos: {
    plano: { nome: string; aulasSemanais: number };
    modalidade: { nome: string };
  }[];
}
