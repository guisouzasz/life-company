import { http } from '../http';
import type { CriarHorarioFixoPayload, HorarioFixo, HorarioFixoCriado } from './horarios-fixos.types';

export const horariosFixosService = {
  async listarDoAluno(usuarioId: string): Promise<HorarioFixo[]> {
    const { data } = await http.get<HorarioFixo[]>(`/horarios-fixos/${usuarioId}`);
    return data;
  },

  async criar(usuarioId: string, payload: CriarHorarioFixoPayload): Promise<HorarioFixoCriado> {
    const { data } = await http.post<HorarioFixoCriado>(`/horarios-fixos/${usuarioId}`, payload);
    return data;
  },

  async remover(id: string): Promise<{ mensagem: string; aulasCanceladas?: number }> {
    const { data } = await http.delete<{ mensagem: string; aulasCanceladas?: number }>(`/horarios-fixos/${id}`);
    return data;
  },
};
