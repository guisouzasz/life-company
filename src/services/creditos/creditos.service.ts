import { http } from '../http';
import type { Credito, SaldoCredito } from './creditos.types';

export const creditosService = {
  async meus(): Promise<Credito[]> {
    const { data } = await http.get<Credito[]>('/creditos/meus');
    return data;
  },

  async saldo(): Promise<SaldoCredito> {
    const { data } = await http.get<SaldoCredito>('/creditos/meus/saldo');
    return data;
  },

  // ── Admin ──────────────────────────────────────────────────────────
  async listar(usuarioId?: string): Promise<Credito[]> {
    const { data } = await http.get<Credito[]>('/creditos', { params: usuarioId ? { usuarioId } : {} });
    return data;
  },

  async conceder(usuarioId: string, dias?: number): Promise<Credito> {
    const { data } = await http.post<Credito>('/creditos', { usuarioId, dias });
    return data;
  },

  async atualizar(id: string, payload: { expiraEm?: string; revogado?: boolean }): Promise<Credito> {
    const { data } = await http.patch<Credito>(`/creditos/${id}`, payload);
    return data;
  },

  async revogar(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/creditos/${id}`);
    return data;
  },
};
