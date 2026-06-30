export interface RelatorioDashboard {
  totalAlunos: number;
  alunosAtivos: number;
  aulasSemana: number;
  presencas: number;
  faltas: number;
  ocupacao: number;
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
