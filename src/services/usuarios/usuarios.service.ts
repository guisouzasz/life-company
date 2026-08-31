import { http } from '../http';
import type { SaldoSemanal } from './usuarios.types';
import type {
  AlunoAdmin,
  AtualizarAlunoPayload,
  AtualizarPlanoPayload,
  CriarAlunoPayload,
  CriarAlunoResposta,
  GerarLinkResposta,
  ProfessorAdmin,
} from './usuarios.admin.types';

export const usuariosService = {
  async saldo(): Promise<SaldoSemanal> {
    const { data } = await http.get<SaldoSemanal>('/usuarios/me/saldo');
    return data;
  },

  // ── Admin ──────────────────────────────────────────────────────────
  async listar(busca?: string): Promise<AlunoAdmin[]> {
    const { data } = await http.get<AlunoAdmin[]>('/usuarios', { params: busca ? { busca } : {} });
    return data;
  },

  async listarProfessores(): Promise<ProfessorAdmin[]> {
    const { data } = await http.get<ProfessorAdmin[]>('/usuarios/professores');
    return data;
  },

  /** Define/redefine a senha de um aluno ou professor (o estúdio não envia e-mail). */
  async definirSenha(id: string, senha: string): Promise<{ mensagem: string }> {
    const { data } = await http.put<{ mensagem: string }>(`/usuarios/${id}/senha`, { senha });
    return data;
  },

  async criar(payload: CriarAlunoPayload): Promise<CriarAlunoResposta> {
    const { data } = await http.post<CriarAlunoResposta>('/usuarios', payload);
    return data;
  },

  async atualizar(id: string, payload: AtualizarAlunoPayload): Promise<AlunoAdmin> {
    const { data } = await http.put<AlunoAdmin>(`/usuarios/${id}`, payload);
    return data;
  },

  async atualizarPlano(id: string, payload: AtualizarPlanoPayload): Promise<AlunoAdmin> {
    const { data } = await http.put<AlunoAdmin>(`/usuarios/${id}/plano`, payload);
    return data;
  },

  async gerarLink(id: string): Promise<GerarLinkResposta> {
    const { data } = await http.post<GerarLinkResposta>(`/usuarios/${id}/gerar-link`, {});
    return data;
  },

  /** Apaga o aluno de vez (dados pessoais e conteúdo; histórico fica anônimo). */
  async excluirDefinitivamente(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/usuarios/${id}/definitivo`);
    return data;
  },
};
