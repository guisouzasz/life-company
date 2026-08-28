import { http } from '../http';
import type { Termo } from './termos.types';

export const termosService = {
  /** Termo vigente do estúdio. Rota pública: quem lê ainda não tem conta. */
  async vigente(): Promise<Termo> {
    const { data } = await http.get<Termo>('/termos');
    return data;
  },
};
