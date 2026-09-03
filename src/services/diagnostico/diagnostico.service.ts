import { http } from '../http';
import type { Varredura } from './diagnostico.types';

export const diagnosticoService = {
  async horariosFixos(): Promise<Varredura> {
    const { data } = await http.get<Varredura>('/diagnostico/horarios-fixos');
    return data;
  },
};
