export type StatusMensalidade = 'EM_DIA' | 'A_VENCER' | 'ATRASADO' | 'SEM_REGISTRO';
export type FormaPagamento = 'PIX' | 'DINHEIRO' | 'CARTAO' | 'OUTRO';

export interface AlunoFinanceiro {
  usuarioId: string;
  nome: string;
  cpf: string;
  plano: { id: string; nome: string } | null;
  diaVencimento: number;
  status: StatusMensalidade;
  vencimento: string;
  /** Dias de atraso (ATRASADO) ou dias até vencer (A_VENCER). */
  dias: number;
  pagamento: { id: string; pagoEm: string; formaPagamento: FormaPagamento } | null;
}

export interface ResumoFinanceiro {
  pagos: number;
  aVencer: number;
  atrasados: number;
  /** Alunos sem nenhum pagamento registrado (controle ainda não iniciado). */
  semRegistro?: number;
  alunos: AlunoFinanceiro[];
}

export interface Pagamento {
  id: string;
  referencia: string;
  pagoEm: string;
  formaPagamento: FormaPagamento;
  observacao?: string | null;
}

export interface MinhaSituacao {
  diaVencimento: number;
  status: StatusMensalidade;
  vencimento: string;
  dias: number;
  pagamento: { pagoEm: string } | null;
  historico: { referencia: string; pagoEm: string }[];
}

export interface RegistrarPagamentoPayload {
  usuarioId: string;
  /** YYYY-MM (default: mês atual) */
  referencia?: string;
  observacao?: string;
}
