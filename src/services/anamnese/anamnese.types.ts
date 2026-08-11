export interface Anamnese {
  id: string;
  usuarioId: string;
  objetivo?: string | null;
  nivelAtividade?: string | null;
  problemasSaude?: string | null;
  lesoes?: string | null;
  dores?: string | null;
  medicamentos?: string | null;
  alergias?: string | null;
  gestante: boolean;
  fumante: boolean;
  liberacaoMedica: boolean;
  observacoes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalvarAnamnesePayload {
  objetivo?: string;
  nivelAtividade?: string;
  problemasSaude?: string;
  lesoes?: string;
  dores?: string;
  medicamentos?: string;
  alergias?: string;
  gestante?: boolean;
  fumante?: boolean;
  liberacaoMedica?: boolean;
  observacoes?: string;
}

/** Opções dos chips do formulário. */
export const OBJETIVOS = [
  'Emagrecimento',
  'Hipertrofia',
  'Condicionamento',
  'Saúde e bem-estar',
  'Reabilitação',
] as const;

export const NIVEIS = [
  'Nunca treinei',
  'Estou parado(a)',
  'Treino às vezes',
  'Treino regularmente',
] as const;
