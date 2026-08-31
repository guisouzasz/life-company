import { http } from '../http';
import type { AutorDeLog, FiltrosDeLog, PaginaDeLogs } from './logs.types';

export const logsService = {
  async listar(filtros: FiltrosDeLog = {}): Promise<PaginaDeLogs> {
    const { data } = await http.get<PaginaDeLogs>('/logs', { params: filtros });
    return data;
  },

  async autores(): Promise<AutorDeLog[]> {
    const { data } = await http.get<AutorDeLog[]>('/logs/autores');
    return data;
  },
};
