import { http } from '../http';
import type { Modalidade } from '../agendamentos/agendamentos.types';

export const modalidadesService = {
  async listar(): Promise<Modalidade[]> {
    const { data } = await http.get<Modalidade[]>('/modalidades');
    return data;
  },
};
