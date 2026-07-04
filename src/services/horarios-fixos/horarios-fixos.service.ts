import { http } from '../http';
import type { CriarHorarioFixoPayload, HorarioFixo } from './horarios-fixos.types';

export const horariosFixosService = {
  async listarDoAluno(usuarioId: string): Promise<HorarioFixo[]> {
    const { data } = await http.get<HorarioFixo[]>(`/horarios-fixos/${usuarioId}`);
    return data;
  },

  async criar(usuarioId: string, payload: CriarHorarioFixoPayload): Promise<HorarioFixo> {
    const { data } = await http.post<HorarioFixo>(`/horarios-fixos/${usuarioId}`, payload);
    return data;
  },

  async remover(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/horarios-fixos/${id}`);
    return data;
  },
};
