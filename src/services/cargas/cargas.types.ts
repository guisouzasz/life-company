export interface RegistroCarga {
  id: string;
  peso: number;
  repeticoes?: string | null;
  observacao?: string | null;
  data: string;
}

/** Evolução do aluno num exercício (registros do mais antigo ao mais novo). */
export interface EvolucaoExercicio {
  exercicio: string;
  registros: RegistroCarga[];
  atual: number;
  inicial: number;
  recorde: number;
  evolucaoKg: number;
  evolucaoPct: number;
}

export interface RegistrarCargaPayload {
  alunoId: string;
  exercicio: string;
  peso: number;
  repeticoes?: string;
  observacao?: string;
  /** YYYY-MM-DD (default: hoje) */
  data?: string;
}
