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
  /** Resumo de ontem: aulas de ontem que foram canceladas. */
  canceladosOntem?: { nome: string; horaInicio: string; modalidade: string }[];
  /** Créditos válidos não usados — quem cancelou e ainda não remarcou. */
  reposicoesPendentes?: { total: number; alunos: { nome: string; creditos: number }[] };
  /** Alunos cadastrados que ainda não ativaram a conta. */
  aguardandoAcesso?: { total: number; nomes: string[] };
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
