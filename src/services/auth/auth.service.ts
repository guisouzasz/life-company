import { http } from '../http';
import type {
  AtivarContaPayload,
  AuthResponse,
  LoginPayload,
  PrimeiroAcessoPayload,
  UsuarioLogado,
} from './auth.types';

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  async primeiroAcesso(payload: PrimeiroAcessoPayload): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/primeiro-acesso', payload);
    return data;
  },

  async ativarConta(payload: AtivarContaPayload): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/ativar-conta', payload);
    return data;
  },

  async esqueciSenha(payload: { email: string }): Promise<{ mensagem: string; enviado?: boolean }> {
    const { data } = await http.post<{ mensagem: string; enviado?: boolean }>('/auth/esqueci-senha', payload);
    return data;
  },

  async alterarSenha(payload: { senhaAtual: string; novaSenha: string }): Promise<{ mensagem: string }> {
    const { data } = await http.post<{ mensagem: string }>('/auth/alterar-senha', payload);
    return data;
  },

  async me(): Promise<UsuarioLogado> {
    const { data } = await http.get<UsuarioLogado>('/auth/me');
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await http.post('/auth/logout', { refreshToken });
  },

  /** Exclui a própria conta (anonimiza os dados pessoais). */
  async excluirConta(): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>('/auth/me');
    return data;
  },
};
