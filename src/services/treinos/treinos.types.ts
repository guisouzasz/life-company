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
  exercicios?: ExercicioPayload[];
}
