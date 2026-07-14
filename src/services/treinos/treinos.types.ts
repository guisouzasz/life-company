export interface ExercicioTreino {
  id: string;
  ordem: number;
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
  observacoes?: string | null;
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
  nome: string;
  series?: number;
  repeticoes?: string;
  carga?: string;
  observacao?: string;
}

export interface SalvarTreinoPayload {
  alunoId: string;
  titulo: string;
  observacoes?: string;
  exercicios: ExercicioPayload[];
}
