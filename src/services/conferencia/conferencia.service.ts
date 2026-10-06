import { http } from '../http';
import type { Conferencia } from './conferencia.types';

export const conferenciaService = {
  /** A de hoje; null antes das 08:00. */
  async hoje(): Promise<Conferencia | null> {
    const { data } = await http.get<Conferencia | null>('/conferencia/hoje');
    return data || null;
  },

  async rodar(): Promise<Conferencia> {
    const { data } = await http.post<Conferencia>('/conferencia/rodar');
    return data;
  },

  async marcarRevisada(id: string): Promise<Conferencia> {
    const { data } = await http.post<Conferencia>(`/conferencia/${id}/revisada`);
    return data;
  },
};
