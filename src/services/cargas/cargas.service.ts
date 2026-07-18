import { http } from '../http';
import type { EvolucaoExercicio, RegistrarCargaPayload, RegistroCarga } from './cargas.types';

export const cargasService = {
  /** Evolução do aluno logado. */
  async meus(): Promise<EvolucaoExercicio[]> {
    const { data } = await http.get<EvolucaoExercicio[]>('/cargas/meus');
    return data;
  },

  // ── Professor/Admin ────────────────────────────────────────────────
  async doAluno(alunoId: string): Promise<EvolucaoExercicio[]> {
    const { data } = await http.get<EvolucaoExercicio[]>(`/cargas/aluno/${alunoId}`);
    return data;
  },

  async registrar(payload: RegistrarCargaPayload): Promise<RegistroCarga> {
    const { data } = await http.post<RegistroCarga>('/cargas', payload);
    return data;
  },

  async remover(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/cargas/${id}`);
    return data;
  },
};
