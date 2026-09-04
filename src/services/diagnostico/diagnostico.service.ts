import { http } from '../http';
import type { Restauracao, Varredura } from './diagnostico.types';

export const diagnosticoService = {
  async horariosFixos(): Promise<Varredura> {
    const { data } = await http.get<Varredura>('/diagnostico/horarios-fixos');
    return data;
  },

  async restaurarHorariosFixos(): Promise<Restauracao> {
    const { data } = await http.post<Restauracao>('/diagnostico/restaurar-horarios-fixos');
    return data;
  },
};
