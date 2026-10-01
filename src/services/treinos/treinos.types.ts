export interface ExercicioTreino {
  id: string;
  ordem: number;
  /** Grupo muscular: "Pernas", "Peitoral"... (opcional). */
  grupo?: string | null;
  nome: string;
  series: number;
  repeticoes: string;
  carga?: string | null;
  observacao?: string | null;
}

export interface Treino {
  id: string;
  alunoId: string;
  professorId: string;
  titulo: string;
  /** Treino em texto livre (Funcional/Pilates); Musculação usa exercicios[]. */
  conteudo?: string | null;
  /** Antes dos exercícios (aquecimento). O `conteudo` fica depois deles. */
  textoAntes?: string | null;
  /** Posição definida pelo professor; null = pela ordem do nome. */
  ordem?: number | null;
  observacoes?: string | null;
  // Metadados da ficha (opcionais)
  vencimento?: string | null;
  frequencia?: string | null;
  concluido: boolean;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  exercicios: ExercicioTreino[];
  professor: { id: string; nome: string };
  aluno: { id: string; nome: string };
  /** Modalidade do professor que montou (null quando criado pelo admin). */
  modalidade?: { id: string; nome: string } | null;
}

/**
 * Situação de um aluno para o professor (GET /treinos/resumo): só aparecem
 * alunos com ficha, carga ou aula marcada nas modalidades dele.
 */
export interface ResumoAluno {
  alunoId: string;
  /** Fichas em uso (não arquivadas). */
  fichas: number;
  /** O vencimento mais próximo entre as fichas em uso. */
  vencimento: string | null;
  atualizadaEm: string | null;
  ultimaCarga: string | null;
  /** A próxima aula dele com o professor, nos próximos 7 dias. */
  proximaAula: { data: string; hora: string; modalidade?: string } | null;
}

export interface ExercicioPayload {
  grupo?: string;
  nome: string;
  series?: number;
  repeticoes?: string;
  carga?: string;
  observacao?: string;
}

/** Treino do DIA (Funcional): um por modalidade+data, para todas as aulas. */
export interface TreinoDia {
  id: string;
  data: string;
  conteudo: string;
  updatedAt: string;
  modalidade: { id: string; nome: string };
  professor: { id: string; nome: string };
}

export interface SalvarTreinoDiaPayload {
  /** YYYY-MM-DD */
  data: string;
  conteudo: string;
  /** Só para admin (professor usa a própria modalidade). */
  modalidadeId?: string;
}

export interface SalvarTreinoPayload {
  alunoId: string;
  titulo: string;
  /**
   * Texto livre. No Funcional/Pilates é o treino inteiro; na musculação é o
   * complemento da tabela (aquecimento, alongamento). Exige conteudo OU
   * exercicios.
   */
  conteudo?: string;
  /** Sobre o ALUNO: dor, cirurgia, limitação. Sai no alto da ficha. */
  observacoes?: string;
  /** Metadados da ficha (opcionais). */
  vencimento?: string; // YYYY-MM-DD
  frequencia?: string;
  /**
   * Professor responsável. Ausente, fica quem está montando — quem monta nem
   * sempre é quem acompanha: a dona cadastra e a ficha é do professor.
   */
  professorId?: string;
  /** Modalidade da ficha, para o professor que dá aula em mais de uma. */
  modalidadeId?: string;
  /** Texto antes dos exercícios (aquecimento). Vazio apaga. */
  textoAntes?: string;
  exercicios?: ExercicioPayload[];
}

/** Uma linha de texto de um PDF de ficha, com a posição (0 a 1) de cada pedaço. */
export interface LinhaPdf {
  pagina: number;
  celulas: { x: number; texto: string }[];
}

/** O arquivo escolhido no celular ou no computador. */
export interface ArquivoPdf {
  uri: string;
  name: string;
  mimeType?: string;
  /** No navegador vem o arquivo de verdade; no app, só o caminho (uri). */
  file?: File;
}
