import { http } from '../http';
import type { Agendamento, CriarAgendamentoPayload } from './agendamentos.types';

export const agendamentosService = {
  async meus(): Promise<Agendamento[]> {
    const { data } = await http.get<Agendamento[]>('/agendamentos/meus');
    return data;
  },

  async historico(page = 1): Promise<Agendamento[]> {
    const { data } = await http.get<Agendamento[]>('/agendamentos/historico', { params: { page } });
    return data;
  },

  async criar(payload: CriarAgendamentoPayload): Promise<Agendamento> {
    const { data } = await http.post<Agendamento>('/agendamentos', payload);
    return data;
  },

  async cancelar(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.patch<{ mensagem: string }>(`/agendamentos/${id}/cancelar`);
    return data;
  },
};
