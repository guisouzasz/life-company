import { http } from '../http';
import type { AtualizarHorarioPayload, CriarHorarioPayload, HorarioAdmin, HorarioVaga } from './horarios.types';

export const horariosService = {
  async vagas(modalidadeId: string, data: string): Promise<HorarioVaga[]> {
    const res = await http.get<HorarioVaga[]>('/horarios/vagas', { params: { modalidadeId, data } });
    return res.data;
  },

  /** Todas as modalidades de uma data (agenda do professor). */
  async vagasDia(data: string): Promise<HorarioVaga[]> {
    const res = await http.get<HorarioVaga[]>('/horarios/vagas', { params: { data } });
    return res.data;
  },

  async listar(modalidadeId?: string, todos = false): Promise<HorarioAdmin[]> {
    const res = await http.get<HorarioAdmin[]>('/horarios', {
      params: { ...(modalidadeId ? { modalidadeId } : {}), ...(todos ? { todos: '1' } : {}) },
    });
    return res.data;
  },

  async criar(payload: CriarHorarioPayload): Promise<HorarioAdmin> {
    const res = await http.post<HorarioAdmin>('/horarios', payload);
    return res.data;
  },

  async atualizar(id: string, payload: AtualizarHorarioPayload): Promise<HorarioAdmin> {
    const res = await http.patch<HorarioAdmin>(`/horarios/${id}`, payload);
    return res.data;
  },

  async excluir(id: string): Promise<{ mensagem: string }> {
    const res = await http.delete<{ mensagem: string }>(`/horarios/${id}`);
    return res.data;
  },

  async bloquear(id: string): Promise<unknown> {
    const res = await http.patch(`/horarios/${id}/bloquear`);
    return res.data;
  },
};
