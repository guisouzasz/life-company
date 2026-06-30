import { http } from '../http';
import type { SaldoSemanal } from './usuarios.types';
import type {
  AlunoAdmin,
  AtualizarAlunoPayload,
  CriarAlunoPayload,
  CriarAlunoResposta,
  GerarLinkResposta,
} from './usuarios.admin.types';

export const usuariosService = {
  async saldo(): Promise<SaldoSemanal> {
    const { data } = await http.get<SaldoSemanal>('/usuarios/me/saldo');
    return data;
  },

  // ── Admin ──────────────────────────────────────────────────────────
  async listar(busca?: string): Promise<AlunoAdmin[]> {
    const { data } = await http.get<AlunoAdmin[]>('/usuarios', { params: busca ? { busca } : {} });
    return data;
  },

  async criar(payload: CriarAlunoPayload): Promise<CriarAlunoResposta> {
    const { data } = await http.post<CriarAlunoResposta>('/usuarios', payload);
    return data;
  },

  async atualizar(id: string, payload: AtualizarAlunoPayload): Promise<AlunoAdmin> {
    const { data } = await http.put<AlunoAdmin>(`/usuarios/${id}`, payload);
    return data;
  },

  async gerarLink(id: string): Promise<GerarLinkResposta> {
    const { data } = await http.post<GerarLinkResposta>(`/usuarios/${id}/gerar-link`, {});
    return data;
  },
};
