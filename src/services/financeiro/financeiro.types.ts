export type StatusMensalidade = 'EM_DIA' | 'A_VENCER' | 'ATRASADO' | 'SEM_VALOR';
export type FormaPagamento = 'PIX' | 'DINHEIRO' | 'CARTAO' | 'OUTRO';

export interface PagamentoRegistro {
  id: string;
  valor: number;
  pagoEm: string;
  formaPagamento: FormaPagamento;
}

export interface AlunoFinanceiro {
  usuarioId: string;
  nome: string;
  cpf: string;
  plano: { id: string; nome: string } | null;
  valor: number | null;
  valorPersonalizado: boolean;
  diaVencimento: number;
  status: StatusMensalidade;
  vencimento: string | null;
  /** Dias de atraso (ATRASADO) ou dias até vencer (A_VENCER). */
  dias: number;
  pagamento: PagamentoRegistro | null;
}

export interface ResumoFinanceiro {
  recebidoMes: number;
  aReceber: number;
  atrasados: number;
  semValor: number;
  alunos: AlunoFinanceiro[];
}

export interface Pagamento {
  id: string;
  usuarioId: string;
  valor: number;
  referencia: string;
  pagoEm: string;
  formaPagamento: FormaPagamento;
  observacao?: string | null;
}

export interface MinhaSituacao {
  valor: number | null;
  diaVencimento: number;
  status: StatusMensalidade;
  vencimento: string | null;
  dias: number;
  pagamento: { pagoEm: string; valor: number } | null;
  historico: { referencia: string; valor: number; pagoEm: string }[];
}

export interface RegistrarPagamentoPayload {
  usuarioId: string;
  valor: number;
  /** YYYY-MM (default: mês atual) */
  referencia?: string;
  formaPagamento?: FormaPagamento;
  observacao?: string;
}

export interface ConfigFinanceiroPayload {
  valorMensalidade?: number | null;
  diaVencimento?: number;
}
