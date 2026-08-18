export type StatusMensalidade = 'EM_DIA' | 'A_VENCER' | 'ATRASADO' | 'SEM_REGISTRO';
export type FormaPagamento = 'PIX' | 'DINHEIRO' | 'CARTAO' | 'OUTRO';

export interface AlunoFinanceiro {
  usuarioId: string;
  nome: string;
  cpf: string;
  /** Alimenta o aviso por WhatsApp; null quando não foi cadastrado. */
  telefone?: string | null;
  plano: { id: string; nome: string } | null;
  diaVencimento: number;
  /** Valor combinado com este aluno; null enquanto a dona não definiu. */
  valorMensalidade: number | null;
  status: StatusMensalidade;
  vencimento: string;
  /** Dias de atraso (ATRASADO) ou dias até vencer (A_VENCER). */
  dias: number;
  pagamento: { id: string; pagoEm: string; formaPagamento: FormaPagamento; valor: number } | null;
}

export interface ResumoFinanceiro {
  pagos: number;
  aVencer: number;
  atrasados: number;
  /** Alunos sem nenhum pagamento registrado (controle ainda não iniciado). */
  semRegistro?: number;
  /** Soma das mensalidades dos alunos ativos que têm valor definido. */
  previsto: number;
  /** Soma do que foi registrado como recebido neste mês. */
  recebido: number;
  /** Quanto falta entrar de quem ainda não pagou. */
  emAberto: number;
  /** Quantos alunos ainda estão sem valor — o previsto não conta com eles. */
  semValor: number;
  alunos: AlunoFinanceiro[];
}

export interface Pagamento {
  id: string;
  referencia: string;
  pagoEm: string;
  formaPagamento: FormaPagamento;
  observacao?: string | null;
  valor: number;
}

export interface MinhaSituacao {
  diaVencimento: number;
  valorMensalidade: number | null;
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
  /** Quanto entrou. Omitido, vale a mensalidade cadastrada do aluno. */
  valor?: number;
}
