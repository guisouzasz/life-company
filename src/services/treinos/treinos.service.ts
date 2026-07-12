import { http } from '../http';
import type { SalvarTreinoPayload, Treino } from './treinos.types';

export const treinosService = {
  /** Treinos do aluno logado. */
  async meus(): Promise<Treino[]> {
    const { data } = await http.get<Treino[]>('/treinos/meus');
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
};
