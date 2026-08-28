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
  /**
   * Aniversariantes da semana corrente (segunda a domingo), em ordem de data.
   * Vem vazio quando não há ninguém — aí o card some da tela.
   */
  aniversariantes?: {
    id: string;
    nome: string;
    /** Do cadastro; null nos antigos, e aí não há botão de parabéns. */
    telefone?: string | null;
    /** Idade que faz nesta data. */
    idade: number;
    /** YYYY-MM-DD do aniversário nesta semana. */
    data: string;
    /** É hoje — o card destaca esses. */
    hoje: boolean;
  }[];
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
