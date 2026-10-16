import { http } from '../http';
import type { DiaFechado, ResultadoFechamento } from './dias-fechados.types';

export const diasFechadosService = {
  async listar(de: string, ate: string): Promise<DiaFechado[]> {
    const { data } = await http.get<DiaFechado[]>('/dias-fechados', { params: { de, ate } });
    return data;
  },

  /**
   * Fecha o dia: as aulas marcadas saem da agenda e contam na semana do aluno.
   * `recesso`: cada aula do plano vira crédito extra (Termo, seção 4).
   */
  async fechar(dataDia: string, motivo: string, recesso = false): Promise<ResultadoFechamento> {
    const { data } = await http.post<ResultadoFechamento>('/dias-fechados', { data: dataDia, motivo, recesso });
    return data;
  },

  /** Reabre o dia: as aulas do plano voltam para a agenda. */
  async reabrir(id: string): Promise<{ mensagem: string; aulasDevolvidas: number }> {
    const { data } = await http.delete<{ mensagem: string; aulasDevolvidas: number }>(`/dias-fechados/${id}`);
    return data;
  },
};
