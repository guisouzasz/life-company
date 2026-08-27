import { http } from '../http';
import type { Agendamento, AgendamentoDoHorario, CriarAgendamentoPayload } from './agendamentos.types';

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

  // ── Admin ──────────────────────────────────────────────────────────
  /** Alunos agendados num horário em uma data (admin). */
  async listarPorHorario(horarioId: string, data: string): Promise<AgendamentoDoHorario[]> {
    const res = await http.get<AgendamentoDoHorario[]>(`/agendamentos/horario/${horarioId}`, { params: { data } });
    return res.data;
  },

  /** Próximas aulas de um aluno (admin) — para achar e desmarcar aula sobrando. */
  async listarDoAluno(usuarioId: string): Promise<Agendamento[]> {
    const res = await http.get<Agendamento[]>(`/agendamentos/aluno/${usuarioId}`);
    return res.data;
  },

  /**
   * Desmarca sem gerar crédito — arrumação de agenda (aula que sobrou de
   * horário fixo antigo, remanejamento). Diferente de `cancelarAdmin`, que é
   * o estúdio cancelando uma aula que ia acontecer e compensa o aluno.
   */
  async desmarcar(id: string): Promise<{ mensagem: string }> {
    const res = await http.patch<{ mensagem: string }>(`/agendamentos/${id}/desmarcar`);
    return res.data;
  },

  /** Cancela pelo admin — o aluno recebe 1 crédito de reposição. */
  async cancelarAdmin(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.patch<{ mensagem: string }>(`/agendamentos/${id}/cancelar-admin`);
    return data;
  },
};
