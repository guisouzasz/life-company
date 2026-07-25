import { http } from '../http';
import type { SalvarTreinoDiaPayload, SalvarTreinoPayload, Treino, TreinoDia } from './treinos.types';

export const treinosService = {
  /** Treinos do aluno logado. */
  async meus(): Promise<Treino[]> {
    const { data } = await http.get<Treino[]>('/treinos/meus');
    return data;
  },

  // ── Treino do dia (Funcional) ──────────────────────────────────────
  /** Treinos do dia de hoje das aulas do aluno logado. */
  async diaMeu(): Promise<TreinoDia[]> {
    const { data } = await http.get<TreinoDia[]>('/treinos/dia/meu');
    return data;
  },

  async diaVer(dataDia: string): Promise<TreinoDia | null> {
    const { data } = await http.get<TreinoDia | null>('/treinos/dia', { params: { data: dataDia } });
    return data;
  },

  async diaSalvar(payload: SalvarTreinoDiaPayload): Promise<TreinoDia> {
    const { data } = await http.put<TreinoDia>('/treinos/dia', payload);
    return data;
  },

  async diaRemover(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/treinos/dia/${id}`);
    return data;
  },

  // ── Professor/Admin ────────────────────────────────────────────────
  async doAluno(alunoId: string): Promise<Treino[]> {
    const { data } = await http.get<Treino[]>(`/treinos/aluno/${alunoId}`);
    return data;
  },

  async criar(payload: SalvarTreinoPayload): Promise<Treino> {
    const { data } = await http.post<Treino>('/treinos', payload);
    return data;
  },

  async atualizar(id: string, payload: SalvarTreinoPayload): Promise<Treino> {
    const { data } = await http.put<Treino>(`/treinos/${id}`, payload);
    return data;
  },

  async remover(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/treinos/${id}`);
    return data;
  },

  /** Concluir (arquivar) ou reativar a ficha. */
  async definirStatus(id: string, concluido: boolean): Promise<Treino> {
    const { data } = await http.patch<Treino>(`/treinos/${id}/status`, { concluido });
    return data;
  },
};
