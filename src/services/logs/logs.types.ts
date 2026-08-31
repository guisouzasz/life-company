/** Uma linha do registro de ações do estúdio. */
export interface LogAcao {
  id: string;
  usuarioId: string | null;
  /** Nome copiado no momento da ação — vale mesmo se o cadastro mudar depois. */
  usuarioNome: string;
  usuarioTipo: string;
  metodo: string;
  rota: string;
  /** Frase legível: "Colocou aluno na aula". */
  resumo: string;
  entidadeId: string | null;
  /** JSON com os campos seguros do pedido. Nunca dados sensíveis. */
  detalhe: string | null;
  status: number;
  ip: string | null;
  criadoEm: string;
}

export interface PaginaDeLogs {
  itens: LogAcao[];
  total: number;
  pagina: number;
  paginas: number;
}

export interface AutorDeLog {
  usuarioId: string | null;
  nome: string;
  tipo: string;
  acoes: number;
}

export interface FiltrosDeLog {
  usuarioId?: string;
  desde?: string;
  ate?: string;
  busca?: string;
  pagina?: number;
}
