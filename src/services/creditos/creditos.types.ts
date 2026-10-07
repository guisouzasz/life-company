export type StatusCredito = 'VALIDO' | 'USADO' | 'EXPIRADO' | 'REVOGADO';

export interface Credito {
  id: string;
  usuarioId: string;
  origemAgendamentoId?: string | null;
  criadoEm: string;
  expiraEm: string;
  usado: boolean;
  usadoEm?: string | null;
  usadoAgendamentoId?: string | null;
  revogado: boolean;
  concedidoAdmin: boolean;
  status: StatusCredito;
  usuario?: { id: string; nome: string; email: string };
}

export interface SaldoCredito {
  disponiveis: number;
  /** Reposições que ainda dá para MARCAR agora (termo: 3 a cada 30 dias). */
  reposicoesRestantes?: number;
  maxReposicoes?: number;
  /** Com o limite atingido: quando abre a próxima vaga. */
  proximaReposicaoEm?: string | null;
}
