import { http } from '../http';
import type { Restauracao, Varredura } from './diagnostico.types';

export const diagnosticoService = {
  async horariosFixos(): Promise<Varredura> {
    const { data } = await http.get<Varredura>('/diagnostico/horarios-fixos');
    return data;
  },

  /** Devolve só os horários marcados na tela — nunca "todos". */
  async restaurarHorariosFixos(ids: string[]): Promise<Restauracao> {
    const { data } = await http.post<Restauracao>('/diagnostico/restaurar-horarios-fixos', { ids });
    return data;
  },
};
