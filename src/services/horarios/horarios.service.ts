import { http } from '../http';
import type { HorarioAdmin, HorarioVaga } from './horarios.types';

export const horariosService = {
  async vagas(modalidadeId: string, data: string): Promise<HorarioVaga[]> {
    const res = await http.get<HorarioVaga[]>('/horarios/vagas', { params: { modalidadeId, data } });
    return res.data;
  },

  async listar(modalidadeId?: string): Promise<HorarioAdmin[]> {
    const res = await http.get<HorarioAdmin[]>('/horarios', { params: modalidadeId ? { modalidadeId } : {} });
    return res.data;
  },

  async bloquear(id: string): Promise<unknown> {
    const res = await http.patch(`/horarios/${id}/bloquear`);
    return res.data;
  },
};
