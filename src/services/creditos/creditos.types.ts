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
}
