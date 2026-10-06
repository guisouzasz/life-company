export type DiaSemanaRelatorio = 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA';

export interface AulaHoje {
  horarioId: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  agendados: number;
  capacidade: number;
  /**
   * Depois que a aula termina: quantos contam como presentes (todo mundo que
   * estava marcado — não existe chamada) e faltas registradas à mão (exceção).
   * 0 e 0 antes de a aula terminar.
   */
  presentes?: number;
  faltas?: number;
}

export interface RelatorioDashboard {
  totalAlunos: number;
  alunosAtivos: number;
  aulasSemana: number;
  /** Aulas da semana que já terminaram e contam como dadas (marcadas e não canceladas). */
  presencas: number;
  /** Faltas registradas à mão (exceção — nenhuma tela registra hoje). */
  faltas: number;
  /** Aulas da semana que o próprio aluno cancelou no prazo. */
  canceladasSemana?: number;
  ocupacao: number;
  /** Dadas ÷ (dadas + canceladas pelo aluno + faltas) na semana; null sem nenhuma ainda. */
  taxaPresenca?: number | null;
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
    /** É da equipe (professor), não aluno — o card marca. */
    professor?: boolean;
    /** Idade que faz nesta data. */
    idade: number;
    /** YYYY-MM-DD do aniversário nesta semana. */
    data: string;
    /** É hoje — o card destaca esses. */
    hoje: boolean;
  }[];
}

/**
 * Frequência de um aluno nos últimos `periodoDias` dias, já calculada na API
 * pela regra do estúdio: aula marcada e não cancelada conta como dada quando
 * termina.
 */
export interface AlunoFrequencia {
  id: string;
  nome: string;
  periodoDias: number;
  /** Aulas dadas (inclui as reposições). */
  presencas: number;
  reposicoes: number;
  /** Canceladas pelo próprio aluno, no prazo. */
  canceladas: number;
  /** Faltas registradas à mão (exceção). */
  faltas: number;
  /** Dadas ÷ (dadas + canceladas + faltas); null sem nenhuma aula no período. */
  assiduidade: number | null;
  /** YYYY-MM-DD da última aula dada, ou null. */
  ultimaAula: string | null;
  usuarioPlanos: {
    plano: { nome: string; aulasSemanais: number };
    modalidade: { nome: string };
  }[];
}
