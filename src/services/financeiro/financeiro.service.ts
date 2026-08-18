import { http } from '../http';
import type {
  MinhaSituacao,
  Pagamento,
  RegistrarPagamentoPayload,
  ResumoFinanceiro,
} from './financeiro.types';

export const financeiroService = {
  async minhaSituacao(): Promise<MinhaSituacao> {
    const { data } = await http.get<MinhaSituacao>('/financeiro/meu');
    return data;
  },

  // ── Admin ──────────────────────────────────────────────────────────
  async resumo(): Promise<ResumoFinanceiro> {
    const { data } = await http.get<ResumoFinanceiro>('/financeiro/resumo');
    return data;
  },

  async historicoDoAluno(usuarioId: string): Promise<Pagamento[]> {
    const { data } = await http.get<Pagamento[]>(`/financeiro/aluno/${usuarioId}`);
    return data;
  },

  async registrar(payload: RegistrarPagamentoPayload): Promise<Pagamento> {
    const { data } = await http.post<Pagamento>('/financeiro/pagamentos', payload);
    return data;
  },

  async desfazer(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/financeiro/pagamentos/${id}`);
    return data;
  },

  async configurarAluno(
    usuarioId: string,
    payload: { diaVencimento?: number; valorMensalidade?: number | null },
  ) {
    const { data } = await http.patch(`/financeiro/aluno/${usuarioId}/config`, payload);
    return data;
  },
};
