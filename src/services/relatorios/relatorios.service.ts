import { http } from '../http';
import type { AlunoFrequencia, RelatorioDashboard } from './relatorios.types';

export const relatoriosService = {
  async dashboard(): Promise<RelatorioDashboard> {
    const { data } = await http.get<RelatorioDashboard>('/relatorios/dashboard');
    return data;
  },

  async frequencia(): Promise<AlunoFrequencia[]> {
    const { data } = await http.get<AlunoFrequencia[]>('/relatorios/frequencia');
    return data;
  },
};
